"""Apple Health import endpoints."""
import logging
import xml.etree.ElementTree as ET
from io import StringIO
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from typing import List

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
