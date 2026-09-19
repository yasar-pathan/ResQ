import uuid
from datetime import UTC, datetime

from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.events import publish_incident_update
from app.core.exceptions import ConflictError, NotFoundError, ValidationAppError
from app.models.assignment import Assignment
from app.models.audit_log import AuditLog
from app.models.enums import (
    AssignmentDecision,
    AssignmentStatus,
    IncidentStatus,
    ResourceStatus,
)
from app.models.incident import Incident
from app.models.resource import Resource
from app.models.user import User, UserRole
from app.modules.assignments.scoring import (
    RankedCandidate,
    build_reason,
    capability_matches,
    rank_candidates,
    score_candidate,
)
from app.modules.assignments.schemas import AssignRequest
from app.modules.incidents.state_machine import validate_transition
from app.modules.notifications.service import NotificationService


ACTIVE_ASSIGNMENT = [
    AssignmentStatus.proposed,
    AssignmentStatus.confirmed,
    AssignmentStatus.en_route,
    AssignmentStatus.on_scene,
]


def serialize_assignment(row: Assignment) -> dict:
    return {
        "id": str(row.id),
        "incident_id": str(row.incident_id),
        "resource_id": str(row.resource_id),
        "assigned_by_user_id": str(row.assigned_by_user_id),
        "assignee_user_id": str(row.assignee_user_id) if row.assignee_user_id else None,
        "ai_recommended": row.ai_recommended,
        "recommendation_reason": row.recommendation_reason,
        "decision": row.decision.value,
        "status": row.status.value,
        "assigned_at": row.assigned_at.isoformat() if row.assigned_at else None,
        "created_at": row.created_at.isoformat(),
        "updated_at": row.updated_at.isoformat(),
    }


class AssignmentService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.notifications = NotificationService(session)

    async def recommendations(self, incident_id: uuid.UUID) -> dict:
        incident = await self.session.get(Incident, incident_id)
        if incident is None:
            raise NotFoundError("Incident not found")

        stmt = text(
            """
            SELECT
                r.id,
                r.name,
                r.capabilities,
                ST_Distance(
                    r.location,
                    (SELECT location FROM incidents WHERE id = :incident_id)
                ) AS distance_m,
                (
                    SELECT COUNT(*)::int FROM assignments a
                    WHERE a.resource_id = r.id
                      AND a.status NOT IN ('completed', 'cancelled')
                ) AS load
            FROM resources r
            WHERE r.is_active = true
              AND r.status = 'available'
            ORDER BY distance_m ASC
            LIMIT 50
            """
        )
        rows = (
            await self.session.execute(stmt, {"incident_id": incident_id})
        ).mappings().all()

        ranked: list[RankedCandidate] = []
        category = incident.category.value
        for row in rows:
            caps = row["capabilities"] or {}
            match = capability_matches(caps if isinstance(caps, dict) else {}, category)
            dist = float(row["distance_m"])
            load = int(row["load"] or 0)
            score = score_candidate(
                distance_meters=dist, capability_match=match, load=load
            )
            name = row["name"]
            ranked.append(
                RankedCandidate(
                    resource_id=str(row["id"]),
                    name=name,
                    distance_meters=dist,
                    capability_match=match,
                    load=load,
                    score=score,
                    recommendation_reason=build_reason(
                        name=name,
                        distance_meters=dist,
                        capability_match=match,
                        category=category,
                    ),
                )
            )

        top = rank_candidates(ranked, limit=3)
        if not top:
            from app.models.enums import AlertType
            from app.modules.alerts.service import AlertService

            await AlertService(self.session).ensure_alert(
                incident=incident,
                alert_type=AlertType.escalation_required,
            )
            await self.session.commit()
            return {
                "items": [],
                "empty_reason": "no_resource_available",
            }
        return {
            "items": [
                {
                    "resource_id": c.resource_id,
                    "name": c.name,
                    "distance_meters": round(c.distance_meters, 2),
                    "capability_match": c.capability_match,
                    "load": c.load,
                    "score": round(c.score, 4),
                    "recommendation_reason": c.recommendation_reason,
                }
                for c in top
            ],
            "empty_reason": None,
        }

    async def get_assignment(self, assignment_id: uuid.UUID, actor: User) -> dict:
        assignment = await self.session.get(Assignment, assignment_id)
        if assignment is None:
            raise NotFoundError("Assignment not found")
        if actor.role == UserRole.field_team and assignment.assignee_user_id != actor.id:
            from app.core.exceptions import AuthorizationError

            raise AuthorizationError("You can only view your own assignments")
        data = serialize_assignment(assignment)
        incident = await self.session.get(Incident, assignment.incident_id)
        resource = await self.session.get(Resource, assignment.resource_id)
        if incident:
            data["incident"] = {
                "id": str(incident.id),
                "tracking_ref": incident.tracking_ref,
                "category": incident.category.value,
                "priority": incident.priority.value if incident.priority else None,
                "status": incident.status.value,
                "ai_summary": incident.ai_summary,
                "description": incident.description
                if incident.category.value != "personal_safety"
                else None,
            }
        if resource:
            data["resource"] = {
                "id": str(resource.id),
                "name": resource.name,
                "type": resource.type.value,
                "status": resource.status.value,
            }
        return data

    async def assign(
        self, incident_id: uuid.UUID, body: AssignRequest, actor: User
    ) -> dict:
        incident = await self.session.get(Incident, incident_id)
        if incident is None:
            raise NotFoundError("Incident not found")
        if incident.status in (IncidentStatus.merged, IncidentStatus.closed, IncidentStatus.resolved):
            raise ValidationAppError("Incident cannot be assigned in its current status")

        resource = await self.session.get(
            Resource,
            body.resource_id,
            with_for_update=True,
        )
        if resource is None or not resource.is_active:
            raise NotFoundError("Resource not found")
        if resource.status != ResourceStatus.available:
            raise ConflictError("Resource unavailable", details={"resource_id": str(resource.id)})

        existing = await self.session.execute(
            select(Assignment).where(
                Assignment.resource_id == resource.id,
                Assignment.status.in_(ACTIVE_ASSIGNMENT),
            )
        )
        if existing.scalar_one_or_none() is not None:
            raise ConflictError("Resource already has an active assignment")

        if incident.status not in (
            IncidentStatus.assigned,
            IncidentStatus.in_progress,
        ):
            validate_transition(incident.status, IncidentStatus.assigned)

        assignment = Assignment(
            incident_id=incident.id,
            resource_id=resource.id,
            assigned_by_user_id=actor.id,
            assignee_user_id=resource.operator_user_id,
            ai_recommended=body.decision == AssignmentDecision.accepted_ai,
            recommendation_reason=body.recommendation_reason,
            decision=body.decision,
            status=AssignmentStatus.confirmed,
            assigned_at=datetime.now(UTC),
        )
        self.session.add(assignment)
        resource.status = ResourceStatus.assigned
        incident.status = IncidentStatus.assigned

        self.session.add(
            AuditLog(
                actor_user_id=actor.id,
                action="incident.assigned",
                entity_type="assignment",
                entity_id=assignment.id,
                metadata_={
                    "decision": body.decision.value,
                    "resource_id": str(resource.id),
                    "incident_id": str(incident.id),
                },
            )
        )

        try:
            await self.session.flush()
        except IntegrityError as exc:
            await self.session.rollback()
            raise ConflictError(
                "Assignment conflict (resource may already be assigned)"
            ) from exc

        await self.notifications.notify_assignment(assignment, incident, resource)
        await self.session.commit()
        await self.session.refresh(assignment)

        await publish_incident_update(
            {
                "event": "incident.assigned",
                "incident_id": str(incident.id),
                "assignment_id": str(assignment.id),
                "status": incident.status.value,
            }
        )
        return serialize_assignment(assignment)

    async def update_status(
        self, assignment_id: uuid.UUID, new_status: AssignmentStatus, actor: User
    ) -> dict:
        assignment = await self.session.get(Assignment, assignment_id)
        if assignment is None:
            raise NotFoundError("Assignment not found")

        if actor.role == UserRole.field_team:
            if assignment.assignee_user_id != actor.id:
                from app.core.exceptions import AuthorizationError

                raise AuthorizationError("You can only update your own assignments")

        allowed = {
            AssignmentStatus.confirmed: {
                AssignmentStatus.en_route,
                AssignmentStatus.cancelled,
            },
            AssignmentStatus.en_route: {
                AssignmentStatus.on_scene,
                AssignmentStatus.cancelled,
            },
            AssignmentStatus.on_scene: {
                AssignmentStatus.completed,
                AssignmentStatus.cancelled,
            },
            AssignmentStatus.proposed: {
                AssignmentStatus.confirmed,
                AssignmentStatus.cancelled,
            },
        }
        if new_status not in allowed.get(assignment.status, set()) and new_status != assignment.status:
            raise ValidationAppError(
                f"Invalid assignment status transition from {assignment.status.value} to {new_status.value}"
            )

        assignment.status = new_status
        resource = await self.session.get(Resource, assignment.resource_id)
        incident = await self.session.get(Incident, assignment.incident_id)

        if new_status == AssignmentStatus.en_route and incident:
            if incident.status == IncidentStatus.assigned:
                incident.status = IncidentStatus.in_progress
        if new_status == AssignmentStatus.completed:
            if resource:
                resource.status = ResourceStatus.available
            if incident and incident.status in (
                IncidentStatus.assigned,
                IncidentStatus.in_progress,
            ):
                incident.status = IncidentStatus.resolved
                incident.resolved_at = datetime.now(UTC)
        if new_status == AssignmentStatus.cancelled:
            if resource and resource.status == ResourceStatus.assigned:
                resource.status = ResourceStatus.available

        await self.session.commit()
        await self.session.refresh(assignment)
        await publish_incident_update(
            {
                "event": "assignment.status_changed",
                "assignment_id": str(assignment.id),
                "incident_id": str(assignment.incident_id),
                "status": assignment.status.value,
            }
        )
        return serialize_assignment(assignment)

    async def list_for_field_team(self, user_id: uuid.UUID) -> list[dict]:
        result = await self.session.execute(
            select(Assignment)
            .where(Assignment.assignee_user_id == user_id)
            .order_by(Assignment.created_at.desc())
        )
        return [serialize_assignment(a) for a in result.scalars().all()]

    async def list_active(self) -> list[dict]:
        result = await self.session.execute(
            select(Assignment)
            .where(Assignment.status.in_(ACTIVE_ASSIGNMENT))
            .order_by(Assignment.created_at.desc())
        )
        return [serialize_assignment(a) for a in result.scalars().all()]
