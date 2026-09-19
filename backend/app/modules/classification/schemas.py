from decimal import Decimal

from pydantic import BaseModel, Field, field_validator

from app.models.enums import IncidentCategory, IncidentPriority


class ClassificationResult(BaseModel):
    severity: int = Field(ge=1, le=5)
    priority: IncidentPriority
    summary: str = Field(min_length=1, max_length=2000)
    confidence: Decimal = Field(ge=0, le=1)
    category: IncidentCategory | None = None

    @field_validator("confidence", mode="before")
    @classmethod
    def coerce_confidence(cls, value: object) -> object:
        if isinstance(value, (int, float)):
            return Decimal(str(value))
        return value
