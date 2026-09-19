from decimal import Decimal

from app.models.enums import IncidentCategory, IncidentPriority
from app.models.incident import Incident
from app.modules.classification.schemas import ClassificationResult

_CATEGORY_DEFAULTS: dict[IncidentCategory, tuple[int, IncidentPriority]] = {
    IncidentCategory.fire: (4, IncidentPriority.high),
    IncidentCategory.flood: (4, IncidentPriority.high),
    IncidentCategory.industrial_accident: (4, IncidentPriority.high),
    IncidentCategory.road_incident: (3, IncidentPriority.medium),
    IncidentCategory.medical: (4, IncidentPriority.high),
    IncidentCategory.personal_safety: (5, IncidentPriority.critical),
    IncidentCategory.other: (2, IncidentPriority.medium),
}

_URGENCY_KEYWORDS: tuple[tuple[str, int], ...] = (
    ("explosion", 1),
    ("trapped", 1),
    ("unconscious", 1),
    ("bleeding", 1),
    ("fire", 0),
    ("smoke", 0),
    ("flood", 0),
    ("weapon", 0),
    ("assault", 0),
    ("help", 0),
)


def classify_fallback(incident: Incident) -> ClassificationResult:
    severity, priority = _CATEGORY_DEFAULTS.get(
        incident.category, (3, IncidentPriority.medium)
    )
    text = incident.description.lower()
    for keyword, bump in _URGENCY_KEYWORDS:
        if keyword in text:
            severity = min(5, severity + bump + 1)
            if severity >= 4:
                priority = IncidentPriority.high
            if severity >= 5:
                priority = IncidentPriority.critical
            break

    summary = (
        f"Fallback classification for {incident.category.value} report "
        f"(source: {incident.source.value}). "
        f"{incident.description[:200].strip()}"
    )
    return ClassificationResult(
        severity=severity,
        priority=priority,
        summary=summary[:2000],
        confidence=Decimal("0.45"),
        category=incident.category,
    )
