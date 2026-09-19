from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.responses import success_response
from app.db.session import get_db
from app.models.user import User, UserRole
from app.modules.analytics.service import AnalyticsService
from app.modules.auth.dependencies import require_role

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview")
async def analytics_overview(
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.dispatcher, UserRole.admin))],
    date_from: date | None = None,
    date_to: date | None = None,
) -> JSONResponse:
    data = await AnalyticsService(session).overview(date_from, date_to)
    return JSONResponse(content=success_response(data))


@router.get("/incidents-by-category")
async def analytics_by_category(
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.dispatcher, UserRole.admin))],
    date_from: date | None = None,
    date_to: date | None = None,
) -> JSONResponse:
    data = await AnalyticsService(session).by_category(date_from, date_to)
    return JSONResponse(content=success_response(data))


@router.get("/response-delays")
async def analytics_delays(
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.dispatcher, UserRole.admin))],
    date_from: date | None = None,
    date_to: date | None = None,
) -> JSONResponse:
    data = await AnalyticsService(session).delays(date_from, date_to)
    return JSONResponse(content=success_response(data))


@router.get("/hotspots")
async def analytics_hotspots(
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.dispatcher, UserRole.admin))],
    date_from: date | None = None,
    date_to: date | None = None,
) -> JSONResponse:
    data = await AnalyticsService(session).hotspots(date_from, date_to)
    return JSONResponse(content=success_response(data))
