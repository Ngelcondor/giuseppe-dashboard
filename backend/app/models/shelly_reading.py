"""Shelly energy snapshot — periodic reading of a device's cumulative counter.

The Shelly Cloud API exposes only live status (current power + the cumulative
`aenergy.total` counter), not historical per-period consumption. A Celery beat
task snapshots `aenergy.total` per device on a schedule; per-period consumption
is then computed as the delta between snapshots. Nothing is fabricated — if no
snapshots exist for a window, the consumption is simply unknown (0 / "in
raccolta").
"""
from sqlalchemy import Column, String, DateTime, Float, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime

from app.core.database import Base


class ShellyReading(Base):
    __tablename__ = "shelly_readings"
    __table_args__ = (
        Index("ix_shelly_readings_user_device_ts", "user_id", "device_id", "recorded_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    device_id = Column(String(64), nullable=False)
    name = Column(String(128), nullable=True)
    # Cumulative active-energy counter at snapshot time, in kWh (aenergy.total/1000)
    total_kwh = Column(Float, nullable=False)
    recorded_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
