"""Scadenze budget endpoints — authenticated."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.core.security import get_current_user, require_editor
from app.models.scadenza import Scadenza
from app.schemas.scadenza import ScadenzaCreate, ScadenzaResponse, ScadenzaUpdate

router = APIRouter(
    prefix="/scadenze",
    tags=["scadenze"],
    dependencies=[Depends(get_current_user)],
)


@router.get("", response_model=List[ScadenzaResponse])
async def list_scadenze(db: AsyncSession = Depends(get_db)) -> List[ScadenzaResponse]:
    result = await db.execute(select(Scadenza).order_by(Scadenza.mese, Scadenza.scadenza_gg_mm))
    return [ScadenzaResponse.model_validate(s) for s in result.scalars().all()]


@router.post("", response_model=ScadenzaResponse, status_code=201)
async def create_scadenza(body: ScadenzaCreate, db: AsyncSession = Depends(get_db), _: dict = Depends(require_editor)) -> ScadenzaResponse:
    s = Scadenza(**body.model_dump())
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return ScadenzaResponse.model_validate(s)


@router.patch("/{scadenza_id}", response_model=ScadenzaResponse)
async def update_scadenza(scadenza_id: UUID, body: ScadenzaUpdate, db: AsyncSession = Depends(get_db), _: dict = Depends(require_editor)) -> ScadenzaResponse:
    result = await db.execute(select(Scadenza).where(Scadenza.id == scadenza_id))
    s = result.scalars().first()
    if not s:
        raise HTTPException(status_code=404, detail="Not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(s, field, value)
    await db.commit()
    await db.refresh(s)
    return ScadenzaResponse.model_validate(s)


@router.delete("/{scadenza_id}", status_code=204)
async def delete_scadenza(scadenza_id: UUID, db: AsyncSession = Depends(get_db), _: dict = Depends(require_editor)):
    result = await db.execute(select(Scadenza).where(Scadenza.id == scadenza_id))
    s = result.scalars().first()
    if not s:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(s)
    await db.commit()
