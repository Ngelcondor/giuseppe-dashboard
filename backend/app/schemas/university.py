"""Università schemas."""
from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import date, datetime

from app.models.university import StatoCorso, TipoEvento, StatoEvento


# ── Corso ──
class CorsoBase(BaseModel):
    codice: str
    nome: str
    cfu: int = 6
    docente: Optional[str] = ""
    semestre: Optional[str] = ""
    progress: int = 0
    stato: StatoCorso = StatoCorso.IN_CORSO
    prossimo: Optional[str] = ""
    ordine: int = 0


class CorsoCreate(CorsoBase):
    pass


class CorsoUpdate(BaseModel):
    codice: Optional[str] = None
    nome: Optional[str] = None
    cfu: Optional[int] = None
    docente: Optional[str] = None
    semestre: Optional[str] = None
    progress: Optional[int] = None
    stato: Optional[StatoCorso] = None
    prossimo: Optional[str] = None
    ordine: Optional[int] = None


class CorsoResponse(CorsoBase):
    id: UUID
    class Config:
        from_attributes = True


# ── Evento (esame / consegna) ──
class EventoBase(BaseModel):
    tipo: TipoEvento = TipoEvento.CONSEGNA
    corso: str
    titolo: str
    descrizione: Optional[str] = ""
    data: date
    ora: Optional[str] = ""
    aula: Optional[str] = ""
    cfu: Optional[int] = None
    stato: StatoEvento = StatoEvento.DA_FARE


class EventoCreate(EventoBase):
    pass


class EventoUpdate(BaseModel):
    tipo: Optional[TipoEvento] = None
    corso: Optional[str] = None
    titolo: Optional[str] = None
    descrizione: Optional[str] = None
    data: Optional[date] = None
    ora: Optional[str] = None
    aula: Optional[str] = None
    cfu: Optional[int] = None
    stato: Optional[StatoEvento] = None


class EventoResponse(EventoBase):
    id: UUID
    class Config:
        from_attributes = True


# ── Profilo ──
class ProfiloResponse(BaseModel):
    corso_laurea: str
    semestre: str
    cfu_totali: int
    cfu_superati: int
    cfu_in_corso: int
    class Config:
        from_attributes = True


class ProfiloUpdate(BaseModel):
    corso_laurea: Optional[str] = None
    semestre: Optional[str] = None
    cfu_totali: Optional[int] = None
    cfu_superati: Optional[int] = None
    cfu_in_corso: Optional[int] = None


# ── Dashboard aggregate ──
class UniDashboard(BaseModel):
    profilo: ProfiloResponse
    corsi: List[CorsoResponse]
    prossimo_esame: Optional[EventoResponse] = None
    consegne: List[EventoResponse]
