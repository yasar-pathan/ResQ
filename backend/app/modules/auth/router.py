from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.responses import success_response
from app.db.session import get_db
from app.models.user import User, UserRole
from app.modules.auth.dependencies import get_current_user, get_optional_user, require_role
from app.modules.auth.schemas import LoginRequest, RefreshRequest, RegisterRequest
from app.modules.auth.service import (
    login_user,
    logout_user,
    refresh_tokens,
    register_user,
    user_to_public,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User | None, Depends(get_optional_user)],
) -> JSONResponse:
    user = await register_user(session, body, actor=actor)
    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content=success_response(user.model_dump(), message="Registered"),
    )


@router.post("/login")
async def login(
    body: LoginRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    tokens = await login_user(session, body.email, body.password)
    return JSONResponse(content=success_response(tokens.model_dump()))


@router.post("/refresh")
async def refresh(
    body: RefreshRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    tokens = await refresh_tokens(session, body.refresh_token)
    return JSONResponse(content=success_response(tokens.model_dump()))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    await logout_user(session, user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me")
async def me(user: Annotated[User, Depends(get_current_user)]) -> JSONResponse:
    return JSONResponse(content=success_response(user_to_public(user)))


@router.get("/users")
async def list_users(
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.admin))],
) -> JSONResponse:
    result = await session.execute(select(User).order_by(User.created_at.desc()))
    users = [user_to_public(u) for u in result.scalars().all()]
    return JSONResponse(content=success_response({"items": users, "total": len(users)}))


@router.get("/admin-only")
async def admin_only(
    user: Annotated[User, Depends(require_role(UserRole.admin))],
) -> JSONResponse:
    return JSONResponse(content=success_response({"admin": user_to_public(user)}))
