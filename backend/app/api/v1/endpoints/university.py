"""Università (UOC) endpoints — corsi, esami/consegne, profilo CFU. Authenticated."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from uuid import UUID
from datetime import date

from app.core.database import get_db
from app.core.security import get_current_user, require_editor
from app.models.university import Corso, EventoUni, UniProfile, TipoEvento
from app.schemas.university import (
    CorsoCreate, CorsoUpdate, CorsoResponse,
    EventoCreate, EventoUpdate, EventoResponse,
    ProfiloResponse, ProfiloUpdate, UniDashboard,
)

router = APIRouter(
    prefix="/university",
    tags=["university"],
    dependencies=[Depends(get_current_user)],
)


async def _get_or_create_profile(db: AsyncSession) -> UniProfile:
    result = await db.execute(select(UniProfile).limit(1))
    profile = result.scalars().first()
    if not profile:
        profile = UniProfile()
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
    return profile


# ── Dashboard ──
@router.get("/dashboard", response_model=UniDashboard)
async def dashboard(db: AsyncSession = Depends(get_db)) -> UniDashboard:
    profile = await _get_or_create_profile(db)
    corsi = (await db.execute(select(Corso).order_by(Corso.ordine, Corso.nome))).scalars().all()
    today = date.today()
    prossimo = (await db.execute(
        select(EventoUni)
        .where(EventoUni.tipo == TipoEvento.ESAME, EventoUni.data >= today)
        .order_by(EventoUni.data)
        .limit(1)
    )).scalars().first()
    consegne = (await db.execute(
        select(EventoUni)
        .where(EventoUni.tipo == TipoEvento.CONSEGNA)
        .order_by(EventoUni.data)
    )).scalars().all()
    return UniDashboard(
        profilo=ProfiloResponse.model_validate(profile),
        corsi=[CorsoResponse.model_validate(c) for c in corsi],
        prossimo_esame=EventoResponse.model_validate(prossimo) if prossimo else None,
        consegne=[EventoResponse.model_validate(e) for e in consegne],
    )


# ── Academic scadenze (esami + consegne, by date) ──
@router.get("/scadenze", response_model=List[EventoResponse])
async def scadenze(db: AsyncSession = Depends(get_db)) -> List[EventoResponse]:
    eventi = (await db.execute(select(EventoUni).order_by(EventoUni.data))).scalars().all()
    return [EventoResponse.model_validate(e) for e in eventi]


# ── Corsi CRUD ──
@router.get("/corsi", response_model=List[CorsoResponse])
async def list_corsi(db: AsyncSession = Depends(get_db)) -> List[CorsoResponse]:
    corsi = (await db.execute(select(Corso).order_by(Corso.ordine, Corso.nome))).scalars().all()
    return [CorsoResponse.model_validate(c) for c in corsi]


@router.post("/corsi", response_model=CorsoResponse, status_code=201)
async def create_corso(body: CorsoCreate, db: AsyncSession = Depends(get_db), _: dict = Depends(require_editor)) -> CorsoResponse:
    c = Corso(**body.model_dump())
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return CorsoResponse.model_validate(c)


@router.patch("/corsi/{corso_id}", response_model=CorsoResponse)
async def update_corso(corso_id: UUID, body: CorsoUpdate, db: AsyncSession = Depends(get_db), _: dict = Depends(require_editor)) -> CorsoResponse:
    c = (await db.execute(select(Corso).where(Corso.id == corso_id))).scalars().first()
    if not c:
        raise HTTPException(status_code=404, detail="Corso non trovato")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(c, field, value)
    await db.commit()
    await db.refresh(c)
    return CorsoResponse.model_validate(c)


@router.delete("/corsi/{corso_id}", status_code=204)
async def delete_corso(corso_id: UUID, db: AsyncSession = Depends(get_db), _: dict = Depends(require_editor)):
    c = (await db.execute(select(Corso).where(Corso.id == corso_id))).scalars().first()
    if not c:
        raise HTTPException(status_code=404, detail="Corso non trovato")
    await db.delete(c)
    await db.commit()


# ── Eventi (esami/consegne) CRUD ──
@router.post("/eventi", response_model=EventoResponse, status_code=201)
async def create_evento(body: EventoCreate, db: AsyncSession = Depends(get_db), _: dict = Depends(require_editor)) -> EventoResponse:
    e = EventoUni(**body.model_dump())
    db.add(e)
    await db.commit()
    await db.refresh(e)
    return EventoResponse.model_validate(e)


@router.patch("/eventi/{evento_id}", response_model=EventoResponse)
async def update_evento(evento_id: UUID, body: EventoUpdate, db: AsyncSession = Depends(get_db), _: dict = Depends(require_editor)) -> EventoResponse:
    e = (await db.execute(select(EventoUni).where(EventoUni.id == evento_id))).scalars().first()
    if not e:
        raise HTTPException(status_code=404, detail="Evento non trovato")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(e, field, value)
    await db.commit()
    await db.refresh(e)
    return EventoResponse.model_validate(e)


@router.delete("/eventi/{evento_id}", status_code=204)
async def delete_evento(evento_id: UUID, db: AsyncSession = Depends(get_db), _: dict = Depends(require_editor)):
    e = (await db.execute(select(EventoUni).where(EventoUni.id == evento_id))).scalars().first()
    if not e:
        raise HTTPException(status_code=404, detail="Evento non trovato")
    await db.delete(e)
    await db.commit()


# ── Profilo ──
@router.get("/profilo", response_model=ProfiloResponse)
async def get_profilo(db: AsyncSession = Depends(get_db)) -> ProfiloResponse:
    return ProfiloResponse.model_validate(await _get_or_create_profile(db))


@router.patch("/profilo", response_model=ProfiloResponse)
async def update_profilo(body: ProfiloUpdate, db: AsyncSession = Depends(get_db), _: dict = Depends(require_editor)) -> ProfiloResponse:
    profile = await _get_or_create_profile(db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    await db.commit()
    await db.refresh(profile)
    return ProfiloResponse.model_validate(profile)
