import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.assignment import Assignment
from app.models.classification_queue import ClassificationQueue
from app.models.enums import AssignmentStatus, MediaType, QueueStatus
from app.models.incident import Incident
from app.models.incident_idempotency import IncidentIdempotencyKey
from app.models.incident_media import IncidentMedia
from app.models.enums import IncidentCategory, IncidentPriority, IncidentStatus


class IncidentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, incident_id: uuid.UUID) -> Incident | None:
        result = await self.session.execute(select(Incident).where(Incident.id == incident_id))
        return result.scalar_one_or_none()

    async def get_by_tracking_ref(self, tracking_ref: str) -> Incident | None:
        result = await self.session.execute(
            select(Incident).where(Incident.tracking_ref == tracking_ref.upper())
        )
        return result.scalar_one_or_none()

    async def find_idempotent(self, key: str, within_minutes: int = 5) -> Incident | None:
        since = datetime.now(UTC) - timedelta(minutes=within_minutes)
        stmt = (
            select(Incident)
            .join(IncidentIdempotencyKey, IncidentIdempotencyKey.incident_id == Incident.id)
            .where(
                IncidentIdempotencyKey.idempotency_key == key,
                IncidentIdempotencyKey.created_at >= since,
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def add(self, incident: Incident) -> Incident:
        self.session.add(incident)
        await self.session.flush()
        return incident

    async def add_idempotency_key(self, key: str, incident_id: uuid.UUID) -> None:
        self.session.add(IncidentIdempotencyKey(idempotency_key=key, incident_id=incident_id))

    async def enqueue_classification(self, incident_id: uuid.UUID) -> None:
        self.session.add(
            ClassificationQueue(incident_id=incident_id, status=QueueStatus.pending, attempts=0)
        )

    async def add_media(self, incident_id: uuid.UUID, url: str, media_type: MediaType = MediaType.photo) -> None:
        self.session.add(
            IncidentMedia(incident_id=incident_id, type=media_type, storage_url=url)
        )

    async def list_incidents(
        self,
        *,
        category: IncidentCategory | None,
        priority: IncidentPriority | None,
        status: IncidentStatus | None,
        page: int,
        limit: int,
    ) -> tuple[list[Incident], int]:
        stmt = select(Incident)
        if category:
            stmt = stmt.where(Incident.category == category)
        if priority:
            stmt = stmt.where(Incident.priority == priority)
        if status:
            stmt = stmt.where(Incident.status == status)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.session.execute(count_stmt)).scalar_one()
        stmt = (
            stmt.order_by(Incident.priority.desc().nullslast(), Incident.created_at.asc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
        rows = (await self.session.execute(stmt)).scalars().all()
        return list(rows), int(total)

    async def is_field_team_assigned(self, incident_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        # Phase 8 will link field_team users to resources; until then, active assignment on incident.
        _ = user_id
        stmt = select(Assignment.id).where(
            Assignment.incident_id == incident_id,
            Assignment.status.in_(
                [
                    AssignmentStatus.confirmed,
                    AssignmentStatus.en_route,
                    AssignmentStatus.on_scene,
                ]
            ),
        )
        result = await self.session.execute(stmt.limit(1))
        return result.scalar_one_or_none() is not None
