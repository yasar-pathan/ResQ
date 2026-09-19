import uuid

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError

from app.config import get_settings


def test_partial_unique_index_blocks_double_active_assignment() -> None:
    settings = get_settings()
    sync_url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
    engine = create_engine(sync_url)
    resource_id = uuid.uuid4()
    incident_a = uuid.uuid4()
    incident_b = uuid.uuid4()
    user_id = uuid.uuid4()
    assignment_a = uuid.uuid4()
    assignment_b = uuid.uuid4()

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO users (id, name, email, password_hash, role, is_active, created_at, updated_at)
                VALUES (:id, 'Constraint User', :email, 'hash', 'admin', true, now(), now())
                ON CONFLICT DO NOTHING
                """
            ),
            {"id": user_id, "email": f"constraint-{resource_id}@example.com"},
        )
        conn.execute(
            text(
                """
                INSERT INTO resources (id, type, name, location, status, is_active, created_at, updated_at)
                VALUES (:id, 'team', 'Constraint Team', ST_SetSRID(ST_MakePoint(77.59, 12.97), 4326)::geography,
                        'available', true, now(), now())
                """
            ),
            {"id": resource_id},
        )
        conn.execute(
            text(
                """
                INSERT INTO incidents (id, tracking_ref, category, description, location, source, status,
                    is_anonymous, created_at, updated_at)
                VALUES
                (:a, 'CONSTRAINTA1', 'fire', 'a', ST_SetSRID(ST_MakePoint(77.59, 12.97), 4326)::geography,
                    'citizen_web', 'reported', false, now(), now()),
                (:b, 'CONSTRAINTB1', 'fire', 'b', ST_SetSRID(ST_MakePoint(77.59, 12.97), 4326)::geography,
                    'citizen_web', 'reported', false, now(), now())
                """
            ),
            {"a": incident_a, "b": incident_b},
        )
        conn.execute(
            text(
                """
                INSERT INTO assignments (id, incident_id, resource_id, assigned_by_user_id,
                    ai_recommended, decision, status, created_at, updated_at)
                VALUES (:id, :incident_id, :resource_id, :user_id, false, 'manual', 'confirmed', now(), now())
                """
            ),
            {
                "id": assignment_a,
                "incident_id": incident_a,
                "resource_id": resource_id,
                "user_id": user_id,
            },
        )
        with pytest.raises(IntegrityError):
            conn.execute(
                text(
                    """
                    INSERT INTO assignments (id, incident_id, resource_id, assigned_by_user_id,
                        ai_recommended, decision, status, created_at, updated_at)
                    VALUES (:id, :incident_id, :resource_id, :user_id, false, 'manual', 'en_route', now(), now())
                    """
                ),
                {
                    "id": assignment_b,
                    "incident_id": incident_b,
                    "resource_id": resource_id,
                    "user_id": user_id,
                },
            )
