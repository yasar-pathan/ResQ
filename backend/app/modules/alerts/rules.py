"""Alert rule predicates (UT-09). Pure helpers + evaluation helpers."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert import Alert
from app.models.assignment import Assignment
from app.models.enums import (
    AlertStatus,
    AlertType,
    AssignmentStatus,
    IncidentPriority,
    IncidentStatus,
    ResourceStatus,
)
from app.models.incident import Incident
from app.models.resource import Resource


TERMINAL_INCIDENT = {
    IncidentStatus.resolved,
    IncidentStatus.closed,
    IncidentStatus.merged,
}

ACTIVE_ASSIGNMENT = {
    AssignmentStatus.proposed,
    AssignmentStatus.confirmed,
    AssignmentStatus.en_route,
    AssignmentStatus.on_scene,
}


def has_active_alert_of_type(alerts: list[Alert], alert_type: AlertType) -> bool:
    return any(a.type == alert_type and a.status == AlertStatus.active for a in alerts)


async def active_alert_exists(
    session: AsyncSession,
    *,
    incident_id: UUID | None,
    alert_type: AlertType,
) -> bool:
    stmt = select(Alert.id).where(
        Alert.type == alert_type,
        Alert.status == AlertStatus.active,
    )
    if incident_id is not None:
        stmt = stmt.where(Alert.incident_id == incident_id)
    else:
        stmt = stmt.where(Alert.incident_id.is_(None))
    return (await session.execute(stmt.limit(1))).scalar_one_or_none() is not None


async def find_critical_unacknowledged(session: AsyncSession) -> list[Incident]:
    stmt = select(Incident).where(
        Incident.priority == IncidentPriority.critical,
        Incident.status.not_in(TERMINAL_INCIDENT),
    )
    return list((await session.execute(stmt)).scalars().all())


async def find_delayed_incidents(
    session: AsyncSession, *, threshold_minutes: int
) -> list[Incident]:
    cutoff = datetime.now(UTC) - timedelta(minutes=threshold_minutes)
    open_statuses = [
        IncidentStatus.reported,
        IncidentStatus.classified,
        IncidentStatus.possible_duplicate,
    ]
    # Unassigned past threshold
    assigned_subq = (
        select(Assignment.incident_id)
        .where(Assignment.status.in_(ACTIVE_ASSIGNMENT))
        .distinct()
    )
    stmt = select(Incident).where(
        Incident.status.in_(open_statuses),
        Incident.created_at <= cutoff,
        Incident.id.not_in(assigned_subq),
    )
    return list((await session.execute(stmt)).scalars().all())


async def find_escalation_candidates(session: AsyncSession) -> list[Incident]:
    """High/critical open incidents with zero available resources (E2E-04)."""
    available_count = (
        await session.execute(
            select(Resource.id)
            .where(
                Resource.is_active.is_(True),
                Resource.status == ResourceStatus.available,
            )
            .limit(1)
        )
    ).scalar_one_or_none()
    if available_count is not None:
        return []

    stmt = select(Incident).where(
        Incident.priority.in_([IncidentPriority.high, IncidentPriority.critical]),
        Incident.status.in_(
            [
                IncidentStatus.reported,
                IncidentStatus.classified,
                IncidentStatus.possible_duplicate,
            ]
        ),
    )
    return list((await session.execute(stmt)).scalars().all())


def build_alert_message(alert_type: AlertType, incident: Incident) -> str:
    ref = incident.tracking_ref
    if alert_type == AlertType.critical_incident:
        return f"Critical incident {ref} requires immediate attention"
    if alert_type == AlertType.delayed_response:
        return f"Delayed response: incident {ref} remains unassigned past threshold"
    return f"Escalation required: no available resources for incident {ref}"
