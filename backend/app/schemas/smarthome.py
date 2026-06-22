"""Smart Home schemas — Philips Hue lights + Shelly consumption.

No persisted models: this slice is a read/control proxy over external
APIs whose credentials live in the shared settings store (keys 'hue' and
'shelly'). When a config is missing/empty the endpoints return an honest
not-connected payload — never fabricated values.
"""
from pydantic import BaseModel
from typing import List, Optional


# ── Status ──
class SmartHomeStatus(BaseModel):
    hue_connected: bool = False
    shelly_connected: bool = False


# ── Hue ──
class HueLight(BaseModel):
    id: str
    name: str
    on: bool
    bri: int  # 1–254 (Hue brightness scale)
    reachable: bool = True


class HueLightsResponse(BaseModel):
    connected: bool
    lights: List[HueLight] = []
    error: Optional[str] = None


class HueLightUpdate(BaseModel):
    on: Optional[bool] = None
    bri: Optional[int] = None  # 1–254


# ── Shelly ──
class ShellyDevice(BaseModel):
    device_id: str
    name: str
    power_w: float        # live active power (W)
    total_kwh: float      # cumulative energy counter (kWh)
    output: bool = False  # relay on/off
    online: bool = True


class ShellyDevicesResponse(BaseModel):
    connected: bool
    devices: List[ShellyDevice] = []
    total_power_w: float = 0.0
    total_kwh: float = 0.0
    error: Optional[str] = None


class ShellyConsumptionDevice(BaseModel):
    device_id: str
    name: str
    consumption_kwh: float


class ShellyConsumptionResponse(BaseModel):
    connected: bool
    period: str  # day | week | month
    total_kwh: float = 0.0
    devices: List[ShellyConsumptionDevice] = []
    data_since: Optional[str] = None  # ISO ts of the earliest snapshot (honesty)
    samples: int = 0                  # snapshots in the window
    error: Optional[str] = None
