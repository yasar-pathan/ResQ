from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.responses import success_response
from app.db.session import get_db
from app.models.enums import AlertStatus, AlertType
from app.models.user import User, UserRole
from app.modules.alerts.service import AlertService
from app.modules.auth.dependencies import require_role

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("")
async def list_alerts(
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.dispatcher, UserRole.admin))],
    status_filter: AlertStatus | None = Query(default=None, alias="status"),
    type_filter: AlertType | None = Query(default=None, alias="type"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=100),
) -> JSONResponse:
    service = AlertService(session)
    data = await service.list_alerts(
        status=status_filter, alert_type=type_filter, page=page, limit=limit
    )
    return JSONResponse(content=success_response(data))


@router.patch("/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_role(UserRole.dispatcher, UserRole.admin))],
) -> JSONResponse:
    service = AlertService(session)
    data = await service.acknowledge(alert_id, actor)
    return JSONResponse(content=success_response(data, message="Alert acknowledged"))
