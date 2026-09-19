from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import ResourceStatus, ResourceType
from app.modules.incidents.schemas import LocationInput


class ResourceCreateRequest(BaseModel):
    type: ResourceType
    name: str = Field(min_length=1, max_length=120)
    location: LocationInput
    capabilities: dict[str, Any] | None = None
    operator_user_id: UUID | None = None


class ResourceUpdateRequest(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    location: LocationInput | None = None
    capabilities: dict[str, Any] | None = None
    status: ResourceStatus | None = None
    is_active: bool | None = None
    operator_user_id: UUID | None = None


class ResourceListParams(BaseModel):
    type: ResourceType | None = None
    status: ResourceStatus | None = None
    active_only: bool = True
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=25, ge=1, le=100)
