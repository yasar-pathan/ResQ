import uuid
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthenticationError, AuthorizationError
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User, UserRole
from app.modules.auth.service import get_user_by_id

bearer_scheme = HTTPBearer(auto_error=False)


async def get_optional_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> User | None:
    if credentials is None:
        return getattr(request.state, "user", None)

    try:
        payload = decode_access_token(credentials.credentials)
        user_id = uuid.UUID(payload["sub"])
    except (ValueError, KeyError):
        raise AuthenticationError("Invalid or expired access token") from None

    user = await get_user_by_id(session, user_id)
    if user is None or not user.is_active:
        raise AuthenticationError("Invalid or expired access token")
    return user


async def get_current_user(
    user: Annotated[User | None, Depends(get_optional_user)],
) -> User:
    if user is None:
        raise AuthenticationError("Authentication required")
    return user


def require_role(*roles: UserRole):
    async def _checker(user: Annotated[User, Depends(get_current_user)]) -> User:
        if user.role not in roles:
            raise AuthorizationError(
                "Access restricted for your role",
                details={"required_roles": [r.value for r in roles], "role": user.role.value},
            )
        return user

    return _checker
