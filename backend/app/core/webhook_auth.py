"""Webhook authentication for iOS Shortcuts / Health Auto Export.

Webhook calls authenticate with a Bearer token bound to a specific user:

  - Per-user API token (``gd_...``) created via /api-tokens — preferred.
    The token is hashed (SHA-256) and looked up in the ``api_tokens`` table;
    the webhook data is attributed to the token's owner.
  - Legacy global secret (APPLE_HEALTH_WEBHOOK_SECRET) — deprecated.
    Kept for backwards compatibility: resolves the first user in the DB.

GET shortcut endpoints can also pass the token via ``?token=`` query param
(iOS Shortcuts sends broken headers on some POSTs) — use
``get_webhook_user_allow_query`` for those.
"""
import hashlib
import logging
from datetime import datetime
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.api_token import APIToken
from app.models.user import User

logger = logging.getLogger(__name__)

_bearer_scheme = HTTPBearer(auto_error=False)


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token non valido.",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def _resolve_user_from_token(db: AsyncSession, token: Optional[str]) -> User:
    """Resolve the owner User from a webhook token.

    Accepts a per-user API token (``gd_...``) or the legacy global secret.
    Raises HTTPException 401 (invalid/missing token) or 503 (not configured /
    no user available).
    """
    # ── Per-user API token (preferred) ──
    if token and token.startswith("gd_"):
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        now = datetime.utcnow()
        result = await db.execute(
            select(APIToken).where(APIToken.token_hash == token_hash)
        )
        api_token = result.scalar_one_or_none()
        if (
            api_token
            and api_token.is_active
            and (api_token.expires_at is None or api_token.expires_at > now)
        ):
            api_token.last_used_at = now
            db.add(api_token)
            await db.commit()

            user_result = await db.execute(
                select(User).where(User.id == api_token.user_id)
            )
            user = user_result.scalar_one_or_none()
            if not user or not user.is_active:
                raise _unauthorized()
            return user
        raise _unauthorized()

    # ── Legacy global secret (deprecated) ──
    secret = settings.APPLE_HEALTH_WEBHOOK_SECRET
    if secret and token == secret:
        logger.warning(
            "Webhook authenticated with the global APPLE_HEALTH_WEBHOOK_SECRET — "
            "deprecated in favour of per-user API tokens (create one via /api-tokens)."
        )
        result = await db.execute(select(User).limit(1))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Nessun utente trovato.",
            )
        return user

    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Webhook non configurato: crea un token API via /api-tokens "
                "e usalo come Bearer token."
            ),
        )

    raise _unauthorized()


async def get_webhook_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """FastAPI dependency: authenticate a webhook call and return its User."""
    token = credentials.credentials if credentials else None
    return await _resolve_user_from_token(db, token)


async def get_webhook_user_allow_query(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Like get_webhook_user, but also accepts the token via ``?token=``.

    Used by the shortcut endpoints — iOS Shortcuts can't always send
    custom headers reliably.
    """
    token = credentials.credentials if credentials else None
    if not token:
        token = request.query_params.get("token") or None
    return await _resolve_user_from_token(db, token)
