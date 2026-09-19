from app.models.enums import ResourceStatus
from app.modules.resources.service import ALLOWED_STATUS_TRANSITIONS


def test_ut10_resource_status_transition_matrix() -> None:
    assert ResourceStatus.assigned in ALLOWED_STATUS_TRANSITIONS[ResourceStatus.available]
    assert ResourceStatus.available in ALLOWED_STATUS_TRANSITIONS[ResourceStatus.unavailable]
    assert ResourceStatus.assigned not in ALLOWED_STATUS_TRANSITIONS[ResourceStatus.unavailable]
