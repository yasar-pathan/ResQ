from app.models.enums import IncidentCategory, IncidentPriority, IncidentSource
from app.models.incident import Incident
from app.modules.classification.schemas import ClassificationResult


def apply_priority_rules(incident: Incident, result: ClassificationResult) -> ClassificationResult:
    if incident.category == IncidentCategory.personal_safety or incident.source == IncidentSource.sos:
        return result.model_copy(update={"priority": IncidentPriority.critical})
    if incident.priority == IncidentPriority.critical:
        return result.model_copy(update={"priority": IncidentPriority.critical})
    return result
