"""Idempotent development seed data for Phase 3 ER verification."""

import asyncio
import uuid

from sqlalchemy import select

from app.config import get_settings
from app.core.security import hash_password
from app.db.geo import point_wkt
from app.db.session import close_db, get_session_factory, init_db
from app.models.assignment import Assignment
from app.models.classification_queue import ClassificationQueue
from app.models.enums import (
    AssignmentDecision,
    AssignmentStatus,
    IncidentCategory,
    IncidentSource,
    IncidentStatus,
    QueueStatus,
    ResourceStatus,
    ResourceType,
)
from app.models.incident import Incident, generate_tracking_ref
from app.models.resource import Resource
from app.models.trusted_contact import TrustedContact
from app.models.user import User, UserRole

SEED_MARKER_TRACKING = "SEED00000001"


async def seed() -> None:
    init_db()
    settings = get_settings()
    factory = get_session_factory()
    async with factory() as session:
        existing = await session.execute(
            select(Incident).where(Incident.tracking_ref == SEED_MARKER_TRACKING)
        )
        if existing.scalar_one_or_none():
            print("Seed data already present; skipping.")
            return

        admin_email = settings.bootstrap_admin_email or "admin@rescuegrid.dev"
        admin = await session.execute(select(User).where(User.email == admin_email.lower()))
        admin_user = admin.scalar_one_or_none()
        if admin_user is None:
            admin_user = User(
                name="Seed Admin",
                email=admin_email.lower(),
                password_hash=hash_password(settings.bootstrap_admin_password or "ChangeMeAdmin123!"),
                role=UserRole.admin,
            )
            session.add(admin_user)
            await session.flush()

        async def ensure_user(email: str, name: str, role: UserRole) -> User:
            result = await session.execute(select(User).where(User.email == email))
            user = result.scalar_one_or_none()
            if user:
                return user
            user = User(
                name=name,
                email=email,
                password_hash=hash_password("ChangeMeOps123!"),
                role=role,
            )
            session.add(user)
            await session.flush()
            return user

        dispatcher = await ensure_user(
            "dispatcher@rescuegrid.dev", "Seed Dispatcher", UserRole.dispatcher
        )
        field_op = await ensure_user(
            "field@rescuegrid.dev", "Seed Field", UserRole.field_team
        )

        resources = [
            Resource(
                type=ResourceType.team,
                name="Fire Team Alpha",
                location=point_wkt(12.97, 77.59),
                capabilities={"handles": ["fire", "medical"]},
                status=ResourceStatus.available,
                operator_user_id=field_op.id,
            ),
            Resource(
                type=ResourceType.vehicle,
                name="Ambulance 3",
                location=point_wkt(12.98, 77.60),
                capabilities={"handles": ["medical"]},
                status=ResourceStatus.assigned,
                operator_user_id=field_op.id,
            ),
        ]
        for r in resources:
            session.add(r)
        await session.flush()

        incidents = [
            Incident(
                tracking_ref=SEED_MARKER_TRACKING,
                category=IncidentCategory.fire,
                description="Seed incident: warehouse smoke reported",
                location=point_wkt(12.9716, 77.5946),
                source=IncidentSource.citizen_web,
                status=IncidentStatus.reported,
                reporter_id=admin_user.id,
            ),
            Incident(
                tracking_ref=generate_tracking_ref(),
                category=IncidentCategory.personal_safety,
                description="Seed personal safety incident",
                location=point_wkt(12.95, 77.58),
                source=IncidentSource.citizen_web,
                is_anonymous=True,
                status=IncidentStatus.classified,
            ),
            Incident(
                tracking_ref=generate_tracking_ref(),
                category=IncidentCategory.flood,
                description="Seed sensor flood detection",
                location=point_wkt(12.96, 77.57),
                source=IncidentSource.sensor,
                status=IncidentStatus.classified,
            ),
        ]
        for inc in incidents:
            session.add(inc)
        await session.flush()

        session.add(
            ClassificationQueue(
                incident_id=incidents[0].id, status=QueueStatus.pending, attempts=0
            )
        )
        session.add(
            TrustedContact(
                incident_id=incidents[1].id,
                name="Trusted Person",
                contact="+10000000000",
            )
        )
        session.add(
            Assignment(
                incident_id=incidents[0].id,
                resource_id=resources[1].id,
                assigned_by_user_id=dispatcher.id,
                assignee_user_id=field_op.id,
                ai_recommended=False,
                decision=AssignmentDecision.manual,
                status=AssignmentStatus.en_route,
            )
        )
        session.add(
            Assignment(
                incident_id=incidents[2].id,
                resource_id=resources[0].id,
                assigned_by_user_id=admin_user.id,
                ai_recommended=True,
                decision=AssignmentDecision.accepted_ai,
                status=AssignmentStatus.completed,
            )
        )
        await session.commit()
        print("Seed data created successfully.")


async def _run() -> None:
    await seed()
    await close_db()


def main() -> None:
    asyncio.run(_run())


if __name__ == "__main__":
    main()
