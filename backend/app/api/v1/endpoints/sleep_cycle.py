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
    window = timedelta(minutes=2)  # Finestra stretta per evitare match errati

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

    # Estrai record sleep dal formato Health Auto Export
    sleep_records = []
    if "data" in raw and "metrics" in raw["data"]:
        # Formato wrapper: { data: { metrics: [{ name, data: [...] }] } }
        for metric in raw["data"]["metrics"]:
            if metric.get("name") in ("sleep_analysis", "sleep"):
                sleep_records = metric.get("data", [])
                break
    elif "sleepStart" in raw or "sleep_start" in raw:
        # Formato flat (singolo record)
        sleep_records = [raw]

    if not sleep_records:
        raise HTTPException(status_code=422, detail="Nessun dato sleep trovato nel payload")

    # ── Filtra record per fonte ──
    # Health Auto Export spesso manda più record per la stessa notte da fonti
    # diverse (Sleep Cycle + Apple Watch). Sommandoli si raddoppiano i dati.
    # Strategia: preferire Sleep Cycle > Apple Watch > altri.

    def _hrs_to_min(val) -> int:
        """Converti ore (float) in minuti (int)."""
        return round((float(val) if val else 0) * 60)

    # Separa per fonte
    SOURCE_PRIORITY = ["sleep cycle", "sleep_cycle", "sleepcycle"]
    sc_records = []
    watch_records = []
    other_records = []

    for rec in sleep_records:
        src = (rec.get("source") or "").lower().strip()
        if any(p in src for p in SOURCE_PRIORITY):
            sc_records.append(rec)
        elif "apple watch" in src or "watch" in src:
            watch_records.append(rec)
        else:
            other_records.append(rec)

    # Scegli la fonte migliore disponibile
    if sc_records:
        chosen_records = sc_records
        chosen_source = "sleep_cycle"
    elif watch_records:
        chosen_records = watch_records
        chosen_source = "apple_watch"
    else:
        chosen_records = other_records or sleep_records
        chosen_source = "health_auto_export"

    logger.info(
        "Health Auto Export: %d record totali (SC=%d, Watch=%d, other=%d) → usando %s (%d record)",
        len(sleep_records), len(sc_records), len(watch_records),
        len(other_records), chosen_source, len(chosen_records),
    )

    # ── Prendi SOLO il record più recente (per sleepEnd) ──
    # HAE può mandare più record della stessa fonte (notti diverse, segmenti).
    # Sommandoli si ottengono valori gonfiati (es. 18h invece di 6h).
    # Selezioniamo il singolo record con il sleepEnd più recente.
    def _record_end_time(rec: dict) -> datetime:
        """Ritorna il datetime di fine sonno per ordinamento."""
        end_str = rec.get("sleepEnd") or rec.get("sleep_end") or rec.get("date") or ""
        try:
            return _parse_date(end_str) if end_str else datetime.min
        except Exception:
            return datetime.min

    # Log dettagliato di tutti i record SC per debug
    for i, r in enumerate(chosen_records):
        span_h = None
        try:
            s = _parse_date(r.get("sleepStart") or "")
            e = _parse_date(r.get("sleepEnd") or "")
            span_h = round((e - s).total_seconds() / 3600, 2)
        except Exception:
            pass
        logger.info(
            "SC record #%d: date=%s start=%s end=%s span=%.2fh totalSleep=%s inBed=%s deep=%s rem=%s core=%s",
            i + 1, r.get("date"), r.get("sleepStart"), r.get("sleepEnd"),
            span_h or 0,
            r.get("totalSleep"), r.get("inBed"),
            r.get("deep"), r.get("rem"), r.get("core"),
        )

    if len(chosen_records) > 1:
        chosen_records.sort(key=_record_end_time, reverse=True)
        best_record = chosen_records[0]
        logger.info(
            "Health Auto Export: %d record %s, seleziono il più recente (sleepEnd=%s)",
            len(chosen_records), chosen_source,
            best_record.get("sleepEnd") or best_record.get("sleep_end"),
        )
        chosen_records = [best_record]

    # Estrai dati dal singolo record scelto
    rec = chosen_records[0]

    start_str = rec.get("sleepStart") or rec.get("sleep_start", "")
    end_str = rec.get("sleepEnd") or rec.get("sleep_end", "")

    if not start_str or not end_str:
        raise HTTPException(status_code=422, detail="sleepStart e sleepEnd sono obbligatori")

    sleep_start = _parse_date(start_str)
    sleep_end = _parse_date(end_str)
    if sleep_start > sleep_end:
        sleep_start, sleep_end = sleep_end, sleep_start

    deep_min = _hrs_to_min(rec.get("deep"))
    rem_min = _hrs_to_min(rec.get("rem"))
    light_min = _hrs_to_min(rec.get("core"))  # HealthKit "core" = light
    awake_min = _hrs_to_min(rec.get("awake"))
    asleep_min = _hrs_to_min(rec.get("asleep"))
    in_bed_min = _hrs_to_min(rec.get("inBed"))
    total_sleep_explicit = _hrs_to_min(rec.get("totalSleep"))

    # Calcola duration: preferisci totalSleep esplicito, poi somma fasi, poi fallback
    phase_sum = deep_min + rem_min + light_min
    duration = total_sleep_explicit or asleep_min or phase_sum or max(0, int((sleep_end - sleep_start).total_seconds() / 60))
    time_in_bed = in_bed_min or max(0, int((sleep_end - sleep_start).total_seconds() / 60))

    logger.info(
        "Health Auto Export: %s → start=%s, end=%s, dur=%dm, inBed=%dm, deep=%dm, rem=%dm, light=%dm, awake=%dm",
        chosen_source, sleep_start, sleep_end, duration, time_in_bed, deep_min, rem_min, light_min, awake_min,
    )

    # Resolve user
    result = await db.execute(sa_select(User).limit(1))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=503, detail="Nessun utente trovato.")

    user_id = user.id
    window = timedelta(minutes=2)  # Finestra più stretta per evitare match errati

    # Deduplication: match sia su sleep_start che sleep_end per maggiore precisione
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

    # Cerca sc_quality_score nei dati HAE (Sleep Cycle può scrivere quality in HealthKit)
    sc_quality = None
    q = rec.get("sleepQuality") or rec.get("quality") or rec.get("sc_quality_score")
    if q is not None:
        try:
            sc_quality = int(float(q))
        except (ValueError, TypeError):
            pass

    # Quality score
    quality_score = _calculate_quality_score(duration, deep_min, rem_min, sleep_efficiency, sc_quality)

    # Usa la fonte effettiva dei dati (sleep_cycle > apple_watch > health_auto_export)
    session_source = chosen_source if chosen_source != "health_auto_export" else "health_auto_export"

    if existing:
        existing.source = session_source
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
        if sc_quality is not None:
            existing.sc_quality_score = sc_quality
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
        source=session_source,
        sc_quality_score=sc_quality,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    logger.info(
        "Health Auto Export: nuova sessione %s (source=%s, %s → %s, dur=%dm, deep=%dm, rem=%dm, quality=%s)",
        session.id, session_source, sleep_start, sleep_end, duration, deep_min, rem_min, quality_score,
    )

    return SleepCycleSyncResponse(
        ok=True,
        session_id=str(session.id),
        imported=True,
        synced_at=datetime.now(timezone.utc).isoformat(),
    )


## ── Nuovo endpoint: ricezione campioni granulari da Apple Shortcut ──────────

async def _verify_webhook_token_or_query(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> None:
    """Verifica token via header Authorization OPPURE query param ?token=..."""
    secret = settings.APPLE_HEALTH_WEBHOOK_SECRET
    if not secret:
        raise HTTPException(status_code=503, detail="Webhook non configurato.")

    # Prima prova header
    if credentials and credentials.credentials == secret:
        return

    # Poi prova query param
    token = request.query_params.get("token")
    if token and token == secret:
        return

    raise HTTPException(status_code=401, detail="Token non valido.")


@router.get(
    "/shortcut",
    response_model=SleepCycleSyncResponse,
)
async def shortcut_sleep_get(
    request: Request,
    token: str = "",
    data: str = "",
    db: AsyncSession = Depends(get_db),
) -> SleepCycleSyncResponse:
    """Endpoint GET per iOS Shortcuts — riceve dati base64 nel query param.

    iOS Shortcuts manda header HTTP/2 invalidi nei POST, causando 400.
    Questo endpoint GET accetta i dati come ?data=<base64>&token=<secret>.
    Il base64 decodificato deve essere testo pipe-delimited (start|end|value|source per riga).
    """
    import base64

    secret = settings.APPLE_HEALTH_WEBHOOK_SECRET
    if not secret or token != secret:
        raise HTTPException(status_code=401, detail="Token non valido.")

    if not data:
        raise HTTPException(status_code=422, detail="Parametro 'data' mancante")

    try:
        body_str = base64.b64decode(data).decode("utf-8", errors="replace")
    except Exception:
        # Forse non è base64, prova come testo diretto (URL-decoded)
        body_str = data

    logger.info("Shortcut GET: decoded payload (%d chars): %s", len(body_str), body_str[:300])

    # Redirige al handler POST con il body decodificato
    request._body = body_str.encode("utf-8")
    return await shortcut_sleep_webhook(request, db)


@router.post(
    "/shortcut",
    response_model=SleepCycleSyncResponse,
    dependencies=[Depends(_verify_webhook_token_or_query)],
)
async def shortcut_sleep_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> SleepCycleSyncResponse:
    """Ricevi campioni di sonno granulari da Apple Shortcut.

    Lo Shortcut legge i singoli HKCategorySample di tipo Sleep Analysis
    da HealthKit (ogni fase con start/end esatti) e li invia qui.
    Il backend trova l'ultimo blocco di sonno continuo e lo salva.

    Payload atteso:
    {
      "samples": [
        {"start": "2026-04-11T06:02:00+02:00", "end": "2026-04-11T06:30:00+02:00", "value": "AsleepCore", "source": "Sleep Cycle"},
        ...
      ]
    }

    Valori possibili per "value":
      InBed, Asleep, Awake, AsleepCore (=light), AsleepDeep, AsleepREM
    """
    from app.models.user import User

    body = await request.body()
    body_str = body.decode("utf-8", errors="replace").strip()
    logger.info("Shortcut webhook: raw payload (%d bytes): %s", len(body), body_str[:500])

    # Supporta sia JSON {"samples": [...]} sia testo pipe-delimited (start|end|value|source per riga)
    samples: list[dict] = []
    try:
        raw = json.loads(body_str)
        samples = raw.get("samples") or raw.get("data") or []
        if isinstance(raw, list):
            samples = raw
    except (json.JSONDecodeError, ValueError):
        # Formato testo: una riga per campione, campi separati da |
        for line in body_str.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split("|")
            if len(parts) >= 3:
                samples.append({
                    "start": parts[0].strip(),
                    "end": parts[1].strip(),
                    "value": parts[2].strip(),
                    "source": parts[3].strip() if len(parts) > 3 else "Sleep Cycle",
                })

    if not samples:
        raise HTTPException(status_code=422, detail="Nessun campione trovato nel payload")

    # ── 1. Filtra per fonte Sleep Cycle e parse timestamps ──
    parsed = []
    for s in samples:
        src = (s.get("source") or "").lower()
        if "sleep cycle" not in src and "sleepcycle" not in src:
            continue

        value = (s.get("value") or s.get("type") or "").strip()
        start = _parse_date(s.get("start") or s.get("startDate") or "")
        end = _parse_date(s.get("end") or s.get("endDate") or "")

        if start >= end:
            continue

        # Normalizza nomi fase da Shortcuts (es. "Asleep (Core)" → "asleepcore")
        val_lower = value.lower().replace(" ", "").replace("(", "").replace(")", "")

        # Ignora campioni "InBed" — usiamo solo le fasi reali
        if val_lower in ("inbed", ""):
            continue

        parsed.append({
            "start": start,
            "end": end,
            "value": val_lower,
            "duration_min": (end - start).total_seconds() / 60,
        })

    if not parsed:
        raise HTTPException(status_code=422, detail="Nessun campione Sleep Cycle trovato")

    # ── 2. Ordina per start time e trova l'ultimo blocco continuo ──
    parsed.sort(key=lambda x: x["start"])

    # Un "blocco" = sequenza di campioni dove il gap tra uno e il successivo è < 30 min
    MAX_GAP = timedelta(minutes=30)
    blocks: list[list[dict]] = []
    current_block = [parsed[0]]

    for sample in parsed[1:]:
        prev_end = current_block[-1]["end"]
        gap = sample["start"] - prev_end
        if gap <= MAX_GAP:
            current_block.append(sample)
        else:
            blocks.append(current_block)
            current_block = [sample]
    blocks.append(current_block)

    # Prendi l'ultimo blocco (il più recente)
    last_block = blocks[-1]

    logger.info(
        "Shortcut: %d campioni SC totali, %d blocchi, ultimo blocco ha %d campioni",
        len(parsed), len(blocks), len(last_block),
    )

    # ── 3. Calcola metriche dal blocco ──
    sleep_start = last_block[0]["start"]
    sleep_end = last_block[-1]["end"]

    deep_min = 0
    rem_min = 0
    light_min = 0
    awake_min = 0

    for sample in last_block:
        dur = round(sample["duration_min"])
        val = sample["value"]
        if val in ("asleepdeep", "deep"):
            deep_min += dur
        elif val in ("asleeprem", "rem"):
            rem_min += dur
        elif val in ("asleepcore", "core", "light", "asleep"):
            light_min += dur
        elif val in ("awake", "awakeinsleep"):
            awake_min += dur
        else:
            light_min += dur  # fallback

    duration = deep_min + rem_min + light_min  # solo sonno effettivo (no awake)
    time_in_bed = duration + awake_min
    sleep_efficiency = round(duration / time_in_bed * 100, 1) if time_in_bed > 0 else None

    logger.info(
        "Shortcut: blocco %s → %s, dur=%dm, inBed=%dm, deep=%dm, rem=%dm, light=%dm, awake=%dm",
        sleep_start, sleep_end, duration, time_in_bed, deep_min, rem_min, light_min, awake_min,
    )

    # ── 4. Resolve user ──
    result = await db.execute(sa_select(User).limit(1))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=503, detail="Nessun utente trovato.")

    user_id = user.id

    # ── 5. Deduplication ──
    window = timedelta(minutes=5)
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

    quality_score = _calculate_quality_score(duration, deep_min, rem_min, sleep_efficiency, None)

    if existing:
        existing.source = "sleep_cycle"
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
            reason="Sessione aggiornata con dati Shortcut (campioni granulari)",
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
        source="sleep_cycle",
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    logger.info(
        "Shortcut: nuova sessione %s (%s → %s, dur=%dm, deep=%dm, rem=%dm, quality=%d)",
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
