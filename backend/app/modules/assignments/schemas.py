from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import AssignmentDecision, AssignmentStatus


class RecommendationItem(BaseModel):
    resource_id: UUID
    name: str
    distance_meters: float
    capability_match: bool
    load: int
    score: float
    recommendation_reason: str


class RecommendationsResponse(BaseModel):
    items: list[RecommendationItem]
    empty_reason: str | None = None


class AssignRequest(BaseModel):
    resource_id: UUID
    decision: AssignmentDecision
    recommendation_reason: str | None = Field(default=None, max_length=2000)


class AssignmentStatusPatch(BaseModel):
    status: AssignmentStatus
