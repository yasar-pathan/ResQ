from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.core.responses import success_response
from app.db.session import get_db
from app.models.user import User, UserRole
from app.modules.assignments.schemas import AssignmentStatusPatch, AssignRequest
from app.modules.assignments.service import AssignmentService
from app.modules.auth.dependencies import get_current_user, require_role

router = APIRouter(prefix="/assignments", tags=["assignments"])


@router.get("")
async def list_my_assignments(
    session: Annotated[AsyncSession, Depends(get_db)],
    viewer: Annotated[User, Depends(get_current_user)],
) -> JSONResponse:
    """Field-team assignment list (own rows); dispatchers/admins see their assignee filter via field UI."""
    service = AssignmentService(session)
    if viewer.role == UserRole.field_team:
        items = await service.list_for_field_team(viewer.id)
    elif viewer.role in (UserRole.dispatcher, UserRole.admin):
        items = await service.list_active()
    else:
        from app.core.exceptions import AuthorizationError

        raise AuthorizationError("Access restricted for your role")
    return JSONResponse(content=success_response({"items": items}))


@router.get("/{assignment_id}")
async def get_assignment(
    assignment_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db)],
    viewer: Annotated[User, Depends(get_current_user)],
) -> JSONResponse:
    service = AssignmentService(session)
    data = await service.get_assignment(assignment_id, viewer)
    return JSONResponse(content=success_response(data))


@router.patch("/{assignment_id}/status")
async def patch_assignment_status(
    assignment_id: UUID,
    body: AssignmentStatusPatch,
    session: Annotated[AsyncSession, Depends(get_db)],
    viewer: Annotated[
        User,
        Depends(require_role(UserRole.field_team, UserRole.dispatcher, UserRole.admin)),
    ],
) -> JSONResponse:
    service = AssignmentService(session)
    data = await service.update_status(assignment_id, body.status, viewer)
    return JSONResponse(content=success_response(data))


# Assign is nested under incidents (API-014); kept here for import clarity.
assign_router = APIRouter(tags=["assignments"])


@assign_router.get("/incidents/{incident_id}/recommendations")
async def get_recommendations(
    incident_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.dispatcher, UserRole.admin))],
) -> JSONResponse:
    service = AssignmentService(session)
    data = await service.recommendations(incident_id)
    return JSONResponse(content=success_response(data))


@assign_router.post(
    "/incidents/{incident_id}/assign",
    status_code=status.HTTP_201_CREATED,
)
async def assign_resource(
    incident_id: UUID,
    body: AssignRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_role(UserRole.dispatcher, UserRole.admin))],
) -> JSONResponse:
    service = AssignmentService(session)
    data = await service.assign(incident_id, body, actor)
    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content=success_response(data, message="Assignment confirmed"),
    )
