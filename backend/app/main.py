"""FastAPI main application."""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import traceback

from app.core.config import settings
from app.core.database import init_db, close_db, AsyncSessionLocal
# Import all models so SQLAlchemy registers them with Base.metadata
from app.models import (  # noqa: F401
    user, budget, deadline, scadenza, habit, mood,
)
from app.models import health, notification, api_token, study, university  # noqa: F401
from app.core.redis import init_redis, close_redis
from app.api.v1.router import router as api_v1_router

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def seed_admin_user() -> None:
    """Create the single admin user if the users table is empty."""
    from sqlalchemy.future import select
    from app.models.user import User
    from app.core.security import hash_password

    if not settings.ADMIN_PASSWORD:
        logger.warning("ADMIN_PASSWORD not set — skipping admin seed.")
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User))
        existing = result.scalars().first()
        if existing:
            logger.info("Admin user already exists — skipping seed.")
            return

        admin = User(
            email=settings.ADMIN_EMAIL,
            username="giuseppe",
            hashed_password=hash_password(settings.ADMIN_PASSWORD),
            is_active=True,
        )
        db.add(admin)
        await db.commit()
        logger.info(f"Admin user created: {settings.ADMIN_EMAIL}")


async def seed_university() -> None:
    """Seed Università (UOC) data once, if empty."""
    from datetime import date
    from sqlalchemy.future import select
    from app.models.university import (
        Corso, EventoUni, UniProfile, StatoCorso, TipoEvento, StatoEvento,
    )

    async with AsyncSessionLocal() as db:
        if (await db.execute(select(Corso).limit(1))).scalars().first():
            logger.info("Università già popolata — skip seed.")
            return

        db.add(UniProfile(
            corso_laurea="Ingegneria Informatica",
            semestre="2º semestre · 2025–26",
            cfu_totali=240, cfu_superati=138, cfu_in_corso=24,
        ))
        db.add_all([
            Corso(codice="SO.302", nome="Sistemi Operativi", cfu=6, docente="prof. Vidal",
                  semestre="2º sem", progress=72, stato=StatoCorso.IN_ESAME,
                  prossimo="Esame · 8 luglio", ordine=0),
            Corso(codice="BD.118", nome="Basi di Dati", cfu=6, docente="prof. Roca",
                  semestre="2º sem", progress=60, stato=StatoCorso.CONSEGNA,
                  prossimo="PEC2 · 26 giugno", ordine=1),
            Corso(codice="RC.214", nome="Reti di Calcolatori", cfu=6, docente="prof. Soler",
                  semestre="2º sem", progress=45, stato=StatoCorso.IN_CORSO,
                  prossimo="PEC3 · 4 luglio", ordine=2),
            Corso(codice="IS.330", nome="Ingegneria del Software", cfu=6, docente="prof. Ferrer",
                  semestre="2º sem", progress=30, stato=StatoCorso.IN_CORSO,
                  prossimo="lab UML · 2 luglio", ordine=3),
        ])
        db.add_all([
            EventoUni(tipo=TipoEvento.ESAME, corso="Sistemi Operativi", titolo="Esame — Sistemi Operativi",
                      descrizione="Scheduling, memoria, sincronizzazione", data=date(2026, 7, 8),
                      ora="09:00", aula="Aula 3.1", cfu=6, stato=StatoEvento.DA_FARE),
            EventoUni(tipo=TipoEvento.CONSEGNA, corso="Basi di Dati", titolo="PEC2 — Basi di Dati",
                      descrizione="Esercizi su query e normalizzazione", data=date(2026, 6, 26),
                      stato=StatoEvento.DA_FARE),
            EventoUni(tipo=TipoEvento.CONSEGNA, corso="Ingegneria del Software", titolo="Lab UML — Ingegneria del Software",
                      descrizione="Diagrammi delle classi e dei casi d'uso", data=date(2026, 7, 2),
                      stato=StatoEvento.IN_CORSO),
            EventoUni(tipo=TipoEvento.CONSEGNA, corso="Reti di Calcolatori", titolo="PEC3 — Reti di Calcolatori",
                      descrizione="Routing e livello di trasporto", data=date(2026, 7, 4),
                      stato=StatoEvento.DA_FARE),
        ])
        await db.commit()
        logger.info("Università seeded (corsi, eventi, profilo).")


async def _get_admin_user_id():
    """Return the admin user's id (UUID) or None if not seeded yet."""
    from sqlalchemy.future import select
    from app.models.user import User

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(User.email == settings.ADMIN_EMAIL)
        )
        user = result.scalars().first()
        if not user:
            result = await db.execute(select(User))
            user = result.scalars().first()
        return user.id if user else None


async def seed_budget() -> None:
    """Seed Budget (transactions + monthly goals) once, if empty.

    Mirrors the static Budget design page (Giugno 2026):
      Speso €642 / 900 · €258 rimasti
      Affitto · Barcellona €420/420, Spesa €150/200, Trasporti €42/80,
      Studio · HTB + libri €30/100, Svago €0/100
    User-scoped: rows use the admin user's id.
    """
    from datetime import date
    from sqlalchemy.future import select
    from app.models.budget import (
        Transaction, BudgetGoal, TransactionType, TransactionSource,
    )

    user_id = await _get_admin_user_id()
    if user_id is None:
        logger.warning("No admin user — skipping budget seed.")
        return

    async with AsyncSessionLocal() as db:
        if (await db.execute(select(BudgetGoal).limit(1))).scalars().first():
            logger.info("Budget già popolato — skip seed.")
            return

        month = date(2026, 6, 1)
        # Monthly goals (limits) — total 900
        db.add_all([
            BudgetGoal(user_id=user_id, category="Affitto · Barcellona", monthly_limit=420, month=month),
            BudgetGoal(user_id=user_id, category="Spesa", monthly_limit=200, month=month),
            BudgetGoal(user_id=user_id, category="Trasporti", monthly_limit=80, month=month),
            BudgetGoal(user_id=user_id, category="Studio · HTB + libri", monthly_limit=100, month=month),
            BudgetGoal(user_id=user_id, category="Svago", monthly_limit=100, month=month),
        ])

        def _exp(amount, category, desc, day):
            return Transaction(
                user_id=user_id, amount=amount, category=category, description=desc,
                transaction_type=TransactionType.EXPENSE, date=date(2026, 6, day),
                source=TransactionSource.MANUAL,
            )

        # Expenses summing to the per-category spent on the design page.
        db.add_all([
            _exp(420, "Affitto · Barcellona", "Affitto giugno", 1),
            _exp(85, "Spesa", "Spesa settimanale", 5),
            _exp(65, "Spesa", "Supermercato", 14),
            _exp(22, "Trasporti", "Abbonamento metro", 2),
            _exp(20, "Trasporti", "Ricarica trasporti", 12),
            _exp(20, "Studio · HTB + libri", "HTB VIP", 3),
            _exp(10, "Studio · HTB + libri", "Libro tecnico", 10),
        ])
        await db.commit()
        logger.info("Budget seeded (goals + transactions).")


async def seed_calendar() -> None:
    """Seed Calendar events once, if empty.

    Mirrors the static Calendario design page (Giugno–Luglio 2026):
      23 giu green session, 25 giu green session, 26 giu amber consegna,
      27 giu green session, 28 giu indigo, plus 'Prossimi eventi' list.
    User-scoped.
    """
    from datetime import datetime
    from sqlalchemy.future import select
    from app.models.calendar_event import CalendarEvent

    user_id = await _get_admin_user_id()
    if user_id is None:
        logger.warning("No admin user — skipping calendar seed.")
        return

    async with AsyncSessionLocal() as db:
        if (await db.execute(select(CalendarEvent).limit(1))).scalars().first():
            logger.info("Calendario già popolato — skip seed.")
            return

        GREEN = "#10B981"   # Sessioni
        AMBER = "#F59E0B"   # Consegne
        INDIGO = "#6366F1"  # Esami

        def ev(title, desc, start, end, color):
            return CalendarEvent(
                user_id=user_id, title=title, description=desc,
                start_time=start, end_time=end, color=color, source="manual",
            )

        db.add_all([
            ev("PEC2 · Basi di Dati", "Consegna",
               datetime(2026, 6, 26, 23, 59), datetime(2026, 6, 26, 23, 59), AMBER),
            ev("Ripasso SO · scheduling", "Sessione · 2h",
               datetime(2026, 6, 27, 10, 0), datetime(2026, 6, 27, 12, 0), GREEN),
            ev("Sessione studio · BD", "Sessione",
               datetime(2026, 6, 23, 16, 0), datetime(2026, 6, 23, 18, 0), GREEN),
            ev("Sessione studio · Reti", "Sessione",
               datetime(2026, 6, 25, 16, 0), datetime(2026, 6, 25, 18, 0), GREEN),
            ev("Lab UML · Ingegneria del Software", "Sessione",
               datetime(2026, 6, 28, 11, 0), datetime(2026, 6, 28, 13, 0), INDIGO),
            ev("Esame · Sistemi Operativi", "Aula 3.1 · 09:00",
               datetime(2026, 7, 8, 9, 0), datetime(2026, 7, 8, 11, 0), INDIGO),
            ev("Esame · CPTS", "Hack The Box",
               datetime(2026, 7, 31, 9, 0), datetime(2026, 7, 31, 18, 0), INDIGO),
        ])
        await db.commit()
        logger.info("Calendario seeded (eventi).")


async def seed_scadenze() -> None:
    """Seed financial (non-academic) Scadenze once, if empty.

    The academic scadenze come from /university; here we seed the recurring
    financial outflows shown on the Budget/Scadenze flows (Giugno 2026).
    NOT user-scoped (Scadenza has no user_id).
    """
    from sqlalchemy.future import select
    from app.models.scadenza import Scadenza, TipoScadenza

    async with AsyncSessionLocal() as db:
        if (await db.execute(select(Scadenza).limit(1))).scalars().first():
            logger.info("Scadenze già popolate — skip seed.")
            return

        db.add_all([
            Scadenza(desc="Affitto · Barcellona", mese="Giugno", scadenza_gg_mm="01/06",
                     importo=-420, tipo=TipoScadenza.RATA, pagato=True, note="Camera Barcellona"),
            Scadenza(desc="HTB VIP", mese="Giugno", scadenza_gg_mm="03/06",
                     importo=-20, tipo=TipoScadenza.ABBONAMENTO, pagato=True, note="Hack The Box"),
            Scadenza(desc="Abbonamento trasporti", mese="Giugno", scadenza_gg_mm="02/06",
                     importo=-22, tipo=TipoScadenza.ABBONAMENTO, pagato=True, note="Metro Barcellona"),
            Scadenza(desc="Spotify", mese="Giugno", scadenza_gg_mm="28/06",
                     importo=-11, tipo=TipoScadenza.ABBONAMENTO, pagato=False, note=""),
            Scadenza(desc="iCloud+", mese="Giugno", scadenza_gg_mm="30/06",
                     importo=-3, tipo=TipoScadenza.ABBONAMENTO, pagato=False, note=""),
        ])
        await db.commit()
        logger.info("Scadenze finanziarie seeded.")


async def seed_deadlines() -> None:
    """Seed non-academic Deadlines once, if empty.

    The Scadenze design page lists academic items (from /university) PLUS two
    certification items: 'CPTS — modulo Active Directory' (28 giu) and
    'Esame CPTS' (31 lug). Those are seeded here.
    User-scoped.
    """
    from datetime import date
    from sqlalchemy.future import select
    from app.models.deadline import Deadline, DeadlineCategory, DeadlinePriority

    user_id = await _get_admin_user_id()
    if user_id is None:
        logger.warning("No admin user — skipping deadlines seed.")
        return

    async with AsyncSessionLocal() as db:
        if (await db.execute(select(Deadline).limit(1))).scalars().first():
            logger.info("Deadlines già popolate — skip seed.")
            return

        db.add_all([
            Deadline(
                user_id=user_id, title="CPTS — modulo Active Directory",
                description="Studio · HTB · chiusura modulo",
                due_date=date(2026, 6, 28), category=DeadlineCategory.CTF,
                priority=DeadlinePriority.HIGH,
            ),
            Deadline(
                user_id=user_id, title="Esame CPTS",
                description="Certificazione · HTB",
                due_date=date(2026, 7, 31), category=DeadlineCategory.CERTIFICATION,
                priority=DeadlinePriority.MEDIUM,
            ),
        ])
        await db.commit()
        logger.info("Deadlines (certificazioni) seeded.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("Initializing database...")
    await init_db()
    await seed_admin_user()
    await seed_university()
    await seed_budget()
    await seed_calendar()
    await seed_scadenze()
    await seed_deadlines()

    logger.info("Connecting to Redis...")
    try:
        await init_redis()
    except Exception as e:
        logger.warning(f"Redis connection failed: {e}")

    yield

    logger.info("Closing database...")
    await close_db()

    logger.info("Closing Redis...")
    try:
        await close_redis()
    except Exception as e:
        logger.warning(f"Redis close failed: {e}")


# Disable OpenAPI docs in production to avoid information disclosure.
_docs_disabled = (
    os.getenv("DISABLE_DOCS", "").lower() == "true"
    or os.getenv("ENVIRONMENT", "").lower() == "production"
)
_docs_kwargs = (
    {"docs_url": None, "redoc_url": None, "openapi_url": None}
    if _docs_disabled
    else {}
)

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    description="Personal dashboard API for Giuseppe - ADHD/ASD cybersecurity student",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    **_docs_kwargs,
)

# Add CORS middleware - configured via settings/environment variables
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=settings.CORS_CREDENTIALS,
    allow_methods=settings.cors_methods_list,
    allow_headers=settings.cors_headers_list,
)


# Error handlers with CORS headers
def cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "*",
        "Access-Control-Allow-Headers": "*",
    }


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions with CORS headers."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=cors_headers(),
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions with CORS headers."""
    logger.error(f"Unhandled error: {exc}")
    logger.error(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"},
        headers=cors_headers(),
    )


# Health check endpoint
@app.get("/health", tags=["health"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


# Include API routers
app.include_router(api_v1_router)


@app.get("/", tags=["root"])
async def root():
    """Root endpoint."""
    return {
        "message": "Welcome to Giuseppe Dashboard API",
        "health": "/health",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
    )
