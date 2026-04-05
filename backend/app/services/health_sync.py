"""Apple Health data synchronization service."""
import csv
from io import StringIO
from typing import List
from datetime import datetime

from app.models.health import HealthMetric, MetricType
from app.schemas.health import HealthMetricCreate


async def parse_apple_health_export(data: str) -> List[HealthMetricCreate]:
    """
    Parse Apple Health export data (CSV format).

    Args:
        data: CSV data from Apple Health export.

    Returns:
        List of HealthMetricCreate objects.
    """
    metrics = []
    reader = csv.DictReader(StringIO(data))

    for row in reader:
        try:
            # Map Apple Health types to our enum
            metric_type_map = {
                "HKQuantityTypeIdentifierHeartRate": MetricType.HEART_RATE,
                "HKCategoryTypeIdentifierSleepAnalysis": MetricType.SLEEP,
                "HKWorkoutTypeIdentifier": MetricType.WORKOUT,
                "HKQuantityTypeIdentifierBodyMass": MetricType.WEIGHT,
                "HKQuantityTypeIdentifierActiveEnergyBurned": MetricType.CALORIES,
                "HKQuantityTypeIdentifierStepCount": MetricType.STEPS,
            }

            metric_type = metric_type_map.get(row.get("type"))
            if not metric_type:
                continue

            recorded_at = datetime.fromisoformat(row.get("startDate", ""))

            metric = HealthMetricCreate(
                metric_type=metric_type,
                value=float(row.get("value", 0)),
                unit=row.get("unit", ""),
                recorded_at=recorded_at,
                source="apple_watch",
            )
            metrics.append(metric)
        except (ValueError, KeyError, TypeError):
            continue

    return metrics
