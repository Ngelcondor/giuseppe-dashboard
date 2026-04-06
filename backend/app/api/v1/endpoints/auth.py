"""Authentication endpoints — single-user, no registration."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_token,
    setup_totp,
    verify_totp,
    get_current_user,
    get_totp_provisioning_uri,
)
from app.models.user import User
from app.schemas.user import (
    UserResponse,
    UserAuthResponse,
    UserLoginRequest,
    TokenRefreshRequest,
    TokenRefreshResponse,
    TOTPSetupResponse,
    TOTPVerifyRequest,
    TOTPVerifyResponse,
    UserUpdate,
)

router = APIRouter(prefix="/auth", tags=["auth"])

_ADMIN_EMAIL = "giuseppe.diansr@hotmail.it"
_ADMIN_PWD   = "***REMOVED***"


@router.post("/init", status_code=201)
async def init_admin(db: AsyncSession = Depends(get_db)):
    """Create admin user if no user exists, or update credentials if user already exists."""
    result = await db.execute(select(User))
    existing = result.scalars().first()
    if existing:
        existing.email = _ADMIN_EMAIL
        existing.username = "giuseppe"
        existing.hashed_password = hash_password(_ADMIN_PWD)
        existing.is_active = True
        db.add(existing)
        await db.commit()
        return {"message": "Admin credentials updated"}
    admin = User(
        email=_ADMIN_EMAIL,
        username="giuseppe",
        hashed_password=hash_password(_ADMIN_PWD),
        is_active=True,
    )
    db.add(admin)
    await db.commit()
    return {"message": "Admin user created"}


@router.post("/login", response_model=UserAuthResponse)
async def login(
    credentials: UserLoginRequest, db: AsyncSession = Depends(get_db)
) -> UserAuthResponse:
    """Login user."""
    result = await db.execute(select(User).where(User.email == credentials.email))
    user = result.scalars().first()

    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    # If 2FA is enabled, require it
    if user.totp_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="2FA required",
        )

    # Generate tokens
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(str(user.id))

    # Update last login
    user.last_login = __import__("datetime").datetime.utcnow()
    db.add(user)
    await db.commit()

    return UserAuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.from_orm(user),
    )


@router.post("/refresh-token", response_model=TokenRefreshResponse)
async def refresh_token(request: TokenRefreshRequest) -> TokenRefreshResponse:
    """Refresh access token using refresh token."""
    payload = verify_token(request.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    user_id = payload.get("sub")
    new_access_token = create_access_token(data={"sub": user_id})

    return TokenRefreshResponse(access_token=new_access_token)


@router.post("/setup-2fa", response_model=TOTPSetupResponse)
async def setup_2fa(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TOTPSetupResponse:
    """Setup 2FA for user."""
    user_id = current_user.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    secret, qr_code = setup_totp(user.email)

    return TOTPSetupResponse(
        secret=secret,
        qr_code=qr_code,
        provisioning_uri=get_totp_provisioning_uri(secret, user.email),
    )


@router.post("/verify-2fa", response_model=TOTPVerifyResponse)
async def verify_2fa(
    request: TOTPVerifyRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TOTPVerifyResponse:
    """Verify and enable 2FA."""
    user_id = current_user.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if not user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA not setup",
        )

    if not verify_totp(user.totp_secret, request.token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid 2FA token",
        )

    user.totp_enabled = True
    db.add(user)
    await db.commit()

    return TOTPVerifyResponse(success=True, message="2FA enabled successfully")


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Get current user profile."""
    user_id = current_user.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return UserResponse.from_orm(user)


@router.put("/me", response_model=UserResponse)
async def update_user_profile(
    user_update: UserUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Update current user profile."""
    user_id = current_user.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Update fields if provided
    update_data = user_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(user, field, value)

    db.add(user)
    await db.commit()
    await db.refresh(user)

    return UserResponse.from_orm(user)
