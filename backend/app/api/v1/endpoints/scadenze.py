"""Scadenze budget endpoints — no auth required (auth disabled temporarily)."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.models.scadenza import Scadenza, TipoScadenza
from app.schemas.scadenza import ScadenzaCreate, ScadenzaResponse, ScadenzaUpdate

router = APIRouter(prefix="/scadenze", tags=["scadenze"])

INITIAL_DATA = [
    {"desc":"Affitto","mese":"Marzo","scadenza_gg_mm":"01/03","importo":-1410,"tipo":"Ricorrente"},
    {"desc":"Assicurazione medica","mese":"Marzo","scadenza_gg_mm":"01/03","importo":-158,"tipo":"Ricorrente"},
    {"desc":"Stipendio papà","mese":"Marzo","scadenza_gg_mm":"20/03","importo":1000,"tipo":"Entrata"},
    {"desc":"Spotify (abbonamento)","mese":"Marzo","scadenza_gg_mm":"20/03","importo":-6.49,"tipo":"Abbonamento"},
    {"desc":"Keychron (3 di 6)","mese":"Marzo","scadenza_gg_mm":"21/03","importo":-44.06,"tipo":"Rata"},
    {"desc":"Stipendio mamma","mese":"Marzo","scadenza_gg_mm":"23/03","importo":800,"tipo":"Entrata"},
    {"desc":"Vendita orologio","mese":"Marzo","scadenza_gg_mm":"23/03","importo":700,"tipo":"Entrata"},
    {"desc":"Psichiatra","mese":"Marzo","scadenza_gg_mm":"23/03","importo":-100,"tipo":"Uscita"},
    {"desc":"Psicologa","mese":"Marzo","scadenza_gg_mm":"25/03","importo":-80,"tipo":"Uscita"},
    {"desc":"Piano Metal (abbonamento)","mese":"Marzo","scadenza_gg_mm":"27/03","importo":-15.99,"tipo":"Abbonamento"},
    {"desc":"Lootbar (1 di 3)","mese":"Marzo","scadenza_gg_mm":"27/03","importo":-11.52,"tipo":"Rata"},
    {"desc":"Apple (abbonamento)","mese":"Marzo","scadenza_gg_mm":"28/03","importo":-14.99,"tipo":"Abbonamento"},
    {"desc":"PVH Stores (2 di 3)","mese":"Marzo","scadenza_gg_mm":"29/03","importo":-27.33,"tipo":"Rata"},
    {"desc":"Cauzione appartamento","mese":"Marzo","scadenza_gg_mm":"30/03","importo":-2820,"tipo":"Uscita"},
    {"desc":"Affitto","mese":"Aprile","scadenza_gg_mm":"01/04","importo":-1410,"tipo":"Ricorrente"},
    {"desc":"Assicurazione medica","mese":"Aprile","scadenza_gg_mm":"01/04","importo":-158,"tipo":"Ricorrente"},
    {"desc":"Spusu (abbonamento)","mese":"Aprile","scadenza_gg_mm":"04/04","importo":-5.98,"tipo":"Abbonamento"},
    {"desc":"Apple (abbonamento)","mese":"Aprile","scadenza_gg_mm":"07/04","importo":-9.99,"tipo":"Abbonamento"},
    {"desc":"Klarna","mese":"Aprile","scadenza_gg_mm":"11/04","importo":-17,"tipo":"Rata"},
    {"desc":"Orange","mese":"Aprile","scadenza_gg_mm":"13/04","importo":-68.75,"tipo":"Ricorrente"},
    {"desc":"Cofidis - CB Amazon (2 di 4)","mese":"Aprile","scadenza_gg_mm":"14/04","importo":-22.58,"tipo":"Rata"},
    {"desc":"Boxed ETC Ltd (2 di 3)","mese":"Aprile","scadenza_gg_mm":"15/04","importo":-31.43,"tipo":"Rata"},
    {"desc":"Lootbar (2 di 3)","mese":"Aprile","scadenza_gg_mm":"16/04","importo":-29.22,"tipo":"Rata"},
    {"desc":"Lootbar (2 di 3) b","mese":"Aprile","scadenza_gg_mm":"16/04","importo":-55.49,"tipo":"Rata"},
    {"desc":"OpenAI (abbonamento)","mese":"Aprile","scadenza_gg_mm":"18/04","importo":-8,"tipo":"Abbonamento"},
    {"desc":"Spotify (abbonamento)","mese":"Aprile","scadenza_gg_mm":"20/04","importo":-6.49,"tipo":"Abbonamento"},
    {"desc":"Stipendio papà","mese":"Aprile","scadenza_gg_mm":"20/04","importo":1400,"tipo":"Entrata"},
    {"desc":"Keychron (4 di 6)","mese":"Aprile","scadenza_gg_mm":"21/04","importo":-44.06,"tipo":"Rata"},
    {"desc":"Stipendio mamma","mese":"Aprile","scadenza_gg_mm":"23/04","importo":500,"tipo":"Entrata"},
    {"desc":"Piano Metal (abbonamento)","mese":"Aprile","scadenza_gg_mm":"27/04","importo":-15.99,"tipo":"Abbonamento"},
    {"desc":"Apple (abbonamento)","mese":"Aprile","scadenza_gg_mm":"28/04","importo":-14.99,"tipo":"Abbonamento"},
    {"desc":"Entrata vecchia cauzione","mese":"Aprile","scadenza_gg_mm":"30/04","importo":2000,"tipo":"Entrata"},
    {"desc":"Affitto","mese":"Maggio","scadenza_gg_mm":"01/05","importo":-1410,"tipo":"Ricorrente"},
    {"desc":"Assicurazione medica","mese":"Maggio","scadenza_gg_mm":"01/05","importo":-158,"tipo":"Ricorrente"},
    {"desc":"Spusu (abbonamento)","mese":"Maggio","scadenza_gg_mm":"04/05","importo":-5.98,"tipo":"Abbonamento"},
    {"desc":"Apple (abbonamento)","mese":"Maggio","scadenza_gg_mm":"07/05","importo":-9.99,"tipo":"Abbonamento"},
    {"desc":"Klarna","mese":"Maggio","scadenza_gg_mm":"11/05","importo":-17,"tipo":"Rata"},
    {"desc":"Orange","mese":"Maggio","scadenza_gg_mm":"13/05","importo":-68.75,"tipo":"Ricorrente"},
    {"desc":"Cofidis - CB Amazon","mese":"Maggio","scadenza_gg_mm":"14/05","importo":-22.58,"tipo":"Rata"},
    {"desc":"Boxed ETC Ltd (3 di 3)","mese":"Maggio","scadenza_gg_mm":"15/05","importo":-31.43,"tipo":"Rata"},
    {"desc":"Lootbar (3 di 3) a","mese":"Maggio","scadenza_gg_mm":"16/05","importo":-29.22,"tipo":"Rata"},
    {"desc":"Lootbar (3 di 3) b","mese":"Maggio","scadenza_gg_mm":"16/05","importo":-55.49,"tipo":"Rata"},
    {"desc":"OpenAI (abbonamento)","mese":"Maggio","scadenza_gg_mm":"18/05","importo":-8,"tipo":"Abbonamento"},
    {"desc":"Spotify (abbonamento)","mese":"Maggio","scadenza_gg_mm":"20/05","importo":-6.49,"tipo":"Abbonamento"},
    {"desc":"Keychron (4 di 6)","mese":"Maggio","scadenza_gg_mm":"21/05","importo":-44.06,"tipo":"Rata"},
    {"desc":"Piano Metal (abbonamento)","mese":"Maggio","scadenza_gg_mm":"27/05","importo":-15.99,"tipo":"Abbonamento"},
    {"desc":"Apple (abbonamento)","mese":"Maggio","scadenza_gg_mm":"28/05","importo":-14.99,"tipo":"Abbonamento"},
    {"desc":"Affitto","mese":"Giugno","scadenza_gg_mm":"01/06","importo":-1410,"tipo":"Ricorrente"},
    {"desc":"Assicurazione medica","mese":"Giugno","scadenza_gg_mm":"01/06","importo":-158,"tipo":"Ricorrente"},
    {"desc":"Spusu (abbonamento)","mese":"Giugno","scadenza_gg_mm":"04/06","importo":-5.98,"tipo":"Abbonamento"},
    {"desc":"Apple (abbonamento)","mese":"Giugno","scadenza_gg_mm":"07/06","importo":-9.99,"tipo":"Abbonamento"},
    {"desc":"Orange","mese":"Giugno","scadenza_gg_mm":"13/06","importo":-68.75,"tipo":"Ricorrente"},
    {"desc":"Cofidis - CB Amazon (3 di 4)","mese":"Giugno","scadenza_gg_mm":"14/06","importo":-22.58,"tipo":"Rata"},
    {"desc":"Boxed ETC Ltd (3 di 3)","mese":"Giugno","scadenza_gg_mm":"15/06","importo":-31.43,"tipo":"Rata"},
    {"desc":"Lootbar (3 di 3) a","mese":"Giugno","scadenza_gg_mm":"16/06","importo":-29.22,"tipo":"Rata"},
    {"desc":"Lootbar (3 di 3) b","mese":"Giugno","scadenza_gg_mm":"16/06","importo":-55.49,"tipo":"Rata"},
    {"desc":"OpenAI (abbonamento)","mese":"Giugno","scadenza_gg_mm":"18/06","importo":-8,"tipo":"Abbonamento"},
    {"desc":"Spotify (abbonamento)","mese":"Giugno","scadenza_gg_mm":"20/06","importo":-6.49,"tipo":"Abbonamento"},
    {"desc":"Keychron (5 di 6)","mese":"Giugno","scadenza_gg_mm":"21/06","importo":-44.06,"tipo":"Rata"},
    {"desc":"Piano Metal (abbonamento)","mese":"Giugno","scadenza_gg_mm":"27/06","importo":-15.99,"tipo":"Abbonamento"},
    {"desc":"Apple (abbonamento)","mese":"Giugno","scadenza_gg_mm":"28/06","importo":-14.99,"tipo":"Abbonamento"},
    {"desc":"Affitto","mese":"Luglio","scadenza_gg_mm":"01/07","importo":-1410,"tipo":"Ricorrente"},
    {"desc":"Assicurazione medica","mese":"Luglio","scadenza_gg_mm":"01/07","importo":-158,"tipo":"Ricorrente"},
    {"desc":"Spusu (abbonamento)","mese":"Luglio","scadenza_gg_mm":"04/07","importo":-5.98,"tipo":"Abbonamento"},
    {"desc":"Apple (abbonamento)","mese":"Luglio","scadenza_gg_mm":"07/07","importo":-9.99,"tipo":"Abbonamento"},
    {"desc":"Orange","mese":"Luglio","scadenza_gg_mm":"13/07","importo":-68.75,"tipo":"Ricorrente"},
    {"desc":"Cofidis - CB Amazon (4 di 4)","mese":"Luglio","scadenza_gg_mm":"14/07","importo":-22.58,"tipo":"Rata"},
    {"desc":"OpenAI (abbonamento)","mese":"Luglio","scadenza_gg_mm":"18/07","importo":-8,"tipo":"Abbonamento"},
    {"desc":"Spotify (abbonamento)","mese":"Luglio","scadenza_gg_mm":"20/07","importo":-6.49,"tipo":"Abbonamento"},
    {"desc":"Keychron (6 di 6)","mese":"Luglio","scadenza_gg_mm":"21/07","importo":-44.06,"tipo":"Rata"},
    {"desc":"Piano Metal (abbonamento)","mese":"Luglio","scadenza_gg_mm":"27/07","importo":-15.99,"tipo":"Abbonamento"},
    {"desc":"Apple (abbonamento)","mese":"Luglio","scadenza_gg_mm":"28/07","importo":-14.99,"tipo":"Abbonamento"},
    {"desc":"Affitto","mese":"Agosto","scadenza_gg_mm":"01/08","importo":-1410,"tipo":"Ricorrente"},
    {"desc":"Assicurazione medica","mese":"Agosto","scadenza_gg_mm":"01/08","importo":-158,"tipo":"Ricorrente"},
    {"desc":"Spusu (abbonamento)","mese":"Agosto","scadenza_gg_mm":"04/08","importo":-5.98,"tipo":"Abbonamento"},
    {"desc":"Apple (abbonamento)","mese":"Agosto","scadenza_gg_mm":"07/08","importo":-9.99,"tipo":"Abbonamento"},
    {"desc":"Orange","mese":"Agosto","scadenza_gg_mm":"13/08","importo":-68.75,"tipo":"Ricorrente"},
    {"desc":"OpenAI (abbonamento)","mese":"Agosto","scadenza_gg_mm":"18/08","importo":-8,"tipo":"Abbonamento"},
    {"desc":"Spotify (abbonamento)","mese":"Agosto","scadenza_gg_mm":"20/08","importo":-6.49,"tipo":"Abbonamento"},
    {"desc":"Piano Metal (abbonamento)","mese":"Agosto","scadenza_gg_mm":"27/08","importo":-15.99,"tipo":"Abbonamento"},
    {"desc":"Apple (abbonamento)","mese":"Agosto","scadenza_gg_mm":"28/08","importo":-14.99,"tipo":"Abbonamento"},
    {"desc":"Affitto","mese":"Settembre","scadenza_gg_mm":"01/09","importo":-1410,"tipo":"Ricorrente"},
    {"desc":"Assicurazione medica","mese":"Settembre","scadenza_gg_mm":"01/09","importo":-158,"tipo":"Ricorrente"},
    {"desc":"Spusu (abbonamento)","mese":"Settembre","scadenza_gg_mm":"04/09","importo":-5.98,"tipo":"Abbonamento"},
    {"desc":"Apple (abbonamento)","mese":"Settembre","scadenza_gg_mm":"07/09","importo":-9.99,"tipo":"Abbonamento"},
    {"desc":"Orange","mese":"Settembre","scadenza_gg_mm":"13/09","importo":-68.75,"tipo":"Ricorrente"},
    {"desc":"OpenAI (abbonamento)","mese":"Settembre","scadenza_gg_mm":"18/09","importo":-8,"tipo":"Abbonamento"},
    {"desc":"Spotify (abbonamento)","mese":"Settembre","scadenza_gg_mm":"20/09","importo":-6.49,"tipo":"Abbonamento"},
    {"desc":"Piano Metal (abbonamento)","mese":"Settembre","scadenza_gg_mm":"27/09","importo":-15.99,"tipo":"Abbonamento"},
    {"desc":"Apple (abbonamento)","mese":"Settembre","scadenza_gg_mm":"28/09","importo":-14.99,"tipo":"Abbonamento"},
    {"desc":"Affitto","mese":"Ottobre","scadenza_gg_mm":"01/10","importo":-1410,"tipo":"Ricorrente"},
    {"desc":"Assicurazione medica","mese":"Ottobre","scadenza_gg_mm":"01/10","importo":-158,"tipo":"Ricorrente"},
    {"desc":"Spusu (abbonamento)","mese":"Ottobre","scadenza_gg_mm":"04/10","importo":-5.98,"tipo":"Abbonamento"},
    {"desc":"Apple (abbonamento)","mese":"Ottobre","scadenza_gg_mm":"07/10","importo":-9.99,"tipo":"Abbonamento"},
    {"desc":"Orange","mese":"Ottobre","scadenza_gg_mm":"13/10","importo":-68.75,"tipo":"Ricorrente"},
    {"desc":"OpenAI (abbonamento)","mese":"Ottobre","scadenza_gg_mm":"18/10","importo":-8,"tipo":"Abbonamento"},
    {"desc":"Spotify (abbonamento)","mese":"Ottobre","scadenza_gg_mm":"20/10","importo":-6.49,"tipo":"Abbonamento"},
    {"desc":"Piano Metal (abbonamento)","mese":"Ottobre","scadenza_gg_mm":"27/10","importo":-15.99,"tipo":"Abbonamento"},
    {"desc":"Apple (abbonamento)","mese":"Ottobre","scadenza_gg_mm":"28/10","importo":-14.99,"tipo":"Abbonamento"},
    {"desc":"Affitto","mese":"Novembre","scadenza_gg_mm":"01/11","importo":-1410,"tipo":"Ricorrente"},
    {"desc":"Assicurazione medica","mese":"Novembre","scadenza_gg_mm":"01/11","importo":-158,"tipo":"Ricorrente"},
    {"desc":"Spusu (abbonamento)","mese":"Novembre","scadenza_gg_mm":"04/11","importo":-5.98,"tipo":"Abbonamento"},
    {"desc":"Apple (abbonamento)","mese":"Novembre","scadenza_gg_mm":"07/11","importo":-9.99,"tipo":"Abbonamento"},
    {"desc":"Orange","mese":"Novembre","scadenza_gg_mm":"13/11","importo":-68.75,"tipo":"Ricorrente"},
    {"desc":"OpenAI (abbonamento)","mese":"Novembre","scadenza_gg_mm":"18/11","importo":-8,"tipo":"Abbonamento"},
    {"desc":"Spotify (abbonamento)","mese":"Novembre","scadenza_gg_mm":"20/11","importo":-6.49,"tipo":"Abbonamento"},
    {"desc":"Piano Metal (abbonamento)","mese":"Novembre","scadenza_gg_mm":"27/11","importo":-15.99,"tipo":"Abbonamento"},
    {"desc":"Apple (abbonamento)","mese":"Novembre","scadenza_gg_mm":"28/11","importo":-14.99,"tipo":"Abbonamento"},
    {"desc":"Affitto","mese":"Dicembre","scadenza_gg_mm":"01/12","importo":-1410,"tipo":"Ricorrente"},
    {"desc":"Assicurazione medica","mese":"Dicembre","scadenza_gg_mm":"01/12","importo":-158,"tipo":"Ricorrente"},
    {"desc":"Spusu (abbonamento)","mese":"Dicembre","scadenza_gg_mm":"04/12","importo":-5.98,"tipo":"Abbonamento"},
    {"desc":"Apple (abbonamento)","mese":"Dicembre","scadenza_gg_mm":"07/12","importo":-9.99,"tipo":"Abbonamento"},
    {"desc":"Orange","mese":"Dicembre","scadenza_gg_mm":"13/12","importo":-68.75,"tipo":"Ricorrente"},
    {"desc":"OpenAI (abbonamento)","mese":"Dicembre","scadenza_gg_mm":"18/12","importo":-8,"tipo":"Abbonamento"},
    {"desc":"Spotify (abbonamento)","mese":"Dicembre","scadenza_gg_mm":"20/12","importo":-6.49,"tipo":"Abbonamento"},
    {"desc":"Piano Metal (abbonamento)","mese":"Dicembre","scadenza_gg_mm":"27/12","importo":-15.99,"tipo":"Abbonamento"},
    {"desc":"Apple (abbonamento)","mese":"Dicembre","scadenza_gg_mm":"28/12","importo":-14.99,"tipo":"Abbonamento"},
]


@router.get("", response_model=List[ScadenzaResponse])
async def list_scadenze(db: AsyncSession = Depends(get_db)) -> List[ScadenzaResponse]:
    result = await db.execute(select(Scadenza).order_by(Scadenza.mese, Scadenza.scadenza_gg_mm))
    return [ScadenzaResponse.model_validate(s) for s in result.scalars().all()]


@router.post("/seed", status_code=201)
async def seed_scadenze(db: AsyncSession = Depends(get_db)):
    """Populate DB with initial data if empty."""
    count = await db.execute(select(Scadenza))
    if count.scalars().first():
        return {"message": "Already seeded", "count": 0}
    items = [
        Scadenza(
            desc=d["desc"],
            mese=d["mese"],
            scadenza_gg_mm=d["scadenza_gg_mm"],
            importo=d["importo"],
            tipo=TipoScadenza(d["tipo"]),
            note="",
            pagato=False,
        )
        for d in INITIAL_DATA
    ]
    db.add_all(items)
    await db.commit()
    return {"message": "Seeded", "count": len(items)}


@router.post("", response_model=ScadenzaResponse, status_code=201)
async def create_scadenza(body: ScadenzaCreate, db: AsyncSession = Depends(get_db)) -> ScadenzaResponse:
    s = Scadenza(**body.model_dump())
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return ScadenzaResponse.model_validate(s)


@router.patch("/{scadenza_id}", response_model=ScadenzaResponse)
async def update_scadenza(scadenza_id: UUID, body: ScadenzaUpdate, db: AsyncSession = Depends(get_db)) -> ScadenzaResponse:
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
async def delete_scadenza(scadenza_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Scadenza).where(Scadenza.id == scadenza_id))
    s = result.scalars().first()
    if not s:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(s)
    await db.commit()
