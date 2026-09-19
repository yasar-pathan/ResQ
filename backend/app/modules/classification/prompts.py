from app.models.enums import IncidentCategory, IncidentSource
from app.models.incident import Incident


def build_classification_messages(incident: Incident) -> list[dict[str, str]]:
    category = incident.category.value
    source = incident.source.value
    description = incident.description[:4000]
    system = (
        "You are an emergency triage assistant. Respond with JSON only, no markdown. "
        'Schema: {"severity": 1-5, "priority": "low|medium|high|critical", '
        '"summary": "2-3 sentences", "confidence": 0.0-1.0, '
        '"category": optional same enum as hint}.'
    )
    user = (
        f"Category hint: {category}\n"
        f"Source: {source}\n"
        f"Description: {description}\n"
        "Assign conservative severity/priority when uncertain."
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]
