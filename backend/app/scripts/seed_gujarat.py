"""Idempotent development seed for Gujarat region (Bit N Build '26 Gujarat Round)."""

import asyncio
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.core.security import hash_password
from app.db.geo import point_wkt
from app.db.session import close_db, get_session_factory, init_db
from app.models.alert import Alert
from app.models.assignment import Assignment
from app.models.enums import (
    AlertStatus,
    AlertType,
    AssignmentDecision,
    AssignmentStatus,
    ClassificationSource,
    IncidentCategory,
    IncidentPriority,
    IncidentSource,
    IncidentStatus,
    ResourceStatus,
    ResourceType,
)
from app.models.incident import Incident, generate_tracking_ref
from app.models.resource import Resource
from app.models.user import User, UserRole

GUJARAT_SEED_MARKER = "SEEDGUJ00001"

# Gujarat Municipal Coordinates
AMD_CENTRAL = (23.0225, 72.5714)       # Lal Darwaja / Central Ahmedabad
AMD_SATELLITE = (23.0300, 72.5180)     # Satellite / SG Highway
AMD_CIVIL = (23.0525, 72.5950)         # Asarwa / Civil Hospital
AMD_VATVA = (22.9560, 72.6320)         # Vatva GIDC Industrial
GANDHINAGAR = (23.2156, 72.6369)       # Sector 11 / Capital City
SURAT_CENTRAL = (21.1702, 72.8311)     # Surat City Center
SURAT_HAZIRA = (21.1065, 72.6348)      # Hazira Industrial / Port
VADODARA = (22.3072, 73.1812)          # Sayaji / Vadodara
RAJKOT = (22.3039, 70.8022)            # Rajkot Urban Center


async def seed_gujarat() -> None:
    init_db()
    factory = get_session_factory()
    async with factory() as session:
        # 1. Ensure core users exist
        async def ensure_user(email: str, name: str, role: UserRole) -> User:
            res = await session.execute(select(User).where(User.email == email))
            u = res.scalar_one_or_none()
            if u:
                return u
            u = User(
                name=name,
                email=email,
                password_hash=hash_password("ChangeMeOps123!"),
                role=role,
            )
            session.add(u)
            await session.flush()
            return u

        dispatcher = await ensure_user("dispatcher@rescuegrid.dev", "Gujarat Dispatcher", UserRole.dispatcher)
        field_op = await ensure_user("field@rescuegrid.dev", "Gujarat Field Response", UserRole.field_team)

        # 2. Check if Gujarat seed marker already exists
        existing = await session.execute(
            select(Incident).where(Incident.tracking_ref == GUJARAT_SEED_MARKER)
        )
        if existing.scalar_one_or_none():
            print(f"Gujarat seed data already present ({GUJARAT_SEED_MARKER}).")
            return

        # 3. Create Gujarat Demo Emergency Resources
        guj_resources = [
            Resource(
                type=ResourceType.team,
                name="Gujarat SDRF Quick Response Battalion (Gandhinagar)",
                location=point_wkt(*GANDHINAGAR),
                capabilities={"handles": ["fire", "medical", "flood", "industrial_accident"]},
                status=ResourceStatus.available,
                operator_user_id=field_op.id,
            ),
            Resource(
                type=ResourceType.team,
                name="Ahmedabad Fire Brigade Squad 1 (Satellite)",
                location=point_wkt(*AMD_SATELLITE),
                capabilities={"handles": ["fire", "industrial_accident"]},
                status=ResourceStatus.available,
                operator_user_id=field_op.id,
            ),
            Resource(
                type=ResourceType.vehicle,
                name="Ahmedabad Advanced Life Support Ambulance 108 (Civil Hospital)",
                location=point_wkt(*AMD_CIVIL),
                capabilities={"handles": ["medical", "personal_safety"]},
                status=ResourceStatus.available,
                operator_user_id=field_op.id,
            ),
            Resource(
                type=ResourceType.team,
                name="Gujarat Police 112 Rapid Patrol (SG Highway)",
                location=point_wkt(23.0360, 72.5080),
                capabilities={"handles": ["personal_safety", "road_incident"]},
                status=ResourceStatus.available,
                operator_user_id=field_op.id,
            ),
            Resource(
                type=ResourceType.equipment,
                name="Sabarmati Riverfront Flood & Water Rescue Boat Unit",
                location=point_wkt(23.0270, 72.5730),
                capabilities={"handles": ["flood"]},
                status=ResourceStatus.available,
                operator_user_id=field_op.id,
            ),
            Resource(
                type=ResourceType.team,
                name="Surat Hazmat & Chemical Rescue Squad (Hazira)",
                location=point_wkt(*SURAT_HAZIRA),
                capabilities={"handles": ["industrial_accident", "fire"]},
                status=ResourceStatus.available,
                operator_user_id=field_op.id,
            ),
            Resource(
                type=ResourceType.vehicle,
                name="Surat Emergency Medical Ambulance 108 (Majura Gate)",
                location=point_wkt(21.1760, 72.8220),
                capabilities={"handles": ["medical", "road_incident"]},
                status=ResourceStatus.available,
                operator_user_id=field_op.id,
            ),
            Resource(
                type=ResourceType.team,
                name="Vadodara Emergency Disaster Squad (Sayajigunj)",
                location=point_wkt(*VADODARA),
                capabilities={"handles": ["medical", "road_incident", "fire"]},
                status=ResourceStatus.available,
                operator_user_id=field_op.id,
            ),
            Resource(
                type=ResourceType.team,
                name="Rajkot Rapid Disaster Response Team (University Road)",
                location=point_wkt(*RAJKOT),
                capabilities={"handles": ["fire", "flood", "medical"]},
                status=ResourceStatus.available,
                operator_user_id=field_op.id,
            ),
            Resource(
                type=ResourceType.facility,
                name="Ahmedabad Civil Hospital Emergency Command Center",
                location=point_wkt(*AMD_CIVIL),
                capabilities={"handles": ["medical", "industrial_accident"]},
                status=ResourceStatus.available,
                operator_user_id=field_op.id,
            ),
        ]

        for r in guj_resources:
            session.add(r)
        await session.flush()

        now = datetime.now(UTC)

        # 4. Create Gujarat Demo Incidents
        guj_inc1 = Incident(
            tracking_ref=GUJARAT_SEED_MARKER,
            category=IncidentCategory.industrial_accident,
            description="Toxic chemical pipeline rupture and vapor cloud observed near chemical processing plant in Vatva GIDC. Urgent Hazmat squad required.",
            location=point_wkt(*AMD_VATVA),
            address_text="Phase 4, Vatva GIDC Industrial Estate, Ahmedabad",
            source=IncidentSource.citizen_web,
            severity=5,
            priority=IncidentPriority.critical,
            status=IncidentStatus.classified,
            ai_summary="Severe chemical pipeline rupture in Vatva GIDC. High vapor toxicity risk requiring immediate hazmat isolation.",
            ai_confidence=0.96,
            classification_source=ClassificationSource.llm,
            created_at=now - timedelta(minutes=6),
            updated_at=now - timedelta(minutes=5),
        )

        guj_inc2 = Incident(
            tracking_ref=generate_tracking_ref(),
            category=IncidentCategory.fire,
            description="Commercial complex fire on 4th floor near Satellite cross road. Multiple occupants evacuating, thick black smoke billowing.",
            location=point_wkt(*AMD_SATELLITE),
            address_text="Near ISKCON Cross Road, Satellite, Ahmedabad",
            source=IncidentSource.call,
            severity=4,
            priority=IncidentPriority.high,
            status=IncidentStatus.assigned,
            ai_summary="Structure fire in high-rise commercial premises, Satellite. Fire suppression and evacuation in progress.",
            ai_confidence=0.91,
            classification_source=ClassificationSource.llm,
            created_at=now - timedelta(minutes=18),
            updated_at=now - timedelta(minutes=14),
        )

        guj_inc3 = Incident(
            tracking_ref=generate_tracking_ref(),
            category=IncidentCategory.personal_safety,
            description="Urgent SOS alert triggered by citizen. Lone commuter feeling threatened near darkened transit hub.",
            location=point_wkt(*GANDHINAGAR),
            address_text="Near Sector 11 Bus Rapid Station, Gandhinagar",
            source=IncidentSource.sos,
            severity=5,
            priority=IncidentPriority.critical,
            status=IncidentStatus.classified,
            is_anonymous=True,
            ai_summary="Critical personal safety SOS triggered near Gandhinagar transit corridor. Police patrol unit dispatch recommended.",
            ai_confidence=0.98,
            classification_source=ClassificationSource.llm,
            created_at=now - timedelta(minutes=3),
            updated_at=now - timedelta(minutes=2),
        )

        guj_inc4 = Incident(
            tracking_ref=generate_tracking_ref(),
            category=IncidentCategory.road_incident,
            description="Multiple vehicle pileup on NH 48 expressway bypass near Vadodara. Ambulance and extrication gear needed.",
            location=point_wkt(*VADODARA),
            address_text="NH 48 Golden Quadrilateral Bypass, Vadodara",
            source=IncidentSource.citizen_web,
            severity=4,
            priority=IncidentPriority.high,
            status=IncidentStatus.classified,
            ai_summary="Highway multi-vehicle collision with trapped victims. Advanced life support ambulance required.",
            ai_confidence=0.93,
            classification_source=ClassificationSource.llm,
            created_at=now - timedelta(minutes=22),
            updated_at=now - timedelta(minutes=20),
        )

        guj_inc5 = Incident(
            tracking_ref=generate_tracking_ref(),
            category=IncidentCategory.flood,
            description="Rapid urban waterlogging and storm drain overflow near Ring Road. Vehicles stranded in 3 feet water.",
            location=point_wkt(*RAJKOT),
            address_text="150 Feet Ring Road, Rajkot",
            source=IncidentSource.sensor,
            severity=3,
            priority=IncidentPriority.medium,
            status=IncidentStatus.classified,
            ai_summary="Urban street flooding detected by sensor telemetry. Municipal water rescue unit advised.",
            ai_confidence=0.88,
            classification_source=ClassificationSource.fallback,
            created_at=now - timedelta(minutes=35),
            updated_at=now - timedelta(minutes=32),
        )

        for inc in [guj_inc1, guj_inc2, guj_inc3, guj_inc4, guj_inc5]:
            session.add(inc)
        await session.flush()

        # 5. Create demo assignment and active alert
        session.add(
            Assignment(
                incident_id=guj_inc2.id,
                resource_id=guj_resources[1].id,  # Ahmedabad Fire Squad 1
                assigned_by_user_id=dispatcher.id,
                assignee_user_id=field_op.id,
                ai_recommended=True,
                decision=AssignmentDecision.accepted_ai,
                status=AssignmentStatus.en_route,
            )
        )

        session.add(
            Alert(
                incident_id=guj_inc1.id,
                type=AlertType.critical_incident,
                message="Critical chemical leak emergency in Vatva GIDC, Ahmedabad requires immediate dispatch acknowledgment.",
                status=AlertStatus.active,
            )
        )
        session.add(
            Alert(
                incident_id=guj_inc3.id,
                type=AlertType.critical_incident,
                message="SOS Panic alert triggered in Gandhinagar Sector 11 — Top Priority.",
                status=AlertStatus.active,
            )
        )

        await session.commit()
        print(f"SUCCESS: Gujarat demo resources and incidents created ({GUJARAT_SEED_MARKER}).")


async def main() -> None:
    await seed_gujarat()
    await close_db()


if __name__ == "__main__":
    asyncio.run(main())
