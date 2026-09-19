import uuid
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthenticationError, AuthorizationError, NotFoundError
from app.db.geo import point_to_lat_lng, point_wkt
from app.models.enums import IncidentCategory, IncidentPriority, IncidentSource, IncidentStatus
from app.models.incident import Incident
from app.models.user import User, UserRole
from app.modules.incidents.pii import resolve_pii_visibility
from app.modules.incidents.repository import IncidentRepository
from app.modules.incidents.schemas import (
    IncidentCreateRequest,
    IncidentListParams,
    SosCreateRequest,
)
from app.modules.incidents.state_machine import validate_transition


AUTH_REQUIRED_SOURCES = {
    IncidentSource.sensor,
    IncidentSource.call,
    IncidentSource.field_team,
}


def serialize_incident(incident: Incident, viewer: User | None = None, pii: dict | None = None) -> dict:
    lat, lng = point_to_lat_lng(incident.location)
    data = {
        "id": str(incident.id),
        "tracking_ref": incident.tracking_ref,
        "category": incident.category.value,
        "description": incident.description,
        "location": {"latitude": lat, "longitude": lng},
        "address_text": incident.address_text,
        "source": incident.source.value,
        "severity": incident.severity,
        "priority": incident.priority.value if incident.priority else None,
        "status": incident.status.value,
        "is_anonymous": incident.is_anonymous,
        "ai_summary": incident.ai_summary,
        "ai_confidence": float(incident.ai_confidence) if incident.ai_confidence is not None else None,
        "classification_source": (
            incident.classification_source.value if incident.classification_source else None
        ),
        "classified_at": (
            incident.updated_at.isoformat() if incident.classification_source else None
        ),
        "created_at": incident.created_at.isoformat(),
        "updated_at": incident.updated_at.isoformat(),
    }
    if pii is not None:
        data["pii"] = pii
    return data


class IncidentService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = IncidentRepository(session)
        self.session = session

    async def create_incident(
        self, body: IncidentCreateRequest, actor: User | None
    ) -> tuple[Incident, bool]:
        if body.source in AUTH_REQUIRED_SOURCES and actor is None:
            raise AuthenticationError("Authentication required for this intake source")

        existing = await self.repo.find_idempotent(body.idempotency_key)
        if existing:
            return existing, True

        initial_priority = None
        if body.source == IncidentSource.sos:
            initial_priority = IncidentPriority.critical
        elif body.category == IncidentCategory.personal_safety:
            initial_priority = IncidentPriority.critical

        incident = Incident(
            category=body.category,
            description=body.description,
            location=point_wkt(body.location.latitude, body.location.longitude),
            address_text=body.address_text,
            source=body.source,
            is_anonymous=body.is_anonymous,
            reporter_id=actor.id if actor and not body.is_anonymous else None,
            status=IncidentStatus.reported,
            priority=initial_priority,
        )
        await self.repo.add(incident)
        await self.repo.add_idempotency_key(body.idempotency_key, incident.id)
        await self.repo.enqueue_classification(incident.id)
        if body.photo_url:
            await self.repo.add_media(incident.id, body.photo_url)
        await self.session.commit()
        await self.session.refresh(incident)
        return incident, False

    async def create_sos(
        self, body: SosCreateRequest, actor: User | None
    ) -> tuple[Incident, bool]:
        create_body = IncidentCreateRequest(
            category=IncidentCategory.personal_safety,
            description=body.description,
            location=body.location,
            source=IncidentSource.sos,
            idempotency_key=body.idempotency_key,
            is_anonymous=body.is_anonymous,
        )
        incident, reused = await self.create_incident(create_body, actor)
        if not reused and body.trusted_contacts:
            await self.repo.add_trusted_contacts(
                incident.id,
                [(c.name, c.contact) for c in body.trusted_contacts],
            )
            from app.modules.notifications.service import NotificationService

            await NotificationService(self.session).notify_trusted_contacts(incident)
            await self.session.commit()
            await self.session.refresh(incident)

        if not reused:
            from app.modules.alerts.service import AlertService

            await AlertService(self.session).ensure_critical_for_incident(incident)
            await self.session.commit()
            await self.session.refresh(incident)
        return incident, reused

    async def get_public_status(self, tracking_ref: str) -> dict:
        incident = await self.repo.get_by_tracking_ref(tracking_ref)
        if incident is None:
            raise NotFoundError("Incident not found", details={"tracking_ref": tracking_ref})
        return {
            "tracking_ref": incident.tracking_ref,
            "status": incident.status.value,
            "updated_at": incident.updated_at.isoformat(),
        }

    async def list_incidents(self, params: IncidentListParams, viewer: User | None = None) -> dict:
        from app.models.enums import IncidentPriority

        priority = IncidentPriority(params.priority) if params.priority else None
        rows, total = await self.repo.list_incidents(
            category=params.category,
            priority=priority,
            status=params.status,
            page=params.page,
            limit=params.limit,
        )
        items = []
        for i in rows:
            pii = await resolve_pii_visibility(self.session, i, viewer)
            items.append(serialize_incident(i, viewer, pii=pii))
        await self.session.commit()
        return {
            "items": items,
            "total": total,
            "page": params.page,
            "limit": params.limit,
        }

    async def get_incident_detail(self, incident_id: uuid.UUID, viewer: User) -> dict:
        incident = await self.repo.get_by_id(incident_id)
        if incident is None:
            raise NotFoundError("Incident not found")

        if viewer.role == UserRole.field_team:
            has_assignment = await self.repo.is_field_team_assigned(incident_id, viewer.id)
            if not has_assignment:
                raise AuthorizationError("Access restricted for your role")

        pii = await resolve_pii_visibility(self.session, incident, viewer)
        await self.session.commit()
        return serialize_incident(incident, viewer, pii=pii)

    async def update_status(
        self, incident_id: uuid.UUID, new_status: IncidentStatus, viewer: User
    ) -> dict:
        incident = await self.repo.get_by_id(incident_id)
        if incident is None:
            raise NotFoundError("Incident not found")

        if viewer.role == UserRole.field_team:
            has_assignment = await self.repo.is_field_team_assigned(incident_id, viewer.id)
            if not has_assignment:
                raise AuthorizationError("Access restricted for your role")

        validate_transition(incident.status, new_status)
        incident.status = new_status
        if new_status in (IncidentStatus.resolved, IncidentStatus.closed):
            incident.resolved_at = datetime.now(UTC)
        await self.session.commit()
        await self.session.refresh(incident)
        return serialize_incident(incident)
