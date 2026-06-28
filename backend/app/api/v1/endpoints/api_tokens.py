"""API Token management endpoints."""
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.config import settings
from app.core.security import get_current_user, require_editor
from app.models.api_token import APIToken
from app.models.user import User
from app.schemas.api_token import (
    APITokenCreate,
    APITokenResponse,
    APITokenCreated,
    APITokenList,
    WebhookSecretResponse,
)

router = APIRouter(prefix="/api-tokens", tags=["api-tokens"])


def _hash_token(token: str) -> str:
    """Hash a token using SHA-256."""
    return hashlib.sha256(token.encode()).hexdigest()


def _generate_token() -> str:
    """Generate a secure random API token."""
    return f"gd_{secrets.token_urlsafe(48)}"


# ── List all tokens ──────────────────────────────────────────────────────────

@router.get("", response_model=APITokenList)
async def list_tokens(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> APITokenList:
    """List all API tokens for the current user."""
    user_id = current_user.get("sub")
    result = await db.execute(
        select(APIToken)
        .where(APIToken.user_id == user_id)
        .order_by(APIToken.created_at.desc())
    )
    tokens = result.scalars().all()
    return APITokenList(
        tokens=[APITokenResponse.model_validate(t) for t in tokens],
        total=len(tokens),
    )


# ── Create a new token ───────────────────────────────────────────────────────

@router.post("", response_model=APITokenCreated, status_code=201)
async def create_token(
    request: APITokenCreate,
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> APITokenCreated:
    """Create a new API token. The full token is returned only once."""
    user_id = current_user.get("sub")

    # Generate token
    raw_token = _generate_token()
    token_hash = _hash_token(raw_token)
    token_prefix = raw_token[:8]  # "gd_" + 5 chars — column is VARCHAR(8)

    # Calculate expiry
    expires_at = None
    if request.expires_in_days:
        expires_at = datetime.utcnow() + timedelta(days=request.expires_in_days)

    api_token = APIToken(
        user_id=user_id,
        name=request.name,
        token_hash=token_hash,
        token_prefix=token_prefix,
        scope=request.scope,
        description=request.description,
        expires_at=expires_at,
    )
    db.add(api_token)
    await db.commit()
    await db.refresh(api_token)

    # Return response with the full token (only time it's visible)
    response = APITokenCreated.model_validate(api_token)
    response.token = raw_token
    return response


# ── Revoke (delete) a token ──────────────────────────────────────────────────

@router.delete("/{token_id}", status_code=204)
async def revoke_token(
    token_id: str,
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Revoke and delete an API token."""
    user_id = current_user.get("sub")
    result = await db.execute(
        select(APIToken).where(
            APIToken.id == token_id,
            APIToken.user_id == user_id,
        )
    )
    token = result.scalars().first()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Token non trovato",
        )
    await db.delete(token)
    await db.commit()


# ── Toggle token active/inactive ─────────────────────────────────────────────

@router.patch("/{token_id}/toggle", response_model=APITokenResponse)
async def toggle_token(
    token_id: str,
    current_user: dict = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
) -> APITokenResponse:
    """Toggle a token active/inactive."""
    user_id = current_user.get("sub")
    result = await db.execute(
        select(APIToken).where(
            APIToken.id == token_id,
            APIToken.user_id == user_id,
        )
    )
    token = result.scalars().first()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Token non trovato",
        )
    token.is_active = not token.is_active
    db.add(token)
    await db.commit()
    await db.refresh(token)
    return APITokenResponse.model_validate(token)


# ── Webhook secret management ────────────────────────────────────────────────

@router.get("/webhook-secret", response_model=WebhookSecretResponse)
async def get_webhook_secret(
    current_user: dict = Depends(get_current_user),
) -> WebhookSecretResponse:
    """Get info about the current Apple Health webhook secret."""
    secret = settings.APPLE_HEALTH_WEBHOOK_SECRET
    if not secret:
        return WebhookSecretResponse(
            is_configured=False,
            hint="Webhook non configurato. Imposta APPLE_HEALTH_WEBHOOK_SECRET nel .env.prod del server.",
        )
    return WebhookSecretResponse(
        is_configured=True,
        secret_preview=secret[:8] + "...",
        hint="Usa questo token come Bearer token in Health Auto Export",
    )


@router.get("/webhook-secret/reveal")
async def reveal_webhook_secret(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Reveal the full webhook secret (use with caution)."""
    secret = settings.APPLE_HEALTH_WEBHOOK_SECRET
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook secret non configurato",
        )
    return {"secret": secret}


# ── Verify a token (for testing) ─────────────────────────────────────────────

@router.post("/verify")
async def verify_api_token(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Verify the current authentication is valid. Useful for testing tokens."""
    return {"valid": True, "user_id": current_user.get("sub")}
