"""Idempotently provision dedicated login credentials for all emergency resources in Gujarat."""

import asyncio
import re
from sqlalchemy import select, update
from app.core.security import hash_password
from app.db.session import close_db, get_session_factory, init_db
from app.models.assignment import Assignment
from app.models.resource import Resource
from app.models.user import User, UserRole

DEFAULT_PASSWORD = "RescueGrid2026!"

GUJARAT_CREDENTIALS_MAP = {
    "Gujarat SDRF Quick Response Battalion (Gandhinagar)": {
        "email": "sdrf.gandhinagar@rescuegrid.in",
        "name": "Gujarat SDRF Battalion",
        "city": "Gandhinagar",
    },
    "Ahmedabad Fire Brigade Squad 1 (Satellite)": {
        "email": "fire.satellite@rescuegrid.in",
        "name": "Ahmedabad Fire Squad 1",
        "city": "Ahmedabad (Satellite)",
    },
    "Ahmedabad Advanced Life Support Ambulance 108 (Civil Hospital)": {
        "email": "als108.civil.amd@rescuegrid.in",
        "name": "Ahmedabad ALS Ambulance 108",
        "city": "Ahmedabad (Civil Hospital)",
    },
    "Gujarat Police 112 Rapid Patrol (SG Highway)": {
        "email": "police112.sghighway@rescuegrid.in",
        "name": "Gujarat Police 112 Patrol",
        "city": "Ahmedabad (SG Highway)",
    },
    "Sabarmati Riverfront Flood & Water Rescue Boat Unit": {
        "email": "boat.sabarmati@rescuegrid.in",
        "name": "Sabarmati Water Rescue Unit",
        "city": "Ahmedabad (Riverfront)",
    },
    "Surat Hazmat & Chemical Rescue Squad (Hazira)": {
        "email": "hazmat.surat@rescuegrid.in",
        "name": "Surat Hazmat Squad",
        "city": "Surat (Hazira)",
    },
    "Surat Emergency Medical Ambulance 108 (Majura Gate)": {
        "email": "ambulance108.surat@rescuegrid.in",
        "name": "Surat Ambulance 108",
        "city": "Surat (Majura Gate)",
    },
    "Vadodara Emergency Disaster Squad (Sayajigunj)": {
        "email": "disaster.vadodara@rescuegrid.in",
        "name": "Vadodara Disaster Squad",
        "city": "Vadodara (Sayajigunj)",
    },
    "Rajkot Rapid Disaster Response Team (University Road)": {
        "email": "disaster.rajkot@rescuegrid.in",
        "name": "Rajkot Disaster Response",
        "city": "Rajkot (University Rd)",
    },
    "Ahmedabad Civil Hospital Emergency Command Center": {
        "email": "command.civil.amd@rescuegrid.in",
        "name": "Ahmedabad Hospital Command",
        "city": "Ahmedabad (Asarwa)",
    },
}


async def provision():
    init_db()
    factory = get_session_factory()
    results = []

    async with factory() as session:
        # 1. Fetch all resources
        res = await session.execute(select(Resource))
        all_resources = res.scalars().all()

        for r in all_resources:
            # Check if this resource matches Gujarat mapping or is in Gujarat bounds
            mapping = GUJARAT_CREDENTIALS_MAP.get(r.name)
            if not mapping:
                # Check by name keyword
                if any(k in r.name.lower() for k in ["gujarat", "ahmedabad", "surat", "vadodara", "rajkot", "sabarmati", "gandhinagar"]):
                    slug = re.sub(r"[^a-zA-Z0-9]+", ".", r.name.lower()).strip(".")[:25]
                    mapping = {
                        "email": f"{slug}@rescuegrid.in",
                        "name": r.name,
                        "city": "Gujarat Region",
                    }

            if not mapping:
                continue

            target_email = mapping["email"]

            # 2. Check or create User
            u_stmt = select(User).where(User.email == target_email)
            existing_user = (await session.execute(u_stmt)).scalar_one_or_none()
            if not existing_user:
                new_user = User(
                    name=mapping["name"],
                    email=target_email,
                    password_hash=hash_password(DEFAULT_PASSWORD),
                    role=UserRole.field_team,
                    is_active=True,
                )
                session.add(new_user)
                await session.flush()
                user = new_user
            else:
                # Update password to ensure it matches DEFAULT_PASSWORD and role is field_team
                existing_user.password_hash = hash_password(DEFAULT_PASSWORD)
                existing_user.role = UserRole.field_team
                existing_user.is_active = True
                user = existing_user

            # 3. Link resource operator_user_id
            r.operator_user_id = user.id

            # 4. Update any existing assignments for this resource
            assign_stmt = select(Assignment).where(Assignment.resource_id == r.id)
            assignments = (await session.execute(assign_stmt)).scalars().all()
            for a in assignments:
                a.assignee_user_id = user.id

            results.append({
                "resource_id": str(r.id),
                "resource_name": r.name,
                "type": r.type.value,
                "city": mapping["city"],
                "email": target_email,
                "password": DEFAULT_PASSWORD,
                "active_assignments": len(assignments),
            })

        await session.commit()

    await close_db()
    return results


if __name__ == "__main__":
    out = asyncio.run(provision())
    print("\n--- PROVISIONED GUJARAT RESOURCE CREDENTIALS ---")
    for row in out:
        print(f"[{row['type'].upper()}] {row['resource_name']} | City: {row['city']} | Email: {row['email']} | Password: {row['password']} | Tasks: {row['active_assignments']}")
