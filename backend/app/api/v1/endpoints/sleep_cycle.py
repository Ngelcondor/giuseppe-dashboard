"""Sleep Cycle integration via iOS Shortcut webhook.

Sleep Cycle scrive i dati sonno in Apple HealthKit. Uno Shortcut iOS li legge
e li POSTa a questo endpoint, che li salva come SleepSession con source='sleep_cycle'.

Autenticazione: stesso Bearer token di APPLE_HEALTH_WEBHOOK_SECRET.
"""
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select as sa_select, and_
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.core.config import settings
from app.core.database import get_db
from app.models.health import SleepSession, SleepPhaseEntry, SleepPhase
from app.schemas.health import (
    SleepCycleWebhookPayload,
    SleepCycleSyncResponse,
    SleepSessionResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/health/sleep/sync", tags=["sleep-cycle"])

_bearer_scheme = HTTPBearer(auto_error=False)


async def _verify_webhook_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> None:
    """Verifica il Bearer token — riusa lo stesso secret del webhook Apple Health."""
    secret = settings.APPLE_HEALTH_WEBHOOK_SECRET
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Webhook non configurato: imposta APPLE_HEALTH_WEBHOOK_SECRET nel .env.",
        )
    if not credentials or credentials.credentials != secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token non valido.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def _parse_date(date_str: str) -> datetime:
    """Parse ISO-8601 date string da iOS Shortcut. Ritorna naive UTC."""
    if not date_str:
        return datetime.utcnow()

    s = date_str.strip()

    # Try fromisoformat (handles +02:00 style offsets)
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        if dt.tzinfo:
            return dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt
    except ValueError:
        pass

    # Common ISO formats
    for fmt in [
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%d %H:%M:%S %z",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
    ]:
        try:
            dt = datetime.strptime(s, fmt)
            if dt.tzinfo:
                return dt.astimezone(timezone.utc).replace(tzinfo=None)
            return dt
        except ValueError:
            pass

    logger.warning("Could not parse date '%s', using now", date_str)
    return datetime.utcnow()


def _map_phase(phase_str: str) -> SleepPhase:
    """Map phase string to SleepPhase enum."""
    mapping = {
        "awake": SleepPhase.AWAKE,
        "light": SleepPhase.LIGHT,
        "deep": SleepPhase.DEEP,
        "rem": SleepPhase.REM,
        # HealthKit aliases
        "inbed": SleepPhase.AWAKE,
        "asleepcore": SleepPhase.LIGHT,
        "asleepdeep": SleepPhase.DEEP,
        "asleeprem": SleepPhase.REM,
        "awakeinsleep": SleepPhase.AWAKE,
    }
    return mapping.get(phase_str.lower().replace(" ", ""), SleepPhase.LIGHT)


@router.post("/sleep-cycle/debug", dependencies=[Depends(_verify_webhook_token)])
async def sleep_cycle_debug(request: Request) -> dict:
    """Debug endpoint: logga headers e body grezzi per capire cosa manda iOS."""
    body_bytes = await request.body()
    body_str = body_bytes.decode("utf-8", errors="replace")
    headers = dict(request.headers)
    logger.warning("=== SLEEP CYCLE DEBUG ===")
    logger.warning("Headers: %s", headers)
    logger.warning("Body raw: %s", body_str)
    try:
        parsed = json.loads(body_str)
        logger.warning("Body parsed OK: %s", parsed)
    except Exception as e:
        logger.warning("Body parse FAILED: %s", e)
    return {"headers": headers, "body": body_str}


@router.post(
    "/sleep-cycle",
    response_model=SleepCycleSyncResponse,
    dependencies=[Depends(_verify_webhook_token)],
)
async def sleep_cycle_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> SleepCycleSyncResponse:
    """Ricevi dati sonno da Sleep Cycle tramite iOS Shortcut.

    Lo Shortcut gira ogni mattina (o su trigger) e POSTa i dati della
    notte precedente letti da HealthKit + eventuali extra da Sleep Cycle.

    Deduplicazione: se esiste già una sessione con sleep_start entro ±5 min,
    aggiorna i campi SC-specifici invece di crearne una nuova.
    """
    from app.models.user import User

    # Leggi e parsa il body manualmente per gestire qualsiasi formato iOS
    body_bytes = await request.body()
    body_str = body_bytes.decode("utf-8", errors="replace")
    logger.info("Sleep Cycle webhook raw body: %s", body_str)

    try:
        raw = json.loads(body_str)
    except json.JSONDecodeError as e:
        logger.error("Body non è JSON valido: %s | body: %s", e, body_str)
        raise HTTPException(status_code=400, detail=f"Body non è JSON valido: {e}")

    # Costruisci il payload dal dizionario grezzo
    try:
        payload = SleepCycleWebhookPayload(**raw)
    except Exception as e:
        logger.error("Payload non valido: %s | raw: %s", e, raw)
        raise HTTPException(status_code=422, detail=f"Payload non valido: {e}")

    # Resolve single admin user
    result = await db.execute(sa_select(User).limit(1))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Nessun utente trovato.",
        )

    user_id = user.id
    sleep_start = _parse_date(payload.sleep_start)
    sleep_end = _parse_date(payload.sleep_end)
    # Auto-swap se lo Shortcut manda i timestamp invertiti
    if sleep_start > sleep_end:
        logger.info("Timestamps invertiti (start=%s > end=%s), scambio automatico", sleep_start, sleep_end)
        sleep_start, sleep_end = sleep_end, sleep_start
    window = timedelta(minutes=5)

    # --- Deduplication check ---
    dup_result = await db.execute(
        sa_select(SleepSession).where(
            and_(
                SleepSession.user_id == user_id,
                SleepSession.sleep_start >= sleep_start - window,
                SleepSession.sleep_start <= sleep_start + window,
            )
        ).limit(1)
    )
    existing = dup_result.scalar_one_or_none()

    if existing:
        # Aggiorna solo i campi Sleep Cycle-specifici (arricchimento)
        existing.source = "sleep_cycle"

        # Ricalcola sempre timestamps e duration dai dati più recenti
        existing.sleep_start = sleep_start
        existing.sleep_end = sleep_end
        dur = max(0, int((sleep_end - sleep_start).total_seconds() / 60))
        existing.duration_minutes = dur
        tib = payload.time_in_bed_minutes or dur
        existing.time_in_bed_minutes = tib
        existing.sleep_efficiency = round(dur / tib * 100, 1) if tib > 0 else None

        # Aggiorna fasi se fornite dal payload
        if payload.deep_minutes is not None and payload.deep_minutes > 0:
            existing.deep_minutes = payload.deep_minutes
        if payload.rem_minutes is not None and payload.rem_minutes > 0:
            existing.rem_minutes = payload.rem_minutes
        if payload.light_minutes is not None and payload.light_minutes > 0:
            existing.light_minutes = payload.light_minutes
        if payload.awake_minutes is not None and payload.awake_minutes > 0:
            existing.awake_minutes = payload.awake_minutes

        # Ricalcola quality score con i dati aggiornati
        existing.quality_score = _calculate_quality_score(
            dur,
            existing.deep_minutes or 0,
            existing.rem_minutes or 0,
            existing.sleep_efficiency,
            payload.sc_quality_score or existing.sc_quality_score,
        )

        existing.sc_quality_score = payload.sc_quality_score or existing.sc_quality_score
        existing.snoring_minutes = payload.snoring_minutes or existing.snoring_minutes
        existing.regularity_score = payload.regularity_score or existing.regularity_score
        existing.sleep_aid_used = payload.sleep_aid_used or existing.sleep_aid_used
        existing.alarm_mode = payload.alarm_mode or existing.alarm_mode
        existing.wake_up_mood = payload.wake_up_mood or existing.wake_up_mood
        existing.heart_rate_lowest = payload.heart_rate_lowest or existing.heart_rate_lowest
        existing.steps_to_sleep = payload.steps_to_sleep or existing.steps_to_sleep

        if payload.snoring_minutes and dur > 0:
            existing.snoring_pct = round(
                payload.snoring_minutes / dur * 100, 1
            )

        if payload.mood_on_wake:
            existing.mood_on_wake = payload.mood_on_wake
        if payload.notes:
            existing.notes = payload.notes

        db.add(existing)
        await db.commit()
        await db.refresh(existing)

        return SleepCycleSyncResponse(
            ok=True,
            session_id=str(existing.id),
            imported=False,
            skipped=False,
            reason="Sessione esistente aggiornata con dati Sleep Cycle",
            synced_at=datetime.now(timezone.utc).isoformat(),
        )

    # --- Crea nuova sessione ---
    # Calcola duration dai timestamp se non fornita direttamente
    duration = payload.duration_minutes
    if not duration:
        duration = max(0, int((sleep_end - sleep_start).total_seconds() / 60))
    time_in_bed = payload.time_in_bed_minutes or duration

    # Calcola efficienza
    sleep_efficiency = round(duration / time_in_bed * 100, 1) if time_in_bed > 0 else None

    # Calcola snoring %
    snoring_pct = None
    if payload.snoring_minutes and duration > 0:
        snoring_pct = round(payload.snoring_minutes / duration * 100, 1)

    # Calcola quality score interno basato sulle fasi (se SC non lo fornisce)
    quality_score = _calculate_quality_score(
        duration, payload.deep_minutes, payload.rem_minutes,
        sleep_efficiency, payload.sc_quality_score,
    )

    session = SleepSession(
        user_id=user_id,
        sleep_start=sleep_start,
        sleep_end=sleep_end,
        duration_minutes=duration,
        quality_score=quality_score,
        time_in_bed_minutes=time_in_bed,
        sleep_efficiency=sleep_efficiency,
        awake_minutes=payload.awake_minutes,
        light_minutes=payload.light_minutes,
        deep_minutes=payload.deep_minutes,
        rem_minutes=payload.rem_minutes,
        source="sleep_cycle",
        sc_quality_score=payload.sc_quality_score,
        snoring_minutes=payload.snoring_minutes,
        snoring_pct=snoring_pct,
        regularity_score=payload.regularity_score,
        sleep_aid_used=payload.sleep_aid_used,
        alarm_mode=payload.alarm_mode,
        wake_up_mood=payload.wake_up_mood,
        heart_rate_lowest=payload.heart_rate_lowest,
        steps_to_sleep=payload.steps_to_sleep,
        mood_on_wake=payload.mood_on_wake,
        notes=payload.notes,
    )
    db.add(session)
    await db.flush()

    # Aggiungi fasi dettagliate se fornite
    if payload.phases:
        for p in payload.phases:
            phase_entry = SleepPhaseEntry(
                session_id=session.id,
                phase=_map_phase(p.phase),
                start_time=_parse_date(p.start_time),
                end_time=_parse_date(p.end_time),
                duration_minutes=p.duration_minutes,
            )
            db.add(phase_entry)

    await db.commit()
    await db.refresh(session)

    logger.info(
        "Sleep Cycle sync: nuova sessione %s (%s → %s, quality=%s, sc_quality=%s)",
        session.id, sleep_start, sleep_end, quality_score, payload.sc_quality_score,
    )

    return SleepCycleSyncResponse(
        ok=True,
        session_id=str(session.id),
        imported=True,
        skipped=False,
        reason=None,
        synced_at=datetime.now(timezone.utc).isoformat(),
    )


## ─── Health Auto Export integration ───────────────────────────────


@router.post(
    "/health-auto-export",
    response_model=SleepCycleSyncResponse,
    dependencies=[Depends(_verify_webhook_token)],
)
async def health_auto_export_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> SleepCycleSyncResponse:
    """Ricevi dati sonno da Health Auto Export iOS app.

    Accetta il formato JSON di Health Auto Export (aggregated sleep):
    {
      "data": {
        "metrics": [{
          "name": "sleep_analysis",
          "data": [{ "sleepStart": ..., "sleepEnd": ..., "deep": N, ... }]
        }]
      }
    }

    Oppure il formato flat (singolo record):
    { "sleepStart": ..., "sleepEnd": ..., "deep": N, ... }
    """
    from app.models.user import User

    body_bytes = await request.body()
    body_str = body_bytes.decode("utf-8", errors="replace")
    logger.info("Health Auto Export raw body: %s", body_str[:2000])

    try:
        raw = json.loads(body_str)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"JSON non valido: {e}")

    # Estrai il record sleep dal formato Health Auto Export
    sleep_record = None
    if "data" in raw and "metrics" in raw["data"]:
        # Formato wrapper: { data: { metrics: [{ name, data: [...] }] } }
        for metric in raw["data"]["metrics"]:
            if metric.get("name") in ("sleep_analysis", "sleep"):
                records = metric.get("data", [])
                if records:
                    sleep_record = records[-1]  # Prendi il più recente
                    break
    elif "sleepStart" in raw or "sleep_start" in raw:
        # Formato flat
        sleep_record = raw

    if not sleep_record:
        raise HTTPException(status_code=422, detail="Nessun dato sleep trovato nel payload")

    # Parse campi (Health Auto Export usa camelCase)
    sleep_start_str = sleep_record.get("sleepStart") or sleep_record.get("sleep_start", "")
    sleep_end_str = sleep_record.get("sleepEnd") or sleep_record.get("sleep_end", "")

    if not sleep_start_str or not sleep_end_str:
        raise HTTPException(status_code=422, detail="sleepStart e sleepEnd sono obbligatori")

    sleep_start = _parse_date(sleep_start_str)
    sleep_end = _parse_date(sleep_end_str)

    if sleep_start > sleep_end:
        sleep_start, sleep_end = sleep_end, sleep_start

    # Fasi del sonno — Health Auto Export invia valori in ORE, convertiamo in minuti
    def _hrs_to_min(val) -> int:
        """Converti ore (float) in minuti (int)."""
        return round((float(val) if val else 0) * 60)

    deep_min = _hrs_to_min(sleep_record.get("deep"))
    rem_min = _hrs_to_min(sleep_record.get("rem"))
    light_min = _hrs_to_min(sleep_record.get("core"))  # HealthKit "core" = light
    awake_min = _hrs_to_min(sleep_record.get("awake"))
    asleep_min = _hrs_to_min(sleep_record.get("asleep"))
    in_bed_min = _hrs_to_min(sleep_record.get("inBed"))

    # Calcola duration
    total_sleep = _hrs_to_min(sleep_record.get("totalSleep"))
    duration = total_sleep or asleep_min or max(0, int((sleep_end - sleep_start).total_seconds() / 60))
    time_in_bed = in_bed_min or duration

    # In Bed timestamps
    in_bed_start_str = sleep_record.get("inBedStart", "")
    in_bed_end_str = sleep_record.get("inBedEnd", "")

    # Resolve user
    result = await db.execute(sa_select(User).limit(1))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=503, detail="Nessun utente trovato.")

    user_id = user.id
    window = timedelta(minutes=5)

    # Deduplication
    dup_result = await db.execute(
        sa_select(SleepSession).where(
            and_(
                SleepSession.user_id == user_id,
                SleepSession.sleep_start >= sleep_start - window,
                SleepSession.sleep_start <= sleep_start + window,
            )
        ).limit(1)
    )
    existing = dup_result.scalar_one_or_none()

    # Efficienza
    sleep_efficiency = round(duration / time_in_bed * 100, 1) if time_in_bed > 0 else None

    # Quality score
    quality_score = _calculate_quality_score(duration, deep_min, rem_min, sleep_efficiency, None)

    if existing:
        existing.source = "health_auto_export"
        existing.sleep_start = sleep_start
        existing.sleep_end = sleep_end
        existing.duration_minutes = duration
        existing.time_in_bed_minutes = time_in_bed
        existing.sleep_efficiency = sleep_efficiency
        existing.deep_minutes = deep_min
        existing.rem_minutes = rem_min
        existing.light_minutes = light_min
        existing.awake_minutes = awake_min
        existing.quality_score = quality_score
        db.add(existing)
        await db.commit()
        await db.refresh(existing)
        return SleepCycleSyncResponse(
            ok=True,
            session_id=str(existing.id),
            imported=False,
            reason="Sessione aggiornata con dati Health Auto Export",
            synced_at=datetime.now(timezone.utc).isoformat(),
        )

    # Nuova sessione
    session = SleepSession(
        user_id=user_id,
        sleep_start=sleep_start,
        sleep_end=sleep_end,
        duration_minutes=duration,
        quality_score=quality_score,
        time_in_bed_minutes=time_in_bed,
        sleep_efficiency=sleep_efficiency,
        awake_minutes=awake_min,
        light_minutes=light_min,
        deep_minutes=deep_min,
        rem_minutes=rem_min,
        source="health_auto_export",
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    logger.info(
        "Health Auto Export: nuova sessione %s (%s → %s, dur=%dm, deep=%dm, rem=%dm, quality=%s)",
        session.id, sleep_start, sleep_end, duration, deep_min, rem_min, quality_score,
    )

    return SleepCycleSyncResponse(
        ok=True,
        session_id=str(session.id),
        imported=True,
        synced_at=datetime.now(timezone.utc).isoformat(),
    )


@router.get("/sleep-cycle/status")
async def sleep_cycle_status(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Stato della sync con Sleep Cycle — quante sessioni, ultima sync, ecc."""
    from sqlalchemy import func

    from app.models.user import User
    result = await db.execute(sa_select(User).limit(1))
    user = result.scalar_one_or_none()
    if not user:
        return {"connected": False, "total_sessions": 0}

    result = await db.execute(
        sa_select(
            func.count(SleepSession.id).label("count"),
            func.max(SleepSession.created_at).label("last_sync"),
        ).where(
            and_(
                SleepSession.user_id == user.id,
                SleepSession.source == "sleep_cycle",
            )
        )
    )
    row = result.one()

    return {
        "connected": (row.count or 0) > 0,
        "total_sessions": row.count or 0,
        "last_sync": row.last_sync.isoformat() if row.last_sync else None,
    }


def _calculate_quality_score(
    duration: int,
    deep_min: int,
    rem_min: int,
    efficiency: Optional[float],
    sc_score: Optional[int],
) -> int:
    """Calcola quality score interno.

    Se Sleep Cycle fornisce il suo score, lo usa come base (peso 40%)
    e combina con le nostre metriche (60%).
    """
    total_sleep = deep_min + rem_min + (duration - deep_min - rem_min)
    if total_sleep <= 0:
        return sc_score or 50

    # Duration score (0-25): 8h = 25, <5h = 5
    duration_hours = duration / 60
    if duration_hours >= 8:
        dur_score = 25
    elif duration_hours >= 7:
        dur_score = 20
    elif duration_hours >= 6:
        dur_score = 15
    elif duration_hours >= 5:
        dur_score = 10
    else:
        dur_score = 5

    # Deep sleep score (0-25): 20-25% = 25
    deep_pct = deep_min / duration * 100 if duration > 0 else 0
    if deep_pct >= 20:
        deep_score = 25
    elif deep_pct >= 15:
        deep_score = 20
    elif deep_pct >= 10:
        deep_score = 12
    else:
        deep_score = 5

    # REM score (0-25): 20-25% = 25
    rem_pct = rem_min / duration * 100 if duration > 0 else 0
    if rem_pct >= 20:
        rem_score = 25
    elif rem_pct >= 15:
        rem_score = 20
    elif rem_pct >= 10:
        rem_score = 12
    else:
        rem_score = 5

    # Efficiency score (0-25)
    eff = efficiency or 85
    if eff >= 90:
        eff_score = 25
    elif eff >= 85:
        eff_score = 20
    elif eff >= 75:
        eff_score = 12
    else:
        eff_score = 5

    our_score = dur_score + deep_score + rem_score + eff_score

    # Blend with SC score if available
    if sc_score is not None:
        return round(our_score * 0.6 + sc_score * 0.4)

    return our_score
