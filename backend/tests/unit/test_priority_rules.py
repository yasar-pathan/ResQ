from decimal import Decimal

from app.models.enums import IncidentCategory, IncidentPriority, IncidentSource, IncidentStatus
from app.models.incident import Incident
from app.modules.classification.priority_rules import apply_priority_rules
from app.modules.classification.schemas import ClassificationResult


def test_ut05_personal_safety_forces_critical() -> None:
    incident = Incident(
        category=IncidentCategory.personal_safety,
        description="Need help",
        source=IncidentSource.citizen_web,
        status=IncidentStatus.reported,
    )
    result = ClassificationResult(
        severity=2,
        priority=IncidentPriority.low,
        summary="Low priority from model",
        confidence=Decimal("0.9"),
    )
    adjusted = apply_priority_rules(incident, result)
    assert adjusted.priority == IncidentPriority.critical


def test_ut05_sos_source_forces_critical() -> None:
    incident = Incident(
        category=IncidentCategory.medical,
        description="SOS",
        source=IncidentSource.sos,
        status=IncidentStatus.reported,
        priority=IncidentPriority.critical,
    )
    result = ClassificationResult(
        severity=2,
        priority=IncidentPriority.low,
        summary="Low",
        confidence=Decimal("0.5"),
    )
    adjusted = apply_priority_rules(incident, result)
    assert adjusted.priority == IncidentPriority.critical
