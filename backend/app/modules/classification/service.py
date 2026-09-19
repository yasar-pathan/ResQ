import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.core.events import publish_incident_update
from app.models.audit_log import AuditLog
from app.models.classification_queue import ClassificationQueue
from app.models.enums import ClassificationSource, IncidentStatus, QueueStatus
from app.models.incident import Incident
from app.modules.classification.fallback import classify_fallback
from app.modules.classification.llm_client import LLMClient, LLMClientError
from app.modules.classification.priority_rules import apply_priority_rules
from app.modules.classification.schemas import ClassificationResult
from app.modules.dedup.service import DedupService

logger = logging.getLogger(__name__)


class ClassificationService:
    def __init__(self, session: AsyncSession, settings: Settings | None = None) -> None:
        self.session = session
        self.settings = settings or get_settings()
        self.llm = LLMClient(self.settings)
        self.dedup = DedupService(session, self.settings)

    async def classify_incident(self, incident: Incident) -> tuple[ClassificationResult, ClassificationSource]:
        source = ClassificationSource.fallback
        try:
            if self.llm.is_configured():
                result = await self.llm.classify(incident)
                source = ClassificationSource.llm
            else:
                result = classify_fallback(incident)
        except LLMClientError:
            result = classify_fallback(incident)
            source = ClassificationSource.fallback

        result = apply_priority_rules(incident, result)
        return result, source

    def _apply_result_to_incident(
        self, incident: Incident, result: ClassificationResult, source: ClassificationSource
    ) -> None:
        incident.severity = result.severity
        incident.priority = result.priority
        incident.ai_summary = result.summary
        incident.ai_confidence = result.confidence
        incident.classification_source = source
        if result.category is not None:
            incident.category = result.category

    async def process_incident(self, incident_id: uuid.UUID) -> Incident | None:
        incident = await self.session.get(Incident, incident_id)
        if incident is None:
            return None
        if incident.status != IncidentStatus.reported:
            return incident

        result, source = await self.classify_incident(incident)
        self._apply_result_to_incident(incident, result, source)
        incident.status = IncidentStatus.classified

        try:
            await self.dedup.evaluate_after_classification(incident)
        except Exception:
            logger.exception("Dedup failed for incident %s", incident_id)

        self.session.add(
            AuditLog(
                action="incident.classified",
                entity_type="incident",
                entity_id=incident.id,
                metadata_={
                    "classification_source": source.value,
                    "priority": incident.priority.value if incident.priority else None,
                    "status": incident.status.value,
                },
            )
        )
        await self.session.flush()

        from app.modules.alerts.service import AlertService

        await AlertService(self.session).ensure_critical_for_incident(incident)

        await publish_incident_update(
            {
                "event": "incident.classified",
                "incident_id": str(incident.id),
                "status": incident.status.value,
                "priority": incident.priority.value if incident.priority else None,
            }
        )
        return incident

    async def process_queue_item(self, queue_id: uuid.UUID) -> bool:
        """Process one queue row and commit (for integration tests)."""
        row = await self.session.get(ClassificationQueue, queue_id)
        if row is None:
            return False
        await self.process_incident(row.incident_id)
        row.status = QueueStatus.done
        await self.session.commit()
        return True
