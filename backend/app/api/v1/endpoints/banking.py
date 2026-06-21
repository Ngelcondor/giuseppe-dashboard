"""Open Banking integration — honest status + accounts consumer.

Reads the shared `openbanking` integration config from the settings store
(written by the Impostazioni slice). Until a provider (GoCardless/Nordigen,
Tink, Enable Banking, …) is actually configured and authorised, these
endpoints return an explicit `connected: false` / `not_connected` state.

NO balances or transactions are ever fabricated. Real account/balance fetching
lives behind the budget bank-provider stack (`/budget/bank/*`); this module is
the lightweight, settings-driven status surface used across the dashboard.
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.services.settings_store import get_setting

router = APIRouter(prefix="/banking", tags=["banking"])

SETTING_KEY = "openbanking"


def _provider(cfg: Optional[Dict[str, Any]]) -> Optional[str]:
    if not cfg:
        return None
    provider = cfg.get("provider")
    return provider or None


def _is_connected(cfg: Optional[Dict[str, Any]]) -> bool:
    """Connected requires both a configured provider and a completed link.

    The settings slice records `provider` when the user picks one; the actual
    bank authorisation (requisition/consent) sets `connected: true`. Both are
    needed before we'd attempt to fetch accounts.
    """
    if not cfg:
        return False
    return bool(_provider(cfg)) and cfg.get("connected") is True


@router.get("/status")
async def banking_status(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Report Open Banking connection state for the current user."""
    cfg = await get_setting(db, current_user["sub"], SETTING_KEY)
    provider = _provider(cfg)
    connected = _is_connected(cfg)

    if connected:
        detail = None
    elif provider:
        detail = (
            f"Provider '{provider}' selezionato ma non ancora autorizzato · "
            "completa la connessione in Impostazioni"
        )
    else:
        detail = "Open Banking non configurato · imposta un provider in Impostazioni"

    return {
        "provider": provider,
        "connected": connected,
        "status": "connected" if connected else "not_connected",
        "detail": detail,
    }


@router.get("/accounts")
async def banking_accounts(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Return linked bank accounts, or an honest not-connected payload.

    Until a provider is configured AND authorised, returns `connected: false`
    with an empty list. No balances/transactions are fabricated. When a real
    provider flow is wired (see `/budget/bank/*` and `app.services.bank_*`),
    the connected branch would enumerate accounts from the provider.
    """
    cfg = await get_setting(db, current_user["sub"], SETTING_KEY)
    provider = _provider(cfg)

    if not _is_connected(cfg):
        return {
            "connected": False,
            "status": "not_connected",
            "provider": provider,
            "accounts": [],
            "detail": (
                "Nessun conto collegato · configura e autorizza un provider "
                "Open Banking in Impostazioni"
            ),
        }

    # Provider configured + authorised per settings, but live account fetch is
    # provided by the budget bank stack, not this status surface. Be explicit
    # rather than invent accounts here.
    accounts: List[Dict[str, Any]] = []
    return {
        "connected": True,
        "status": "connected",
        "provider": provider,
        "accounts": accounts,
        "detail": (
            "Provider autorizzato · usa la sezione Budget per saldi e movimenti"
        ),
    }
