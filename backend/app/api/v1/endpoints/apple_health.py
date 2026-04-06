"""Apple Health import endpoints."""
import logging
import xml.etree.ElementTree as ET
from io import StringIO
from fastapi import APIRouter, Depends, HTTPException, Request, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select as sa_select, and_, func
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from pydantic import BaseModel

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.health import HealthMetric, MetricType
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

_bearer_scheme = HTTPBearer(auto_error=False)


async def _verify_webhook_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> None:
    """Raise 401 if the Bearer token does not match APPLE_HEALTH_WEBHOOK_SECRET."""
    secret = settings.APPLE_HEALTH_WEBHOOK_SECRET
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Webhook non configurato: imposta APPLE_HEALTH_WEBHOOK_SECRET nel .env del server.",
        )
    if not credentials or credentials.credentials != secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token non valido.",
            headers={"WWW-Authenticate": "Bearer"},
        )


@router.post("/webhook", dependencies=[Depends(_verify_webhook_token)])
async def apple_health_webhook(
    payload: AppleHealthWebhookPayload,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Receive real-time health data from an iOS Shortcut.

    The Shortcut runs hourly and POSTs the latest metrics.
    This endpoint is authenticated with a static Bearer token
    (APPLE_HEALTH_WEBHOOK_SECRET) and does NOT require a user JWT —
    the dashboard is single-user so we look up the admin user automatically.
    """
    from app.models.user import User

    # Resolve the single admin user
    result = await db.execute(sa_select(User).limit(1))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Nessun utente trovato.")

    user_id = user.id
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
    current_user: dict = Depends(get_current_user),
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
    current_user: dict = Depends(get_current_user),
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
