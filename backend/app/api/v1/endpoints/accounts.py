"""Account management — current user identity + admin-managed users.

Routers:
  me_router  (prefix /auth)  -> GET /auth/me
  router     (prefix /users) -> GET/POST/DELETE /users  (admin-only mutations)

Roles: 'admin' = full editor, 'guest' = read-only. `full_name` is mapped onto
the existing User.username column (no separate column).
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.security import get_current_user, hash_password
from app.models.user import User
from app.schemas.app_settings import MeResponse, UserSummary, GuestCreate

# /auth/me — sits under the auth prefix
me_router = APIRouter(prefix="/auth", tags=["auth"])
# /users — admin-managed accounts
router = APIRouter(prefix="/users", tags=["accounts"])


def _role(user: User) -> str:
    return user.role or "admin"


async def _load_user(db: AsyncSession, user_id) -> User:
    user = (await db.execute(select(User).where(User.id == user_id))).scalars().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


async def _require_admin(db: AsyncSession, current_user: dict) -> User:
    user = await _load_user(db, current_user.get("sub"))
    if _role(user) != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo l'admin può gestire gli account",
        )
    return user


@me_router.get("/me", response_model=MeResponse)
async def get_me(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MeResponse:
    """Identity + role of the authenticated user."""
    user = await _load_user(db, current_user.get("sub"))
    return MeResponse(email=user.email, role=_role(user), full_name=user.username or "")


@router.get("", response_model=list[UserSummary])
async def list_users(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[UserSummary]:
    """List all accounts. Admin only."""
    await _require_admin(db, current_user)
    users = (await db.execute(select(User).order_by(User.created_at))).scalars().all()
    return [
        UserSummary(
            id=u.id, email=u.email, role=_role(u),
            full_name=u.username or "", is_active=bool(u.is_active),
        )
        for u in users
    ]


@router.post("", response_model=UserSummary, status_code=201)
async def create_guest(
    body: GuestCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserSummary:
    """Create a read-only ('guest') account. Admin only."""
    await _require_admin(db, current_user)

    email = body.email.lower()
    existing = (await db.execute(select(User).where(User.email == email))).scalars().first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email già registrata")

    # full_name is stored on username (unique, required). Fall back to the email
    # local-part; disambiguate with a numeric suffix on collision.
    base = (body.full_name.strip() or email.split("@")[0])[:240] or "guest"
    username = base
    suffix = 1
    while (await db.execute(select(User).where(User.username == username))).scalars().first():
        suffix += 1
        username = f"{base} {suffix}"

    guest = User(
        email=email,
        username=username,
        hashed_password=hash_password(body.password),
        is_active=True,
        role="guest",
    )
    db.add(guest)
    await db.commit()
    await db.refresh(guest)
    return UserSummary(
        id=guest.id, email=guest.email, role=_role(guest),
        full_name=guest.username or "", is_active=bool(guest.is_active),
    )


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an account. Admin only; cannot delete self."""
    admin = await _require_admin(db, current_user)
    if str(admin.id) == str(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Non puoi eliminare il tuo account",
        )
    target = await _load_user(db, user_id)
    await db.delete(target)
    await db.commit()
