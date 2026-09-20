import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.core.responses import success_response
from app.db.session import get_db
from app.models.enums import ResourceStatus, ResourceType
from app.models.user import User, UserRole
from app.modules.auth.dependencies import require_role
from app.modules.resources.schemas import ResourceCreateRequest, ResourceListParams, ResourceUpdateRequest
from app.modules.resources.service import ResourceService

router = APIRouter(prefix="/resources", tags=["resources"])


@router.get("")
async def list_resources(
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.dispatcher, UserRole.admin))],
    type: ResourceType | None = None,
    status: ResourceStatus | None = None,
    active_only: bool = Query(default=True),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=100),
) -> JSONResponse:
    params = ResourceListParams(
        type=type, status=status, active_only=active_only, page=page, limit=limit
    )
    service = ResourceService(session)
    return JSONResponse(content=success_response(await service.list_resources(params)))


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_resource(
    body: ResourceCreateRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.dispatcher, UserRole.admin))],
) -> JSONResponse:
    service = ResourceService(session)
    data = await service.create(body)
    return JSONResponse(status_code=status.HTTP_201_CREATED, content=success_response(data))


@router.patch("/{resource_id}")
async def update_resource(
    resource_id: uuid.UUID,
    body: ResourceUpdateRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.dispatcher, UserRole.admin))],
) -> JSONResponse:
    service = ResourceService(session)
    data = await service.update(resource_id, body)
    return JSONResponse(content=success_response(data))


@router.delete("/{resource_id}")
async def delete_resource(
    resource_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.dispatcher, UserRole.admin))],
) -> JSONResponse:
    service = ResourceService(session)
    await service.delete(resource_id)
    return JSONResponse(content=success_response(None, message="Resource deleted successfully"))

