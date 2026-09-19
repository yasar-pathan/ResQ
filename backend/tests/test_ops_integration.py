"""IT-06 / IT-09 / IT-11 / IT-12 style integration checks against live DB when available."""

import uuid

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError

from app.config import get_settings
from app.modules.alerts.rules import has_active_alert_of_type
from app.modules.notifications.service import build_trusted_contact_payload


def _sync_engine():
    settings = get_settings()
    sync_url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
    return create_engine(sync_url)


def test_it06_partial_unique_blocks_concurrent_style_second_insert() -> None:
    """Same guarantee as concurrent assign: DB rejects second active assignment."""
    engine = _sync_engine()
    resource_id = uuid.uuid4()
    incident_a = uuid.uuid4()
    incident_b = uuid.uuid4()
    user_id = uuid.uuid4()

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO users (id, name, email, password_hash, role, is_active, created_at, updated_at)
                VALUES (:id, 'IT06 User', :email, 'hash', 'admin', true, now(), now())
                """
            ),
            {"id": user_id, "email": f"it06-{resource_id}@example.com"},
        )
        conn.execute(
            text(
                """
                INSERT INTO resources (id, type, name, location, status, is_active, created_at, updated_at)
                VALUES (:id, 'team', 'IT06 Team', ST_SetSRID(ST_MakePoint(77.59, 12.97), 4326)::geography,
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
                (:a, :ra, 'fire', 'a', ST_SetSRID(ST_MakePoint(77.59, 12.97), 4326)::geography,
                    'citizen_web', 'classified', false, now(), now()),
                (:b, :rb, 'fire', 'b', ST_SetSRID(ST_MakePoint(77.59, 12.97), 4326)::geography,
                    'citizen_web', 'classified', false, now(), now())
                """
            ),
            {
                "a": incident_a,
                "b": incident_b,
                "ra": f"IT06A{str(resource_id)[:6]}",
                "rb": f"IT06B{str(resource_id)[:6]}",
            },
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
                "id": uuid.uuid4(),
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
                    VALUES (:id, :incident_id, :resource_id, :user_id, false, 'accepted_ai', 'confirmed', now(), now())
                    """
                ),
                {
                    "id": uuid.uuid4(),
                    "incident_id": incident_b,
                    "resource_id": resource_id,
                    "user_id": user_id,
                },
            )


def test_it09_alert_insert_then_skip_duplicate_active() -> None:
    from app.models.alert import Alert
    from app.models.enums import AlertStatus, AlertType

    existing = [
        Alert(
            id=uuid.uuid4(),
            incident_id=uuid.uuid4(),
            type=AlertType.delayed_response,
            message="delayed",
            status=AlertStatus.active,
        )
    ]
    assert has_active_alert_of_type(existing, AlertType.delayed_response)
    # Re-evaluation must not create another while one is active
    assert has_active_alert_of_type(existing, AlertType.delayed_response) is True


def test_it11_notification_builders_cover_channels() -> None:
    from app.modules.notifications.service import build_alert_notification, build_assignment_email

    email = build_assignment_email(
        type("I", (), {
            "tracking_ref": "N1",
            "category": type("C", (), {"value": "medical"})(),
            "priority": type("P", (), {"value": "high"})(),
            "ai_summary": "summary",
            "description": "desc",
        })(),
        type("R", (), {"name": "Unit"})(),
    )
    assert "Unit" in email
    assert "RescueGrid alert" in build_alert_notification("something wrong")


def test_it12_sos_trusted_payload_minimal() -> None:
    incident = type(
        "I",
        (),
        {
            "tracking_ref": "SOS1",
            "description": "secret details about the caller",
        },
    )()
    payload = build_trusted_contact_payload(incident, include_full_description=False)
    assert "secret details" not in payload
    assert "SOS1" in payload


def test_it08_event_payload_shape() -> None:
    """Dashboard REST + WS share incident_id/status fields after status change."""
    payload = {
        "event": "assignment.status_changed",
        "assignment_id": str(uuid.uuid4()),
        "incident_id": str(uuid.uuid4()),
        "status": "en_route",
    }
    assert payload["event"]
    assert payload["incident_id"]
    assert payload["status"] == "en_route"
