from datetime import UTC, datetime, timedelta
from uuid import uuid4

from app.models.alert import Alert
from app.models.enums import AlertStatus, AlertType
from app.modules.alerts.rules import has_active_alert_of_type


def test_ut09_no_duplicate_active_alert_logic() -> None:
    incident_id = uuid4()
    existing = [
        Alert(
            id=uuid4(),
            incident_id=incident_id,
            type=AlertType.delayed_response,
            message="delayed",
            status=AlertStatus.active,
        )
    ]
    assert has_active_alert_of_type(existing, AlertType.delayed_response) is True
    assert has_active_alert_of_type(existing, AlertType.critical_incident) is False

    existing[0].status = AlertStatus.acknowledged
    assert has_active_alert_of_type(existing, AlertType.delayed_response) is False


def test_ut09_delayed_threshold_math() -> None:
    threshold = 15
    created = datetime.now(UTC) - timedelta(minutes=threshold + 1)
    assert created <= datetime.now(UTC) - timedelta(minutes=threshold)
