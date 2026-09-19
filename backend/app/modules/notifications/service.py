"""Notification content builders and delivery (Phase 8)."""

from __future__ import annotations

import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.assignment import Assignment
from app.models.enums import (
    NotificationChannel,
    NotificationStatus,
    NotificationTargetType,
)
from app.models.incident import Incident
from app.models.notification import Notification
from app.models.resource import Resource
from app.models.trusted_contact import TrustedContact
from app.modules.notifications.email_client import EmailClient
from app.modules.notifications.sms_simulator import SmsSimulator

logger = logging.getLogger(__name__)


def build_assignment_email(incident: Incident, resource: Resource) -> str:
    summary = incident.ai_summary or incident.description[:280]
    return (
        f"RescueGrid assignment: {resource.name}\n"
        f"Incident {incident.tracking_ref} ({incident.category.value})\n"
        f"Priority: {incident.priority.value if incident.priority else 'n/a'}\n"
        f"Summary: {summary}"
    )


def build_trusted_contact_payload(
    incident: Incident, *, include_full_description: bool = False
) -> str:
    """UT-16: default payload excludes full incident description."""
    base = (
        f"RescueGrid alert: someone you listed as a trusted contact requested help "
        f"(ref {incident.tracking_ref}). Priority is critical."
    )
    if include_full_description:
        return f"{base}\nDetails: {incident.description}"
    return f"{base} Location has been shared with responders."


def build_alert_notification(message: str) -> str:
    return f"RescueGrid alert: {message}"


class NotificationService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.email = EmailClient(get_settings())
        self.sms = SmsSimulator()

    async def _persist(
        self,
        *,
        target_type: NotificationTargetType,
        target_ref: str,
        channel: NotificationChannel,
        content: str,
        related_incident_id: uuid.UUID | None,
        status: NotificationStatus,
    ) -> Notification:
        row = Notification(
            target_type=target_type,
            target_ref=target_ref,
            channel=channel,
            content=content,
            status=status,
            related_incident_id=related_incident_id,
        )
        self.session.add(row)
        await self.session.flush()
        return row

    async def notify_assignment(
        self, assignment: Assignment, incident: Incident, resource: Resource
    ) -> None:
        content = build_assignment_email(incident, resource)
        target = (
            str(assignment.assignee_user_id)
            if assignment.assignee_user_id
            else f"resource:{resource.id}"
        )
        sent = await self.email.send(to=target, subject="New assignment", body=content)
        status = NotificationStatus.sent if sent else NotificationStatus.queued
        # Sandbox: always mark sent when no API key (logged delivery)
        if not self.email.is_configured():
            status = NotificationStatus.sent
            logger.info("Simulated email assignment notify → %s", target)
        await self._persist(
            target_type=NotificationTargetType.user,
            target_ref=target,
            channel=NotificationChannel.email,
            content=content,
            related_incident_id=incident.id,
            status=status,
        )
        sms_body = f"Assigned to {resource.name} for incident {incident.tracking_ref}"
        await self.sms.send(to=target, body=sms_body)
        await self._persist(
            target_type=NotificationTargetType.user,
            target_ref=target,
            channel=NotificationChannel.sms_simulated,
            content=sms_body,
            related_incident_id=incident.id,
            status=NotificationStatus.sent,
        )

    async def notify_trusted_contacts(self, incident: Incident) -> int:
        from sqlalchemy import select

        result = await self.session.execute(
            select(TrustedContact).where(TrustedContact.incident_id == incident.id)
        )
        contacts = list(result.scalars().all())
        count = 0
        for contact in contacts:
            content = build_trusted_contact_payload(incident, include_full_description=False)
            await self.sms.send(to=contact.contact, body=content)
            await self._persist(
                target_type=NotificationTargetType.trusted_contact,
                target_ref=contact.contact,
                channel=NotificationChannel.sms_simulated,
                content=content,
                related_incident_id=incident.id,
                status=NotificationStatus.sent,
            )
            from datetime import UTC, datetime

            contact.notified_at = datetime.now(UTC)
            count += 1
        return count

    async def notify_alert(self, *, message: str, incident_id: uuid.UUID | None) -> None:
        content = build_alert_notification(message)
        await self._persist(
            target_type=NotificationTargetType.user,
            target_ref="dispatchers",
            channel=NotificationChannel.push_simulated,
            content=content,
            related_incident_id=incident_id,
            status=NotificationStatus.sent,
        )

    async def list_for_user(self, user_id: uuid.UUID, page: int, limit: int) -> dict:
        from sqlalchemy import func, or_, select

        uid = str(user_id)
        stmt = select(Notification).where(
            or_(
                Notification.target_ref == uid,
                Notification.target_ref == "dispatchers",
            )
        )
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.session.execute(count_stmt)).scalar_one()
        rows = (
            await self.session.execute(
                stmt.order_by(Notification.created_at.desc())
                .offset((page - 1) * limit)
                .limit(limit)
            )
        ).scalars().all()
        return {
            "items": [
                {
                    "id": str(n.id),
                    "channel": n.channel.value,
                    "content": n.content,
                    "status": n.status.value,
                    "related_incident_id": str(n.related_incident_id)
                    if n.related_incident_id
                    else None,
                    "created_at": n.created_at.isoformat(),
                }
                for n in rows
            ],
            "total": int(total),
            "page": page,
            "limit": limit,
        }
