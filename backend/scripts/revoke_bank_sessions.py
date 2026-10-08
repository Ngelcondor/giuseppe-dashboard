"""Chiude da Enable Banking ogni sessione bancaria della dashboard (una tantum).

I conti bancari ora stanno in AIBudget (aibudget.elcondor.dev), che passa dallo
stesso TPP: molte banche danno un solo consenso per utente e TPP, quindi le
sessioni della dashboard vanno chiuse e non lasciate scadere. Il vecchio
DELETE /budget/bank/connection segnava la connessione EXPIRED solo nel DB: una
sessione "expired" qui può essere ancora viva da Enable Banking, perciò si
chiude ogni session_id distinto, qualunque sia lo stato locale.

Va lanciato con le credenziali Enable Banking ancora nei container, cioè PRIMA
del deploy che le toglie da docker-compose.prod.yml. Usa solo codice già presente
nell'immagine in produzione, quindi gira anche passato da stdin:

    ssh <BOX> 'docker exec -i gd-backend python - [--apply]' < backend/scripts/revoke_bank_sessions.py

Senza --apply legge e basta. Con --apply: DELETE /sessions/{id} per sessione,
connessioni chiuse -> status "revoked", conti con sync disattivato, saldi in
cache cancellati. Stampa solo conteggi e nomi delle banche, niente IBAN o importi.
Rieseguibile: una sessione già chiusa conta come chiusa.
"""
import asyncio
import sys
from collections import Counter
from urllib.parse import quote

import httpx
import redis.asyncio as aioredis
from sqlalchemy.future import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.budget import BankAccount, BankConnection
from app.services.enable_banking_service import EB_BASE, EnableBankingProvider

REVOKED = "revoked"
BALANCE_KEY = "bank:balance:{uid}"  # app.services.bank_balance_cache.KEY


def _closed(resp: httpx.Response) -> bool:
    """200/204 = chiusa ora; 404 SESSION_DOES_NOT_EXIST e 400 CLOSED_SESSION =
    già chiusa (stesse risposte che AIBudget tratta come revocata)."""
    if resp.status_code in (200, 204, 404):
        return True
    return resp.status_code == 400 and "CLOSED_SESSION" in resp.text


async def main(apply: bool) -> int:
    if not (settings.ENABLE_BANKING_APP_ID and settings.ENABLE_BANKING_APP_SECRET):
        print("Enable Banking non configurato in questo container: niente da chiudere da qui.")
        return 1

    async with AsyncSessionLocal() as db:
        conns = (await db.execute(select(BankConnection))).scalars().all()
        accounts = (await db.execute(select(BankAccount))).scalars().all()

        status_of = lambda c: getattr(c.status, "value", c.status)  # noqa: E731
        print(f"Connessioni: {len(conns)} · per stato: {dict(Counter(status_of(c) for c in conns))}")
        print(f"Banche: {sorted({c.institution_name for c in conns})}")
        sessions = sorted({c.session_id for c in conns if c.session_id})
        no_session = [c for c in conns if not c.session_id and status_of(c) != REVOKED]
        print(f"Sessioni Enable Banking distinte: {len(sessions)}")
        if no_session:
            # Senza session_id (connessioni GoCardless o precedenti al campo) non
            # c'è niente da chiudere via API: vanno revocate dall'app della banca.
            print(f"Connessioni senza session_id: {len(no_session)} "
                  f"({sorted({c.institution_name for c in no_session})})")

        if not apply:
            print("Dry run: nessuna chiamata a Enable Banking, nessuna scrittura. Rilancia con --apply.")
            return 0

        provider = EnableBankingProvider()
        closed: set[str] = set()
        failed: list[str] = []
        async with httpx.AsyncClient(timeout=30) as client:
            for sid in sessions:
                resp = await client.delete(
                    f"{EB_BASE}/sessions/{quote(sid, safe='')}", headers=provider._auth_headers()
                )
                if _closed(resp):
                    closed.add(sid)
                else:
                    failed.append(f"HTTP {resp.status_code}")

        for c in conns:
            if not c.session_id or c.session_id in closed:
                c.status = REVOKED
        for a in accounts:
            a.sync_enabled = False
        await db.commit()

    cache = aioredis.from_url(settings.REDIS_URL, encoding="utf8", decode_responses=True)
    try:
        keys = [BALANCE_KEY.format(uid=a.account_uid) for a in accounts]
        dropped = await cache.delete(*keys) if keys else 0
    finally:
        await cache.close()

    print(f"Sessioni chiuse: {len(closed)}/{len(sessions)} · saldi in cache cancellati: {dropped}")
    if failed:
        print(f"Non chiuse ({len(failed)}): {failed} — riprova, o revoca dall'app della banca.")
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main("--apply" in sys.argv[1:])))
