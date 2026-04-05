"""Scadenze budget model."""
from sqlalchemy import Column, String, Float, DateTime, Boolean, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from enum import Enum

from app.core.database import Base


class TipoScadenza(str, Enum):
    USCITA = "Uscita"
    ENTRATA = "Entrata"
    ABBONAMENTO = "Abbonamento"
    RATA = "Rata"
    RICORRENTE = "Ricorrente"


class Scadenza(Base):
    __tablename__ = "scadenze"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    desc = Column(String(255), nullable=False)
    mese = Column(String(20), nullable=False, index=True)
    scadenza_gg_mm = Column(String(10), nullable=False)  # es. "01/03"
    importo = Column(Float, nullable=False)
    tipo = Column(SQLEnum(TipoScadenza), nullable=False, default=TipoScadenza.USCITA)
    note = Column(String(500), nullable=True, default="")
    pagato = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
