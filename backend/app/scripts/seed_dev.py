"""Idempotent development seed data — India-oriented demo incidents, resources, alerts."""

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

# Bump marker when seed shape changes so existing DBs pick up a fresh demo set.
SEED_MARKER_TRACKING = "SEED00000002"


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
            print("Seed incidents already present (SEED00000002); ops users ensured.")
            return

        # Same-city resources for coherent dispatch demos
        blr_team = Resource(
            type=ResourceType.team,
            name="Bengaluru Fire Team Alpha",
            location=point_wkt(12.9716, 77.5946),
            capabilities={"handles": ["fire", "medical"]},
            status=ResourceStatus.available,
            operator_user_id=field_op.id,
        )
        mum_ambulance = Resource(
            type=ResourceType.vehicle,
            name="Mumbai Ambulance 3",
            location=point_wkt(19.0760, 72.8777),
            capabilities={"handles": ["medical"]},
            status=ResourceStatus.assigned,
            operator_user_id=field_op.id,
        )
        chn_facility = Resource(
            type=ResourceType.facility,
            name="Chennai Command Post",
            location=point_wkt(13.0827, 80.2707),
            capabilities={"handles": ["flood", "medical"]},
            status=ResourceStatus.available,
            operator_user_id=None,
        )
        del_equipment = Resource(
            type=ResourceType.equipment,
            name="Delhi Pump Unit",
            location=point_wkt(28.6139, 77.2090),
            capabilities={"handles": ["fire", "flood"]},
            status=ResourceStatus.available,
            operator_user_id=None,
        )
        hyd_team = Resource(
            type=ResourceType.team,
            name="Hyderabad Medical Squad",
            location=point_wkt(17.3850, 78.4867),
            capabilities={"handles": ["medical"]},
            status=ResourceStatus.available,
            operator_user_id=field_op.id,
        )
        resources = [blr_team, mum_ambulance, chn_facility, del_equipment, hyd_team]
        for r in resources:
            session.add(r)
        await session.flush()

        blr_fire = Incident(
            tracking_ref=SEED_MARKER_TRACKING,
            category=IncidentCategory.fire,
            description="Seed: warehouse smoke reported (Bengaluru)",
            location=point_wkt(12.9716, 77.5946),
            source=IncidentSource.citizen_web,
            status=IncidentStatus.assigned,
            priority=IncidentPriority.critical,
            reporter_id=admin_user.id,
        )
        mum_ps = Incident(
            tracking_ref=generate_tracking_ref(),
            category=IncidentCategory.personal_safety,
            description="Seed: personal safety report (Mumbai)",
            location=point_wkt(19.0760, 72.8777),
            source=IncidentSource.sos,
            is_anonymous=True,
            status=IncidentStatus.in_progress,
            priority=IncidentPriority.high,
        )
        chn_flood = Incident(
            tracking_ref=generate_tracking_ref(),
            category=IncidentCategory.flood,
            description="Seed: sensor flood detection (Chennai)",
            location=point_wkt(13.0827, 80.2707),
            source=IncidentSource.sensor,
            status=IncidentStatus.classified,
            priority=IncidentPriority.medium,
        )
        del_fire = Incident(
            tracking_ref=generate_tracking_ref(),
            category=IncidentCategory.fire,
            description="Seed: industrial fire response (Delhi)",
            location=point_wkt(28.6139, 77.2090),
            source=IncidentSource.citizen_web,
            status=IncidentStatus.classified,
            priority=IncidentPriority.critical,
        )
        hyd_medical = Incident(
            tracking_ref=generate_tracking_ref(),
            category=IncidentCategory.medical,
            description="Seed: medical assist (Hyderabad)",
            location=point_wkt(17.3850, 78.4867),
            source=IncidentSource.citizen_web,
            status=IncidentStatus.reported,
            priority=IncidentPriority.high,
        )
        kol_flood = Incident(
            tracking_ref=generate_tracking_ref(),
            category=IncidentCategory.flood,
            description="Seed: flood watch (Kolkata)",
            location=point_wkt(22.5726, 88.3639),
            source=IncidentSource.sensor,
            status=IncidentStatus.classified,
            priority=IncidentPriority.medium,
        )
        # Extra points for hotspot buckets near major cities
        blr_road = Incident(
            tracking_ref=generate_tracking_ref(),
            category=IncidentCategory.road_incident,
            description="Seed: road collision near MG Road (Bengaluru)",
            location=point_wkt(12.9750, 77.6060),
            source=IncidentSource.citizen_web,
            status=IncidentStatus.reported,
            priority=IncidentPriority.medium,
        )
        mum_medical = Incident(
            tracking_ref=generate_tracking_ref(),
            category=IncidentCategory.medical,
            description="Seed: medical standby (Mumbai Bandra)",
            location=point_wkt(19.0596, 72.8295),
            source=IncidentSource.call,
            status=IncidentStatus.reported,
            priority=IncidentPriority.low,
        )
        incidents = [
            blr_fire,
            mum_ps,
            chn_flood,
            del_fire,
            hyd_medical,
            kol_flood,
            blr_road,
            mum_medical,
        ]
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
                incident_id=mum_ps.id,
                name="Trusted Contact Mumbai",
                contact="+919876543210",
            )
        )

        # Same-city assignments
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
                incident_id=mum_ps.id,
                resource_id=mum_ambulance.id,
                assigned_by_user_id=dispatcher.id,
                assignee_user_id=field_op.id,
                ai_recommended=True,
                decision=AssignmentDecision.accepted_ai,
                status=AssignmentStatus.on_scene,
            )
        )
        session.add(
            Assignment(
                incident_id=chn_flood.id,
                resource_id=chn_facility.id,
                assigned_by_user_id=admin_user.id,
                ai_recommended=True,
                decision=AssignmentDecision.accepted_ai,
                status=AssignmentStatus.completed,
            )
        )

        # Active alerts with locations via incident join
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
                incident_id=del_fire.id,
                type=AlertType.critical_incident,
                message="Critical industrial fire in Delhi — escalate if unassigned.",
                status=AlertStatus.active,
            )
        )
        session.add(
            Alert(
                incident_id=hyd_medical.id,
                type=AlertType.delayed_response,
                message="Hyderabad medical assist still reported — response delayed.",
                status=AlertStatus.active,
            )
        )
        session.add(
            Alert(
                incident_id=chn_flood.id,
                type=AlertType.escalation_required,
                message="Chennai flood watch may need escalation for resources.",
                status=AlertStatus.active,
            )
        )

        await session.commit()
        print("Seed data created successfully (SEED00000002 — India demo + alerts).")


async def _run() -> None:
    await seed()
    await close_db()


def main() -> None:
    asyncio.run(_run())


if __name__ == "__main__":
    main()
