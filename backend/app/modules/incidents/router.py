import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.core.responses import success_response
from app.db.session import get_db
from app.middleware.rate_limit import limiter
from app.models.enums import IncidentCategory, IncidentStatus
from app.models.user import User, UserRole
from app.modules.auth.dependencies import get_current_user, get_optional_user, require_role
from app.modules.incidents.schemas import (
    IncidentCreateRequest,
    IncidentListParams,
    IncidentStatusPatch,
    SosCreateRequest,
)
from app.modules.incidents.service import IncidentService, serialize_incident

router = APIRouter(prefix="/incidents", tags=["incidents"])


@router.post("", status_code=status.HTTP_201_CREATED)
@limiter.limit("60/minute")
async def create_incident(
    request: Request,
    body: IncidentCreateRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User | None, Depends(get_optional_user)],
) -> JSONResponse:
    service = IncidentService(session)
    incident, reused = await service.create_incident(body, actor)
    message = "Incident retrieved (idempotent)" if reused else "Incident created"
    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content=success_response(serialize_incident(incident), message=message),
    )


@router.post("/sos", status_code=status.HTTP_201_CREATED)
@limiter.limit("60/minute")
async def create_sos(
    request: Request,
    body: SosCreateRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User | None, Depends(get_optional_user)],
) -> JSONResponse:
    service = IncidentService(session)
    incident, reused = await service.create_sos(body, actor)
    message = "SOS retrieved (idempotent)" if reused else "SOS incident created"
    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content=success_response(serialize_incident(incident), message=message),
    )


@router.get("")
async def list_incidents(
    session: Annotated[AsyncSession, Depends(get_db)],
    viewer: Annotated[User, Depends(require_role(UserRole.dispatcher, UserRole.admin))],
    category: IncidentCategory | None = None,
    priority: str | None = None,
    status_filter: IncidentStatus | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=100),
) -> JSONResponse:
    params = IncidentListParams(
        category=category,
        priority=priority,
        status=status_filter,
        page=page,
        limit=limit,
    )
    service = IncidentService(session)
    data = await service.list_incidents(params, viewer=viewer)
    return JSONResponse(content=success_response(data))


@router.get("/{tracking_ref}/status")
async def tracking_status(
    tracking_ref: str,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    service = IncidentService(session)
    data = await service.get_public_status(tracking_ref)
    return JSONResponse(content=success_response(data))


@router.get("/{incident_id:uuid}")
async def get_incident(
    incident_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_db)],
    viewer: Annotated[User, Depends(get_current_user)],
) -> JSONResponse:
    from app.core.exceptions import AuthorizationError

    if viewer.role not in (UserRole.dispatcher, UserRole.admin, UserRole.field_team):
        raise AuthorizationError("Access restricted for your role")
    service = IncidentService(session)
    data = await service.get_incident_detail(incident_id, viewer)
    return JSONResponse(content=success_response(data))


@router.patch("/{incident_id:uuid}/status")
async def patch_incident_status(
    incident_id: uuid.UUID,
    body: IncidentStatusPatch,
    session: Annotated[AsyncSession, Depends(get_db)],
    viewer: Annotated[User, Depends(get_current_user)],
) -> JSONResponse:
    if viewer.role not in (UserRole.dispatcher, UserRole.admin, UserRole.field_team):
        from app.core.exceptions import AuthorizationError

        raise AuthorizationError("Access restricted for your role")
    service = IncidentService(session)
    data = await service.update_status(incident_id, body.status, viewer)
    return JSONResponse(content=success_response(data))
