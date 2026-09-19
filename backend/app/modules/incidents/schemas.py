from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import IncidentCategory, IncidentSource, IncidentStatus


class LocationInput(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class IncidentCreateRequest(BaseModel):
    category: IncidentCategory
    description: str = Field(min_length=1, max_length=5000)
    location: LocationInput
    address_text: str | None = Field(default=None, max_length=500)
    source: IncidentSource = IncidentSource.citizen_web
    idempotency_key: str = Field(min_length=8, max_length=128)
    is_anonymous: bool = False
    photo_url: str | None = Field(default=None, max_length=500)


class IncidentStatusPatch(BaseModel):
    status: IncidentStatus


class IncidentPublicStatus(BaseModel):
    tracking_ref: str
    status: IncidentStatus
    updated_at: datetime


class IncidentListParams(BaseModel):
    category: IncidentCategory | None = None
    priority: str | None = None
    status: IncidentStatus | None = None
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=25, ge=1, le=100)
