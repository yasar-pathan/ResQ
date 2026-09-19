from app.core.exceptions import ValidationAppError
from app.models.enums import IncidentStatus

ALLOWED: dict[IncidentStatus, set[IncidentStatus]] = {
    IncidentStatus.reported: {
        IncidentStatus.classified,
        IncidentStatus.possible_duplicate,
        IncidentStatus.merged,
        IncidentStatus.assigned,
    },
    IncidentStatus.classified: {IncidentStatus.assigned, IncidentStatus.possible_duplicate, IncidentStatus.merged},
    IncidentStatus.possible_duplicate: {IncidentStatus.merged, IncidentStatus.classified, IncidentStatus.assigned},
    IncidentStatus.merged: set(),
    IncidentStatus.assigned: {IncidentStatus.in_progress, IncidentStatus.resolved},
    IncidentStatus.in_progress: {IncidentStatus.resolved, IncidentStatus.closed},
    IncidentStatus.resolved: {IncidentStatus.closed},
    IncidentStatus.closed: set(),
}


def validate_transition(current: IncidentStatus, new: IncidentStatus) -> None:
    allowed = ALLOWED.get(current, set())
    if new not in allowed and new != current:
        raise ValidationAppError(
            f"Invalid status transition from {current.value} to {new.value}",
            details={"from": current.value, "to": new.value},
        )
