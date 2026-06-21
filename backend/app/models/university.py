"""Università (UOC) models — corsi, eventi accademici (esami/consegne), profilo CFU."""
from sqlalchemy import Column, String, Integer, Date, DateTime, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from enum import Enum

from app.core.database import Base


class StatoCorso(str, Enum):
    IN_CORSO = "in_corso"
    IN_ESAME = "in_esame"
    CONSEGNA = "consegna"
    COMPLETATO = "completato"


class Corso(Base):
    __tablename__ = "uni_corsi"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    codice = Column(String(20), nullable=False)
    nome = Column(String(120), nullable=False)
    cfu = Column(Integer, nullable=False, default=6)
    docente = Column(String(120), nullable=True, default="")
    semestre = Column(String(40), nullable=True, default="")
    progress = Column(Integer, nullable=False, default=0)  # 0–100
    stato = Column(SQLEnum(StatoCorso), nullable=False, default=StatoCorso.IN_CORSO)
    prossimo = Column(String(200), nullable=True, default="")  # es. "Esame · 8 luglio"
    ordine = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TipoEvento(str, Enum):
    ESAME = "esame"
    CONSEGNA = "consegna"


class StatoEvento(str, Enum):
    DA_FARE = "da_fare"
    IN_CORSO = "in_corso"
    FATTO = "fatto"


class EventoUni(Base):
    """Unified academic deadline — an esame or a consegna with a date."""
    __tablename__ = "uni_eventi"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tipo = Column(SQLEnum(TipoEvento), nullable=False, default=TipoEvento.CONSEGNA)
    corso = Column(String(120), nullable=False)
    titolo = Column(String(200), nullable=False)
    descrizione = Column(String(500), nullable=True, default="")
    data = Column(Date, nullable=False, index=True)
    ora = Column(String(10), nullable=True, default="")
    aula = Column(String(60), nullable=True, default="")
    cfu = Column(Integer, nullable=True)
    stato = Column(SQLEnum(StatoEvento), nullable=False, default=StatoEvento.DA_FARE)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UniProfile(Base):
    """Singleton profile carrying CFU aggregates that don't derive from listed corsi."""
    __tablename__ = "uni_profilo"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    corso_laurea = Column(String(120), nullable=False, default="Ingegneria Informatica")
    semestre = Column(String(60), nullable=False, default="2º semestre · 2025–26")
    cfu_totali = Column(Integer, nullable=False, default=240)
    cfu_superati = Column(Integer, nullable=False, default=0)
    cfu_in_corso = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
