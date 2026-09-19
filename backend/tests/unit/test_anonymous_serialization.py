import uuid
from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import patch

from app.models.enums import IncidentCategory, IncidentPriority, IncidentSource, IncidentStatus
from app.models.incident import Incident
from app.modules.incidents.service import serialize_incident


def test_ut15_serialize_never_includes_reporter_id() -> None:
    now = datetime.now(UTC)
    incident = Incident(
        id=uuid.uuid4(),
        tracking_ref="ABCD12345678",
        category=IncidentCategory.fire,
        description="Smoke reported near depot",
        source=IncidentSource.citizen_web,
        status=IncidentStatus.reported,
        priority=IncidentPriority.high,
        is_anonymous=True,
        reporter_id=uuid.uuid4(),
        ai_confidence=Decimal("0.9"),
        severity=3,
        created_at=now,
        updated_at=now,
    )
    with patch("app.modules.incidents.service.point_to_lat_lng", return_value=(12.97, 77.59)):
        data = serialize_incident(incident)
    assert "reporter_id" not in data
    assert data["is_anonymous"] is True
    assert data["ai_confidence"] == 0.9
