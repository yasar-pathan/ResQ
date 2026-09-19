import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthenticationError, AuthorizationError, ConflictError
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    refresh_token_expires_at,
    verify_password,
)
from app.models.audit_log import AuditLog
from app.models.refresh_token import RefreshToken
from app.models.user import User, UserRole
from app.modules.auth.schemas import RegisterRequest, TokenResponse, UserPublic


def user_to_public(user: User) -> dict:
    return UserPublic(
        id=str(user.id),
        name=user.name,
        email=user.email,
        role=user.role,
        phone=user.phone,
    ).model_dump()


async def record_audit(
    session: AsyncSession,
    action: str,
    actor_user_id: uuid.UUID | None = None,
    entity_type: str | None = None,
    entity_id: uuid.UUID | None = None,
    metadata: dict | None = None,
) -> None:
    session.add(
        AuditLog(
            actor_user_id=actor_user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            metadata_=metadata,
        )
    )


async def register_user(
    session: AsyncSession,
    body: RegisterRequest,
    *,
    actor: User | None = None,
) -> UserPublic:
    if body.role != UserRole.citizen:
        if actor is None or actor.role != UserRole.admin:
            raise AuthorizationError(
                "Only administrators can create non-citizen accounts",
                details={"role": body.role.value},
            )

    existing = await session.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise ConflictError("Email already registered", details={"email": body.email})

    user = User(
        name=body.name,
        email=body.email.lower(),
        password_hash=hash_password(body.password),
        role=body.role,
        phone=body.phone,
    )
    session.add(user)
    await session.flush()
    await session.commit()
    await session.refresh(user)
    return UserPublic(
        id=str(user.id),
        name=user.name,
        email=user.email,
        role=user.role,
        phone=user.phone,
    )


def _build_token_response(user: User, raw_refresh: str) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user.id, user.role),
        refresh_token=raw_refresh,
    )


async def _persist_refresh_token(session: AsyncSession, user: User) -> str:
    raw_refresh = generate_refresh_token()
    session.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_refresh_token(raw_refresh),
            expires_at=refresh_token_expires_at(),
            created_at=datetime.now(UTC),
        )
    )
    return raw_refresh


async def login_user(session: AsyncSession, email: str, password: str) -> TokenResponse:
    result = await session.execute(select(User).where(User.email == email.lower()))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(password, user.password_hash):
        raise AuthenticationError("Invalid email or password")
    if not user.is_active:
        raise AuthenticationError("Account is inactive")

    raw_refresh = await _persist_refresh_token(session, user)
    await record_audit(
        session, "auth.login", actor_user_id=user.id, entity_type="user", entity_id=user.id
    )
    await session.commit()
    return _build_token_response(user, raw_refresh)


async def refresh_tokens(session: AsyncSession, raw_refresh: str) -> TokenResponse:
    token_hash = hash_refresh_token(raw_refresh)
    now = datetime.now(UTC)
    result = await session.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    row = result.scalar_one_or_none()
    if row is None or row.revoked_at is not None or row.expires_at < now:
        raise AuthenticationError("Invalid or expired refresh token")

    user_result = await session.execute(select(User).where(User.id == row.user_id))
    user = user_result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise AuthenticationError("Invalid or expired refresh token")

    row.revoked_at = now
    new_refresh = await _persist_refresh_token(session, user)
    await session.commit()
    return _build_token_response(user, new_refresh)


async def logout_user(session: AsyncSession, user_id: uuid.UUID) -> None:
    now = datetime.now(UTC)
    result = await session.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
        )
    )
    for row in result.scalars():
        row.revoked_at = now
    await session.commit()


async def get_user_by_id(session: AsyncSession, user_id: uuid.UUID) -> User | None:
    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def bootstrap_admin_if_needed(session: AsyncSession, email: str, password: str) -> None:
    existing = await session.execute(select(User).where(User.email == email.lower()))
    if existing.scalar_one_or_none() is not None:
        return
    user = User(
        name="Bootstrap Admin",
        email=email.lower(),
        password_hash=hash_password(password),
        role=UserRole.admin,
    )
    session.add(user)
    await session.commit()
