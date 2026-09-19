"""Alerts domain service (API-019/020 + worker helpers)."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.events import publish_incident_update
from app.core.exceptions import ConflictError, NotFoundError
from app.db.geo import point_to_lat_lng
from app.models.alert import Alert
from app.models.audit_log import AuditLog
from app.models.enums import AlertStatus, AlertType
from app.models.incident import Incident
from app.models.user import User
from app.modules.alerts.rules import (
    active_alert_exists,
    build_alert_message,
    find_critical_unacknowledged,
    find_delayed_incidents,
    find_escalation_candidates,
)
from app.modules.notifications.service import NotificationService


def serialize_alert(row: Alert, incident: Incident | None = None) -> dict:
    location = None
    tracking_ref = None
    category = None
    priority = None
    if incident is not None:
        try:
            lat, lng = point_to_lat_lng(incident.location)
            location = {"latitude": lat, "longitude": lng}
        except (ValueError, TypeError, AttributeError):
            location = None
        tracking_ref = incident.tracking_ref
        category = incident.category.value if incident.category else None
        priority = incident.priority.value if incident.priority else None

    return {
        "id": str(row.id),
        "incident_id": str(row.incident_id) if row.incident_id else None,
        "type": row.type.value,
        "message": row.message,
        "status": row.status.value,
        "acknowledged_by_user_id": str(row.acknowledged_by_user_id)
        if row.acknowledged_by_user_id
        else None,
        "created_at": row.created_at.isoformat(),
        "updated_at": row.updated_at.isoformat(),
        "location": location,
        "tracking_ref": tracking_ref,
        "category": category,
        "priority": priority,
    }


class AlertService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.notifications = NotificationService(session)

    async def ensure_alert(
        self,
        *,
        incident: Incident,
        alert_type: AlertType,
        message: str | None = None,
    ) -> Alert | None:
        """Create active alert if none exists (IT-09 no-duplicate)."""
        if await active_alert_exists(
            self.session, incident_id=incident.id, alert_type=alert_type
        ):
            return None
        row = Alert(
            incident_id=incident.id,
            type=alert_type,
            message=message or build_alert_message(alert_type, incident),
            status=AlertStatus.active,
        )
        self.session.add(row)
        await self.session.flush()
        await self.notifications.notify_alert(
            message=row.message, incident_id=incident.id
        )
        await publish_incident_update(
            {
                "event": "alert.created",
                "alert_id": str(row.id),
                "incident_id": str(incident.id),
                "type": row.type.value,
                "message": row.message,
            }
        )
        return row

    async def ensure_critical_for_incident(self, incident: Incident) -> Alert | None:
        from app.models.enums import IncidentPriority

        if incident.priority != IncidentPriority.critical:
            return None
        return await self.ensure_alert(incident=incident, alert_type=AlertType.critical_incident)

    async def evaluate_all(self, *, delayed_threshold_minutes: int) -> dict[str, int]:
        created = {"critical_incident": 0, "delayed_response": 0, "escalation_required": 0}

        for incident in await find_critical_unacknowledged(self.session):
            if await self.ensure_alert(
                incident=incident, alert_type=AlertType.critical_incident
            ):
                created["critical_incident"] += 1

        for incident in await find_delayed_incidents(
            self.session, threshold_minutes=delayed_threshold_minutes
        ):
            if await self.ensure_alert(
                incident=incident, alert_type=AlertType.delayed_response
            ):
                created["delayed_response"] += 1

        for incident in await find_escalation_candidates(self.session):
            if await self.ensure_alert(
                incident=incident, alert_type=AlertType.escalation_required
            ):
                created["escalation_required"] += 1

        await self.session.commit()
        return created

    async def list_alerts(
        self,
        *,
        status: AlertStatus | None,
        alert_type: AlertType | None,
        page: int,
        limit: int,
    ) -> dict:
        stmt = select(Alert)
        if status:
            stmt = stmt.where(Alert.status == status)
        if alert_type:
            stmt = stmt.where(Alert.type == alert_type)
        total = (
            await self.session.execute(select(func.count()).select_from(stmt.subquery()))
        ).scalar_one()
        rows = (
            await self.session.execute(
                stmt.order_by(Alert.created_at.desc())
                .offset((page - 1) * limit)
                .limit(limit)
            )
        ).scalars().all()
        incident_ids = [a.incident_id for a in rows if a.incident_id]
        incidents: dict = {}
        if incident_ids:
            loaded = (
                await self.session.execute(select(Incident).where(Incident.id.in_(incident_ids)))
            ).scalars().all()
            incidents = {i.id: i for i in loaded}
        return {
            "items": [
                serialize_alert(a, incidents.get(a.incident_id) if a.incident_id else None)
                for a in rows
            ],
            "total": int(total),
            "page": page,
            "limit": limit,
        }

    async def acknowledge(self, alert_id: uuid.UUID, actor: User) -> dict:
        alert = await self.session.get(Alert, alert_id)
        if alert is None:
            raise NotFoundError("Alert not found")
        if alert.status != AlertStatus.active:
            raise ConflictError("Alert already acknowledged or resolved")
        alert.status = AlertStatus.acknowledged
        alert.acknowledged_by_user_id = actor.id
        self.session.add(
            AuditLog(
                actor_user_id=actor.id,
                action="alert.acknowledged",
                entity_type="alert",
                entity_id=alert.id,
                metadata_={"type": alert.type.value},
            )
        )
        await self.session.commit()
        await self.session.refresh(alert)
        incident = None
        if alert.incident_id:
            incident = await self.session.get(Incident, alert.incident_id)
        await publish_incident_update(
            {
                "event": "alert.acknowledged",
                "alert_id": str(alert.id),
                "incident_id": str(alert.incident_id) if alert.incident_id else None,
            }
        )
        return serialize_alert(alert, incident)
