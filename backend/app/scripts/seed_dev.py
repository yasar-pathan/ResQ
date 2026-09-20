"""Idempotent development seed — Bengaluru-only demo (India map scope)."""

import asyncio

from sqlalchemy import select

from app.config import get_settings
from app.core.security import hash_password
from app.db.geo import point_wkt
from app.db.session import close_db, get_session_factory, init_db
from app.models.alert import Alert
from app.models.assignment import Assignment
from app.models.classification_queue import ClassificationQueue
from app.models.enums import (
    AlertStatus,
    AlertType,
    AssignmentDecision,
    AssignmentStatus,
    IncidentCategory,
    IncidentPriority,
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

SEED_MARKER_TRACKING = "SEED00000003"

# Bengaluru metro — all demo coordinates stay in-city for India-focused maps.
BLR = (12.9716, 77.5946)
BLR_EAST = (12.9750, 77.6060)
BLR_SOUTH = (12.9352, 77.6245)
BLR_NORTH = (12.9980, 77.5920)
BLR_WEST = (12.9698, 77.5710)


async def seed() -> None:
    init_db()
    settings = get_settings()
    factory = get_session_factory()
    async with factory() as session:
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
        await session.commit()

        existing = await session.execute(
            select(Incident).where(Incident.tracking_ref == SEED_MARKER_TRACKING)
        )
        if existing.scalar_one_or_none():
            print(f"Seed incidents already present ({SEED_MARKER_TRACKING}); ops users ensured.")
            return

        blr_team = Resource(
            type=ResourceType.team,
            name="Bengaluru Fire Team Alpha",
            location=point_wkt(*BLR),
            capabilities={"handles": ["fire", "medical"]},
            status=ResourceStatus.available,
            operator_user_id=field_op.id,
        )
        blr_ambulance = Resource(
            type=ResourceType.vehicle,
            name="Bengaluru Ambulance 3",
            location=point_wkt(*BLR_EAST),
            capabilities={"handles": ["medical"]},
            status=ResourceStatus.assigned,
            operator_user_id=field_op.id,
        )
        blr_facility = Resource(
            type=ResourceType.facility,
            name="Bengaluru Command Post",
            location=point_wkt(*BLR_NORTH),
            capabilities={"handles": ["flood", "medical"]},
            status=ResourceStatus.available,
            operator_user_id=None,
        )
        blr_equipment = Resource(
            type=ResourceType.equipment,
            name="Bengaluru Pump Unit",
            location=point_wkt(*BLR_WEST),
            capabilities={"handles": ["fire", "flood"]},
            status=ResourceStatus.available,
            operator_user_id=None,
        )
        blr_medical = Resource(
            type=ResourceType.team,
            name="Bengaluru Medical Squad",
            location=point_wkt(*BLR_SOUTH),
            capabilities={"handles": ["medical"]},
            status=ResourceStatus.available,
            operator_user_id=field_op.id,
        )
        resources = [blr_team, blr_ambulance, blr_facility, blr_equipment, blr_medical]
        for r in resources:
            session.add(r)
        await session.flush()

        blr_fire = Incident(
            tracking_ref=SEED_MARKER_TRACKING,
            category=IncidentCategory.fire,
            description="Seed: warehouse smoke reported (Bengaluru CBD)",
            location=point_wkt(*BLR),
            source=IncidentSource.citizen_web,
            status=IncidentStatus.assigned,
            priority=IncidentPriority.critical,
            reporter_id=admin_user.id,
        )
        blr_ps = Incident(
            tracking_ref=generate_tracking_ref(),
            category=IncidentCategory.personal_safety,
            description="Seed: personal safety report (Bengaluru)",
            location=point_wkt(*BLR_EAST),
            source=IncidentSource.sos,
            is_anonymous=True,
            status=IncidentStatus.in_progress,
            priority=IncidentPriority.high,
        )
        blr_flood = Incident(
            tracking_ref=generate_tracking_ref(),
            category=IncidentCategory.flood,
            description="Seed: sensor flood detection (Bengaluru north)",
            location=point_wkt(*BLR_NORTH),
            source=IncidentSource.sensor,
            status=IncidentStatus.classified,
            priority=IncidentPriority.medium,
        )
        blr_fire2 = Incident(
            tracking_ref=generate_tracking_ref(),
            category=IncidentCategory.fire,
            description="Seed: industrial fire response (Bengaluru west)",
            location=point_wkt(*BLR_WEST),
            source=IncidentSource.citizen_web,
            status=IncidentStatus.classified,
            priority=IncidentPriority.critical,
        )
        blr_medical_inc = Incident(
            tracking_ref=generate_tracking_ref(),
            category=IncidentCategory.medical,
            description="Seed: medical assist (Bengaluru south)",
            location=point_wkt(*BLR_SOUTH),
            source=IncidentSource.citizen_web,
            status=IncidentStatus.reported,
            priority=IncidentPriority.high,
        )
        blr_road = Incident(
            tracking_ref=generate_tracking_ref(),
            category=IncidentCategory.road_incident,
            description="Seed: road collision near MG Road (Bengaluru)",
            location=point_wkt(*BLR_EAST),
            source=IncidentSource.citizen_web,
            status=IncidentStatus.classified,
            priority=IncidentPriority.medium,
        )
        blr_call = Incident(
            tracking_ref=generate_tracking_ref(),
            category=IncidentCategory.medical,
            description="Seed: dispatcher logged call (Bengaluru)",
            location=point_wkt(*BLR),
            source=IncidentSource.call,
            status=IncidentStatus.reported,
            priority=IncidentPriority.low,
        )
        incidents = [blr_fire, blr_ps, blr_flood, blr_fire2, blr_medical_inc, blr_road, blr_call]
        for inc in incidents:
            session.add(inc)
        await session.flush()

        session.add(
            ClassificationQueue(
                incident_id=blr_fire.id, status=QueueStatus.pending, attempts=0
            )
        )
        session.add(
            TrustedContact(
                incident_id=blr_ps.id,
                name="Trusted Contact",
                contact="+919876543210",
            )
        )

        session.add(
            Assignment(
                incident_id=blr_fire.id,
                resource_id=blr_team.id,
                assigned_by_user_id=dispatcher.id,
                assignee_user_id=field_op.id,
                ai_recommended=False,
                decision=AssignmentDecision.manual,
                status=AssignmentStatus.en_route,
            )
        )
        session.add(
            Assignment(
                incident_id=blr_ps.id,
                resource_id=blr_ambulance.id,
                assigned_by_user_id=dispatcher.id,
                assignee_user_id=field_op.id,
                ai_recommended=True,
                decision=AssignmentDecision.accepted_ai,
                status=AssignmentStatus.on_scene,
            )
        )
        session.add(
            Assignment(
                incident_id=blr_flood.id,
                resource_id=blr_facility.id,
                assigned_by_user_id=admin_user.id,
                ai_recommended=True,
                decision=AssignmentDecision.accepted_ai,
                status=AssignmentStatus.completed,
            )
        )

        session.add(
            Alert(
                incident_id=blr_fire.id,
                type=AlertType.critical_incident,
                message="Critical fire incident in Bengaluru requires immediate acknowledgment.",
                status=AlertStatus.active,
            )
        )
        session.add(
            Alert(
                incident_id=blr_fire2.id,
                type=AlertType.critical_incident,
                message="Critical industrial fire in Bengaluru — escalate if unassigned.",
                status=AlertStatus.active,
            )
        )
        session.add(
            Alert(
                incident_id=blr_medical_inc.id,
                type=AlertType.delayed_response,
                message="Bengaluru medical assist still reported — response delayed.",
                status=AlertStatus.active,
            )
        )
        session.add(
            Alert(
                incident_id=blr_flood.id,
                type=AlertType.escalation_required,
                message="Bengaluru flood watch may need escalation for resources.",
                status=AlertStatus.active,
            )
        )

        await session.commit()
        print(f"Seed data created successfully ({SEED_MARKER_TRACKING} — Bengaluru demo + alerts).")


async def _run() -> None:
    await seed()
    await close_db()


def main() -> None:
    asyncio.run(_run())


if __name__ == "__main__":
    main()
