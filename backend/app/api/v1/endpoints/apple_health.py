"""Apple Health import endpoints."""
import logging
import xml.etree.ElementTree as ET
from io import StringIO
from fastapi import APIRouter, Depends, HTTPException, Request, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select as sa_select, and_, func
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from pydantic import BaseModel

from zoneinfo import ZoneInfo

from app.core.database import get_db
from app.core.security import get_current_user, require_editor
from app.core.webhook_auth import get_webhook_user, get_webhook_user_allow_query
from app.models.health import HealthMetric, MetricType, Medication, MedicationLog
from app.models.user import User
from app.schemas.health import (
    AppleHealthImportResponse,
    HealthMetricCreate,
)
from app.services.health_sync import parse_apple_health_export

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/health/apple", tags=["apple-health"])

# Apple Health XML type mapping
APPLE_HEALTH_TYPE_MAP = {
    "HKQuantityTypeIdentifierHeartRate": (MetricType.HEART_RATE, "bpm"),
    "HKQuantityTypeIdentifierBodyMass": (MetricType.WEIGHT, "kg"),
    "HKQuantityTypeIdentifierActiveEnergyBurned": (MetricType.CALORIES, "kcal"),
    "HKQuantityTypeIdentifierStepCount": (MetricType.STEPS, "passi"),
    "HKQuantityTypeIdentifierBloodPressureSystolic": (MetricType.BLOOD_PRESSURE, "mmHg"),
    "HKQuantityTypeIdentifierOxygenSaturation": (MetricType.OXYGEN, "%"),
    "HKQuantityTypeIdentifierBodyTemperature": (MetricType.TEMPERATURE, "°C"),
}


# ── Webhook schemas ──────────────────────────────────────────────────────────

class WebhookMetric(BaseModel):
    """Single metric sent by the iOS Shortcut."""
    type: str                  # e.g. "heart_rate", "steps"
    value: float
    unit: str = ""
    recorded_at: str           # ISO-8601 string from Shortcut


class AppleHealthWebhookPayload(BaseModel):
    """Payload sent by the iOS Shortcut."""
    metrics: List[WebhookMetric] = []


# Shortcut type-string → (MetricType enum, fallback unit)
SHORTCUT_TYPE_MAP: dict[str, tuple[MetricType, str]] = {
    "heart_rate":     (MetricType.HEART_RATE, "bpm"),
    "steps":          (MetricType.STEPS, "passi"),
    "weight":         (MetricType.WEIGHT, "kg"),
    "calories":       (MetricType.CALORIES, "kcal"),
    "blood_pressure": (MetricType.BLOOD_PRESSURE, "mmHg"),
    "oxygen":         (MetricType.OXYGEN, "%"),
    "temperature":    (MetricType.TEMPERATURE, "°C"),
}

@router.post("/webhook")
async def apple_health_webhook(
    payload: AppleHealthWebhookPayload,
    webhook_user: User = Depends(get_webhook_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Receive real-time health data from an iOS Shortcut.

    The Shortcut runs hourly and POSTs the latest metrics.
    This endpoint is authenticated with a per-user API token (Bearer) and
    does NOT require a user JWT — the data is attributed to the token's owner.
    """
    user_id = webhook_user.id
    imported = 0
    skipped = 0
    errors: List[str] = []
    window = timedelta(minutes=1)

    for item in payload.metrics:
        metric_key = item.type.lower()
        if metric_key not in SHORTCUT_TYPE_MAP:
            errors.append(f"Tipo sconosciuto: {item.type}")
            continue

        metric_type, default_unit = SHORTCUT_TYPE_MAP[metric_key]
        unit = item.unit or default_unit

        try:
            recorded_at = _parse_shortcut_date(item.recorded_at)
        except (ValueError, AttributeError) as e:
            errors.append(f"{item.type}: data non valida ({item.recorded_at})")
            continue

        # Deduplication: skip if same type exists within ±1 min
        dup_check = await db.execute(
            sa_select(HealthMetric.id).where(
                and_(
                    HealthMetric.user_id == user_id,
                    HealthMetric.metric_type == metric_type,
                    HealthMetric.recorded_at >= recorded_at - window,
                    HealthMetric.recorded_at <= recorded_at + window,
                )
            ).limit(1)
        )
        if dup_check.scalar_one_or_none():
            skipped += 1
            continue

        db.add(HealthMetric(
            user_id=user_id,
            metric_type=metric_type,
            value=item.value,
            unit=unit,
            recorded_at=recorded_at,
            source="ios_shortcut",
        ))
        imported += 1

    await db.commit()

    return {
        "ok": True,
        "imported": imported,
        "skipped": skipped,
        "errors": errors[:10],
        "synced_at": datetime.now(timezone.utc).isoformat(),
    }


# ─────────────────────────────────────────────────────────────────────────────

@router.post("/import/csv", response_model=AppleHealthImportResponse)
async def import_csv(
    data: str,
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> AppleHealthImportResponse:
    """Import Apple Health data from CSV format."""
    try:
        metrics = await parse_apple_health_export(data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Errore nel parsing CSV: {str(e)}",
        )

    imported = 0
    errors: List[str] = []

    for metric_data in metrics:
        try:
            metric = HealthMetric(
                user_id=current_user["sub"],
                metric_type=metric_data.metric_type,
                value=metric_data.value,
                unit=metric_data.unit,
                recorded_at=metric_data.recorded_at,
                source="apple_health",
            )
            db.add(metric)
            imported += 1
        except Exception as e:
            errors.append(str(e))

    await db.commit()

    return AppleHealthImportResponse(
        metrics_imported=imported,
        errors=errors[:10],  # Limit error list
    )


@router.post("/import/xml", response_model=AppleHealthImportResponse)
async def import_xml(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> AppleHealthImportResponse:
    """Import Apple Health data from XML export file.

    Apple Health exports data as export.xml which contains <Record> elements.
    """
    if not file.filename or not (file.filename.endswith(".xml") or file.filename.endswith(".zip")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Il file deve essere un XML esportato da Apple Salute.",
        )

    content = await file.read()
    content_str = content.decode("utf-8", errors="ignore")

    imported = 0
    errors: List[str] = []

    try:
        # Parse XML incrementally to handle large files
        context = ET.iterparse(StringIO(content_str), events=("end",))
        batch: List[HealthMetric] = []
        batch_size = 100

        for event, elem in context:
            if elem.tag != "Record":
                continue

            record_type = elem.get("type", "")
            if record_type not in APPLE_HEALTH_TYPE_MAP:
                elem.clear()
                continue

            metric_type, default_unit = APPLE_HEALTH_TYPE_MAP[record_type]

            try:
                value = float(elem.get("value", "0"))
                unit = elem.get("unit", default_unit)
                date_str = elem.get("startDate", "")

                # Apple Health date format: 2024-01-15 08:30:00 +0100
                recorded_at = _parse_apple_date(date_str)

                metric = HealthMetric(
                    user_id=current_user["sub"],
                    metric_type=metric_type,
                    value=value,
                    unit=unit,
                    recorded_at=recorded_at,
                    source="apple_health",
                )
                batch.append(metric)
                imported += 1

                if len(batch) >= batch_size:
                    db.add_all(batch)
                    await db.flush()
                    batch = []

            except (ValueError, TypeError) as e:
                errors.append(f"Record {record_type}: {str(e)}")

            elem.clear()

        # Flush remaining batch
        if batch:
            db.add_all(batch)

        await db.commit()

    except ET.ParseError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Errore nel parsing XML: {str(e)}",
        )

    return AppleHealthImportResponse(
        metrics_imported=imported,
        errors=errors[:10],
    )


@router.get("/status")
async def get_import_status(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get Apple Health import status — how many records from apple_health source."""
    from sqlalchemy import func, select as sa_select

    result = await db.execute(
        sa_select(
            HealthMetric.metric_type,
            func.count(HealthMetric.id).label("count"),
            func.max(HealthMetric.recorded_at).label("latest"),
        )
        .where(
            (HealthMetric.user_id == current_user["sub"])
            & (HealthMetric.source == "apple_health")
        )
        .group_by(HealthMetric.metric_type)
    )
    rows = result.all()

    summary = {}
    total = 0
    for row in rows:
        summary[row.metric_type.value] = {
            "count": row.count,
            "latest": row.latest.isoformat() if row.latest else None,
        }
        total += row.count

    return {
        "connected": total > 0,
        "total_records": total,
        "by_type": summary,
    }


def _parse_shortcut_date(date_str: str) -> datetime:
    """Parse date from iOS Shortcut — accepts many formats and falls back to now.

    iOS Shortcuts can send dates in many formats depending on locale/settings:
        '2026-04-06T16:05:00+02:00'  ← ISO (ideal)
        '2026-04-06 16:05:00'        ← ISO without tz
        '16:05'                       ← time only (uses today)
        '06/04/26, 16:05'            ← Italian locale short
    All results are returned as naive UTC datetimes.
    """
    if not date_str:
        return datetime.utcnow()

    s = date_str.strip()

    # Try ISO with timezone
    for fmt in ["%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%d %H:%M:%S %z", "%Y-%m-%dT%H:%M:%S.%f%z"]:
        try:
            dt = datetime.strptime(s, fmt)
            return dt.astimezone(timezone.utc).replace(tzinfo=None)
        except ValueError:
            pass

    # Try fromisoformat (handles +02:00 style)
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        if dt.tzinfo:
            return dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt
    except ValueError:
        pass

    # Naive datetime formats
    for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M", "%d/%m/%y, %H:%M", "%d/%m/%Y, %H:%M"]:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            pass

    # Time only (e.g. "16:05") — use today's date
    for fmt in ["%H:%M:%S", "%H:%M"]:
        try:
            t = datetime.strptime(s, fmt)
            now = datetime.utcnow()
            return now.replace(hour=t.hour, minute=t.minute, second=t.second, microsecond=0)
        except ValueError:
            pass

    # Last resort: use now
    logger.warning("Could not parse date '%s', using now", date_str)
    return datetime.utcnow()


def _parse_apple_date(date_str: str) -> datetime:
    """Parse Apple Health date format.

    Examples:
        '2024-01-15 08:30:00 +0100'
        '2024-01-15T08:30:00+01:00'
    """
    # Try ISO format first
    for fmt in [
        "%Y-%m-%d %H:%M:%S %z",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%d %H:%M:%S",
    ]:
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            continue

    # Fallback: try fromisoformat
    return datetime.fromisoformat(date_str.strip())


# ─── Health Auto Export app integration ──────────────────────────────────────

# Mapping from Health Auto Export metric names → our MetricType
AUTO_EXPORT_NAME_MAP: dict[str, tuple[MetricType, str]] = {
    "heart_rate":                  (MetricType.HEART_RATE, "bpm"),
    "resting_heart_rate":          (MetricType.HEART_RATE, "bpm"),
    "walking_heart_rate_average":  (MetricType.HEART_RATE, "bpm"),
    "active_energy":               (MetricType.CALORIES, "kcal"),
    "basal_energy_burned":         (MetricType.CALORIES, "kcal"),
    "step_count":                  (MetricType.STEPS, "passi"),
    "body_mass":                   (MetricType.WEIGHT, "kg"),
    "weight":                      (MetricType.WEIGHT, "kg"),
    "blood_pressure_systolic":     (MetricType.BLOOD_PRESSURE, "mmHg"),
    "blood_pressure":              (MetricType.BLOOD_PRESSURE, "mmHg"),
    "oxygen_saturation":           (MetricType.OXYGEN, "%"),
    "body_temperature":            (MetricType.TEMPERATURE, "°C"),
}


@router.post("/auto-export")
async def health_auto_export(
    request: Request,
    webhook_user: User = Depends(get_webhook_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Receive data from the Health Auto Export iOS app.

    The app sends a JSON payload with this structure:
    {
      "data": {
        "metrics": [
          {
            "name": "heart_rate",
            "units": "count/min",
            "data": [
              {"date": "2026-04-06 10:00:00 +0200", "Avg": 72, "Min": 60, "Max": 85},
              ...
            ]
          },
          {
            "name": "step_count",
            "units": "count",
            "data": [
              {"date": "2026-04-06 10:00:00 +0200", "qty": 8500},
              ...
            ]
          }
        ]
      }
    }
    """
    # Parse raw JSON
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    user_id = webhook_user.id
    data = body.get("data", body)  # Support both {"data": {...}} and flat format
    metrics_list = data.get("metrics", [])

    imported = 0
    skipped = 0
    errors: List[str] = []
    window = timedelta(minutes=1)

    for metric_group in metrics_list:
        metric_name = metric_group.get("name", "").lower().replace(" ", "_")
        unit = metric_group.get("units", "")
        data_points = metric_group.get("data", [])

        if metric_name not in AUTO_EXPORT_NAME_MAP:
            continue  # Skip unsupported metrics silently

        metric_type, default_unit = AUTO_EXPORT_NAME_MAP[metric_name]
        unit = unit or default_unit

        for point in data_points:
            try:
                # Extract value: prefer "qty", then "Avg", then "value"
                value = point.get("qty") or point.get("Avg") or point.get("avg") or point.get("value")
                if value is None:
                    continue
                value = float(value)

                # Parse date
                date_str = point.get("date", "")
                recorded_at = _parse_shortcut_date(date_str)

                # Deduplication
                dup = await db.execute(
                    sa_select(HealthMetric.id).where(
                        and_(
                            HealthMetric.user_id == user_id,
                            HealthMetric.metric_type == metric_type,
                            HealthMetric.recorded_at >= recorded_at - window,
                            HealthMetric.recorded_at <= recorded_at + window,
                        )
                    ).limit(1)
                )
                if dup.scalar_one_or_none():
                    skipped += 1
                    continue

                db.add(HealthMetric(
                    user_id=user_id,
                    metric_type=metric_type,
                    value=value,
                    unit=unit,
                    recorded_at=recorded_at,
                    source="health_auto_export",
                ))
                imported += 1

            except (ValueError, TypeError) as e:
                errors.append(f"{metric_name}: {str(e)}")

    await db.commit()

    return {
        "ok": True,
        "imported": imported,
        "skipped": skipped,
        "errors": errors[:10],
        "synced_at": datetime.now(timezone.utc).isoformat(),
    }


# ─── Health Auto Export — Medication Sync ─────────────────────────────────────

# Mapping from Health Auto Export status → (skipped: bool)
_HAE_MED_STATUS_MAP: dict[str, bool] = {
    "taken": False,
    "skipped": True,
}


class HAEMedicationEntry(BaseModel):
    """Single medication entry from Health Auto Export.

    See: https://github.com/Lybron/health-auto-export/wiki/API-Export---JSON-Format
    """
    displayText: str = ""            # e.g. "Duloxetina 60 mg Capsule"
    nickname: Optional[str] = None   # user-assigned nickname in Apple Health
    start: str = ""                  # ISO-ish date from HAE
    end: Optional[str] = None
    scheduledDate: Optional[str] = None
    form: Optional[str] = None       # Capsule, Tablet, etc.
    status: str = ""                 # Taken, Skipped, Not Interacted, ...
    isArchived: bool = False
    dosage: Optional[float] = None
    codings: Optional[list] = None


class HAEMedicationPayload(BaseModel):
    """Payload wrapper — Health Auto Export sends {data: {medications: [...]}}."""
    medications: List[HAEMedicationEntry] = []


@router.post("/medications/sync")
async def sync_medications_from_hae(
    request: Request,
    webhook_user: User = Depends(get_webhook_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Receive medication dose events from Health Auto Export.

    Health Auto Export sends a JSON payload like:
    {
      "data": {
        "medications": [
          {
            "displayText": "Duloxetina 60 mg Capsule",
            "nickname": "Duloxetina",
            "status": "Taken",
            "start": "2026-04-07 08:30:00 +0200",
            "form": "Capsule",
            "dosage": 60
          }
        ]
      }
    }

    This endpoint matches each entry to an existing Medication by name
    (using displayText or nickname) and creates a MedicationLog entry.
    """
    # Parse raw JSON
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    user_id = webhook_user.id

    # Extract medications array (support both nested and flat)
    data = body.get("data", body)
    med_entries_raw = data.get("medications", [])

    # Parse entries
    med_entries: List[HAEMedicationEntry] = []
    for raw in med_entries_raw:
        try:
            med_entries.append(HAEMedicationEntry(**raw))
        except Exception as e:
            logger.warning("Skipping invalid medication entry: %s", e)

    if not med_entries:
        return {
            "ok": True,
            "imported": 0,
            "skipped": 0,
            "message": "Nessun farmaco nel payload.",
            "synced_at": datetime.now(timezone.utc).isoformat(),
        }

    # Pre-load all active medications for this user (for matching)
    meds_result = await db.execute(
        sa_select(Medication).where(
            and_(Medication.user_id == user_id, Medication.is_active == True)
        )
    )
    user_meds = meds_result.scalars().all()

    # Build lookup: lowercase name → Medication object
    med_lookup: dict[str, "Medication"] = {}
    for m in user_meds:
        med_lookup[m.name.lower().strip()] = m

    imported = 0
    skipped = 0
    not_matched = 0
    errors: List[str] = []

    tz_rome = ZoneInfo("Europe/Rome")

    for entry in med_entries:
        # Only process Taken / Skipped
        status_lower = entry.status.lower().strip()
        if status_lower not in _HAE_MED_STATUS_MAP:
            skipped += 1
            continue

        is_skipped = _HAE_MED_STATUS_MAP[status_lower]

        # Parse timestamp
        try:
            taken_at = _parse_shortcut_date(entry.start)
        except Exception:
            errors.append(f"Data non valida per '{entry.displayText}': {entry.start}")
            continue

        # Match to a known medication by nickname (preferred) or displayText
        matched_med = None

        # Try nickname first (exact match)
        if entry.nickname:
            matched_med = med_lookup.get(entry.nickname.lower().strip())

        # Try displayText — it often looks like "Duloxetina 60 mg Capsule"
        if not matched_med and entry.displayText:
            display_lower = entry.displayText.lower().strip()
            # Exact match
            matched_med = med_lookup.get(display_lower)
            # Partial match: check if any known med name is contained in displayText
            if not matched_med:
                for med_name, med_obj in med_lookup.items():
                    if med_name in display_lower or display_lower.startswith(med_name):
                        matched_med = med_obj
                        break

        if not matched_med:
            not_matched += 1
            errors.append(f"Farmaco non trovato: '{entry.nickname or entry.displayText}'")
            continue

        # Deduplication: same medication + same day (Italian TZ) + same skipped status
        if taken_at.tzinfo is None:
            day_local = taken_at.replace(tzinfo=timezone.utc).astimezone(tz_rome).date()
        else:
            day_local = taken_at.astimezone(tz_rome).date()
        day_start_utc = datetime.combine(day_local, datetime.min.time(), tzinfo=tz_rome).astimezone(timezone.utc).replace(tzinfo=None)
        day_end_utc = datetime.combine(day_local, datetime.max.time(), tzinfo=tz_rome).astimezone(timezone.utc).replace(tzinfo=None)

        dup = await db.execute(
            sa_select(MedicationLog.id).where(
                and_(
                    MedicationLog.medication_id == matched_med.id,
                    MedicationLog.user_id == user_id,
                    MedicationLog.taken_at >= day_start_utc,
                    MedicationLog.taken_at <= day_end_utc,
                    MedicationLog.skipped == is_skipped,
                )
            ).limit(1)
        )
        if dup.scalar_one_or_none():
            skipped += 1
            continue

        # Create the log
        db.add(MedicationLog(
            medication_id=matched_med.id,
            user_id=user_id,
            taken_at=taken_at,
            skipped=is_skipped,
            notes=f"Sync da Apple Health ({entry.form or 'auto'})",
        ))
        imported += 1

    await db.commit()

    return {
        "ok": True,
        "imported": imported,
        "skipped": skipped,
        "not_matched": not_matched,
        "errors": errors[:10],
        "synced_at": datetime.now(timezone.utc).isoformat(),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# UNIFIED iOS SHORTCUT ENDPOINT — accetta TUTTE le metriche in un unico POST.
# Niente header custom → funziona con iOS Shortcuts senza problemi HTTP/2.
# Token via query param: ?token=<secret>
# Body: pipe-delimited text (type|value|unit|date per riga) o JSON
# ═══════════════════════════════════════════════════════════════════════════════

# Mappa tipo (italiano/inglese) → (MetricType, unità default)
_UNIFIED_TYPE_MAP: dict[str, tuple[MetricType, str]] = {
    # Inglese
    "steps": (MetricType.STEPS, "passi"),
    "step_count": (MetricType.STEPS, "passi"),
    "heart_rate": (MetricType.HEART_RATE, "bpm"),
    "resting_heart_rate": (MetricType.HEART_RATE, "bpm"),
    "walking_heart_rate": (MetricType.HEART_RATE, "bpm"),
    "calories": (MetricType.CALORIES, "kcal"),
    "active_energy": (MetricType.CALORIES, "kcal"),
    "active_energy_burned": (MetricType.CALORIES, "kcal"),
    "basal_energy": (MetricType.CALORIES, "kcal"),
    "basal_energy_burned": (MetricType.CALORIES, "kcal"),
    "weight": (MetricType.WEIGHT, "kg"),
    "body_mass": (MetricType.WEIGHT, "kg"),
    "blood_pressure": (MetricType.BLOOD_PRESSURE, "mmHg"),
    "oxygen": (MetricType.OXYGEN, "%"),
    "oxygen_saturation": (MetricType.OXYGEN, "%"),
    "temperature": (MetricType.TEMPERATURE, "°C"),
    "body_temperature": (MetricType.TEMPERATURE, "°C"),
    # Italiano
    "passi": (MetricType.STEPS, "passi"),
    "battito": (MetricType.HEART_RATE, "bpm"),
    "battito cardiaco": (MetricType.HEART_RATE, "bpm"),
    "frequenza cardiaca": (MetricType.HEART_RATE, "bpm"),
    "calorie": (MetricType.CALORIES, "kcal"),
    "calorie attive": (MetricType.CALORIES, "kcal"),
    "energia attiva": (MetricType.CALORIES, "kcal"),
    "peso": (MetricType.WEIGHT, "kg"),
    "pressione": (MetricType.BLOOD_PRESSURE, "mmHg"),
    "ossigeno": (MetricType.OXYGEN, "%"),
    "temperatura": (MetricType.TEMPERATURE, "°C"),
    # HealthKit identifiers (short)
    "stepcount": (MetricType.STEPS, "passi"),
    "heartrate": (MetricType.HEART_RATE, "bpm"),
    "restingheartrate": (MetricType.HEART_RATE, "bpm"),
    "activeenergyburned": (MetricType.CALORIES, "kcal"),
    "basalenergyburned": (MetricType.CALORIES, "kcal"),
    "bodymass": (MetricType.WEIGHT, "kg"),
    "oxygensaturation": (MetricType.OXYGEN, "%"),
    "bodytemperature": (MetricType.TEMPERATURE, "°C"),
}


@router.post("/shortcut")
async def unified_shortcut_webhook(
    request: Request,
    token: str = "",
    webhook_user: User = Depends(get_webhook_user_allow_query),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Endpoint unificato per iOS Shortcut — riceve tutte le metriche health.

    Autenticazione via query param: ?token=<API token gd_...> (o Bearer header).
    Niente header custom → compatibile con iOS Shortcuts.

    Formati accettati:
      1. Testo pipe-delimited (una riga per metrica):
         type|value|unit|date
         steps|8432|passi|2026-04-12T08:00:00+02:00
         heart_rate|72|bpm|2026-04-12T08:00:00+02:00
         active_energy|342|kcal|2026-04-12T08:00:00+02:00

      2. JSON:
         {"metrics": [{"type": "steps", "value": 8432, "unit": "passi", "date": "..."}]}
    """
    import json as _json

    # ── Parse body ──
    body = await request.body()
    body_str = body.decode("utf-8", errors="replace").strip()

    if not body_str:
        raise HTTPException(status_code=422, detail="Body vuoto")

    logger.info("Shortcut health: payload (%d chars): %s", len(body_str), body_str[:500])

    metrics_raw: list[dict] = []

    # Try JSON first
    try:
        raw = _json.loads(body_str)
        if isinstance(raw, dict):
            metrics_raw = raw.get("metrics") or raw.get("data") or []
        elif isinstance(raw, list):
            metrics_raw = raw
    except (_json.JSONDecodeError, ValueError):
        pass

    # Fallback: pipe-delimited text
    if not metrics_raw:
        for line in body_str.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split("|")
            if len(parts) >= 2:
                metrics_raw.append({
                    "type": parts[0].strip(),
                    "value": parts[1].strip(),
                    "unit": parts[2].strip() if len(parts) > 2 else "",
                    "date": parts[3].strip() if len(parts) > 3 else "",
                })

    if not metrics_raw:
        raise HTTPException(status_code=422, detail="Nessuna metrica trovata nel payload")

    # ── User: authenticated via webhook token ──
    user_id = webhook_user.id

    # ── Process metrics ──
    imported = 0
    skipped = 0
    errors: list[str] = []
    window = timedelta(minutes=1)

    for item in metrics_raw:
        type_raw = (item.get("type") or item.get("name") or "").strip()
        type_key = type_raw.lower().replace("_", "").replace(" ", "")

        # Cerca nella mappa (prova prima il raw, poi senza spazi/underscore)
        mapping = _UNIFIED_TYPE_MAP.get(type_raw.lower())
        if not mapping:
            mapping = _UNIFIED_TYPE_MAP.get(type_key)
        if not mapping:
            errors.append(f"Tipo sconosciuto: {type_raw}")
            continue

        metric_type, default_unit = mapping

        # Valore
        try:
            value = float(str(item.get("value", 0)).replace(",", "."))
        except (ValueError, TypeError):
            errors.append(f"{type_raw}: valore non valido ({item.get('value')})")
            continue

        if value <= 0:
            continue  # Ignora valori nulli/negativi

        unit = (item.get("unit") or default_unit).strip() or default_unit

        # Data
        date_str = item.get("date") or item.get("recorded_at") or item.get("start") or ""
        try:
            recorded_at = _parse_shortcut_date(str(date_str))
        except Exception:
            recorded_at = datetime.utcnow()

        # Deduplication: skip if same type+value within ±1 min
        dup_check = await db.execute(
            sa_select(HealthMetric.id).where(
                and_(
                    HealthMetric.user_id == user_id,
                    HealthMetric.metric_type == metric_type,
                    HealthMetric.recorded_at >= recorded_at - window,
                    HealthMetric.recorded_at <= recorded_at + window,
                )
            ).limit(1)
        )
        if dup_check.scalar_one_or_none():
            skipped += 1
            continue

        db.add(HealthMetric(
            user_id=user_id,
            metric_type=metric_type,
            value=value,
            unit=unit,
            recorded_at=recorded_at,
            source="ios_shortcut",
        ))
        imported += 1

    await db.commit()

    logger.info(
        "Shortcut health: imported=%d, skipped=%d, errors=%d",
        imported, skipped, len(errors),
    )

    return {
        "ok": True,
        "imported": imported,
        "skipped": skipped,
        "errors": errors[:10],
        "synced_at": datetime.now(timezone.utc).isoformat(),
    }
