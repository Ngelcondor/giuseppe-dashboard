"""Scadenza schemas."""
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.models.scadenza import TipoScadenza


class ScadenzaCreate(BaseModel):
    desc: str
    mese: str
    scadenza_gg_mm: str
    importo: float
    tipo: TipoScadenza = TipoScadenza.USCITA
    note: Optional[str] = ""


class ScadenzaUpdate(BaseModel):
    desc: Optional[str] = None
    mese: Optional[str] = None
    scadenza_gg_mm: Optional[str] = None
    importo: Optional[float] = None
    tipo: Optional[TipoScadenza] = None
    note: Optional[str] = None
    pagato: Optional[bool] = None


class ScadenzaResponse(BaseModel):
    id: UUID
    desc: str
    mese: str
    scadenza_gg_mm: str
    importo: float
    tipo: TipoScadenza
    note: str
    pagato: bool
    created_at: datetime

    class Config:
        from_attributes = True
