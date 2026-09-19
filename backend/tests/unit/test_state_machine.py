import pytest

from app.core.exceptions import ValidationAppError
from app.models.enums import IncidentStatus
from app.modules.incidents.state_machine import validate_transition


def test_ut13_valid_transition_allowed() -> None:
    validate_transition(IncidentStatus.reported, IncidentStatus.classified)


def test_ut13_invalid_transition_raises() -> None:
    with pytest.raises(ValidationAppError) as exc:
        validate_transition(IncidentStatus.resolved, IncidentStatus.reported)
    assert "Invalid status transition" in str(exc.value)


def test_ut13_merged_is_terminal() -> None:
    with pytest.raises(ValidationAppError):
        validate_transition(IncidentStatus.merged, IncidentStatus.assigned)
