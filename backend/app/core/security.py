"""Security utilities including password hashing, JWT tokens, and 2FA."""
from datetime import datetime, timedelta
from typing import Optional, Any, Dict
import pyotp
import qrcode
from io import BytesIO
import base64

import bcrypt as _bcrypt
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.core.config import settings

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    pwd_bytes = password.encode("utf-8")
    salt = _bcrypt.gensalt()
    return _bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against its hash."""
    return _bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )


def create_access_token(
    data: Dict[str, Any], expires_delta: Optional[timedelta] = None
) -> str:
    """
    Create a JWT access token.

    Args:
        data: Data to encode in token.
        expires_delta: Custom expiration time.

    Returns:
        str: Encoded JWT token.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )
    return encoded_jwt


def create_refresh_token(user_id: str) -> str:
    """
    Create a refresh token.

    Args:
        user_id: User ID to encode.

    Returns:
        str: Encoded refresh token.
    """
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    data = {"sub": user_id, "exp": expire, "type": "refresh"}
    return jwt.encode(data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_token(token: str) -> Dict[str, Any]:
    """
    Verify and decode a JWT token.

    Args:
        token: JWT token to verify.

    Returns:
        Dict: Decoded token data.

    Raises:
        HTTPException: If token is invalid or expired.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(token: str = Depends(oauth2_scheme)) -> Dict[str, Any]:
    """
    Dependency to get current authenticated user.

    Supports both JWT tokens and API tokens (prefixed with 'gd_').

    Args:
        token: JWT or API token from Authorization header.

    Returns:
        Dict: Decoded token data (JWT) or synthetic payload (API token).

    Raises:
        HTTPException: If token is invalid.
    """
    # Check if it's an API token (starts with "gd_")
    if token.startswith("gd_"):
        return await _verify_api_token(token)

    # Otherwise treat as JWT
    payload = verify_token(token)
    user_id: str = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )
    return payload


async def _verify_api_token(token: str) -> Dict[str, Any]:
    """Verify an API token against the database."""
    import hashlib
    from app.core.database import AsyncSessionLocal as async_session_factory
    from sqlalchemy.future import select

    token_hash = hashlib.sha256(token.encode()).hexdigest()

    async with async_session_factory() as db:
        from app.models.api_token import APIToken
        result = await db.execute(
            select(APIToken).where(
                APIToken.token_hash == token_hash,
                APIToken.is_active == True,
            )
        )
        api_token = result.scalars().first()

        if not api_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="API token non valido o revocato",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Check expiry
        if api_token.expires_at and api_token.expires_at < __import__("datetime").datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="API token scaduto",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Update last_used_at
        api_token.last_used_at = __import__("datetime").datetime.utcnow()
        db.add(api_token)
        await db.commit()

        return {"sub": str(api_token.user_id), "type": "api_token", "scope": api_token.scope}


def setup_totp(user_email: str) -> tuple[str, str]:
    """
    Set up TOTP 2FA for a user.

    Args:
        user_email: User's email address.

    Returns:
        tuple: (secret_key, qr_code_base64)
    """
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(
        name=user_email, issuer_name="Giuseppe Dashboard"
    )

    # Generate QR code
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(provisioning_uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    # Convert to base64
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    qr_code_base64 = base64.b64encode(buffer.getvalue()).decode()

    return secret, qr_code_base64


def verify_totp(secret: str, token: str) -> bool:
    """
    Verify a TOTP token.

    Args:
        secret: User's TOTP secret.
        token: 6-digit TOTP token to verify.

    Returns:
        bool: True if token is valid.
    """
    totp = pyotp.TOTP(secret)
    return totp.verify(token)


def get_totp_provisioning_uri(secret: str, user_email: str) -> str:
    """
    Get the provisioning URI for TOTP setup.

    Args:
        secret: TOTP secret.
        user_email: User's email.

    Returns:
        str: Provisioning URI.
    """
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=user_email, issuer_name="Giuseppe Dashboard")
