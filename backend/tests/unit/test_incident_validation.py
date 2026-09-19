import pytest
from pydantic import ValidationError

from app.modules.incidents.schemas import IncidentCreateRequest, LocationInput


def test_ut01_incident_create_requires_valid_location() -> None:
    with pytest.raises(ValidationError):
        IncidentCreateRequest(
            category="fire",
            description="valid description text",
            location=LocationInput(latitude=100, longitude=0),
            idempotency_key="key-12345678",
        )
