"""PII visibility resolver (SEC-011) with audit logging."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.assignment import Assignment
from app.models.audit_log import AuditLog
from app.models.enums import AssignmentStatus, IncidentCategory
from app.models.incident import Incident
from app.models.user import User, UserRole

ACTIVE_ASSIGNMENT = {
    AssignmentStatus.proposed,
    AssignmentStatus.confirmed,
    AssignmentStatus.en_route,
    AssignmentStatus.on_scene,
}


async def viewer_has_active_assignment(
    session: AsyncSession, incident_id: uuid.UUID, user_id: uuid.UUID
) -> bool:
    result = await session.execute(
        select(Assignment.id).where(
            Assignment.incident_id == incident_id,
            Assignment.status.in_(ACTIVE_ASSIGNMENT),
            (Assignment.assignee_user_id == user_id)
            | (Assignment.assigned_by_user_id == user_id),
        ).limit(1)
    )
    return result.scalar_one_or_none() is not None


async def resolve_pii_visibility(
    session: AsyncSession,
    incident: Incident,
    viewer: User | None,
) -> dict[str, Any]:
    """Return reporter fields; personal_safety restricted unless admin or assigned."""
    if incident.category != IncidentCategory.personal_safety:
        return {
            "restricted": False,
            "reporter_id": str(incident.reporter_id) if incident.reporter_id else None,
        }

    if viewer is None:
        await _audit(session, None, incident.id, granted=False)
        return {"restricted": True, "reporter_id": None}

    if viewer.role == UserRole.admin:
        await _audit(session, viewer.id, incident.id, granted=True)
        return {
            "restricted": False,
            "reporter_id": str(incident.reporter_id) if incident.reporter_id else None,
        }

    assigned = await viewer_has_active_assignment(session, incident.id, viewer.id)
    if assigned and viewer.role in (UserRole.dispatcher, UserRole.field_team):
        await _audit(session, viewer.id, incident.id, granted=True)
        return {
            "restricted": False,
            "reporter_id": str(incident.reporter_id) if incident.reporter_id else None,
        }

    await _audit(session, viewer.id, incident.id, granted=False)
    return {"restricted": True, "reporter_id": None}


async def _audit(
    session: AsyncSession,
    actor_user_id: uuid.UUID | None,
    incident_id: uuid.UUID,
    *,
    granted: bool,
) -> None:
    session.add(
        AuditLog(
            actor_user_id=actor_user_id,
            action="pii.read" if granted else "pii.denied",
            entity_type="incident",
            entity_id=incident_id,
            metadata_={"granted": granted},
        )
    )
    await session.flush()
