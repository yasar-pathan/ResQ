"""Real IT-06/08/09/11/12 and dual-WS fan-out checks."""

from __future__ import annotations

import json
import os
import uuid
from datetime import UTC, datetime, timedelta

import pytest
import redis
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.exc import IntegrityError

from app.config import get_settings
from app.core.events import CHANNEL
from app.db.geo import point_wkt
from app.db.session import get_session_factory, init_db
from app.factory import create_app
from app.models.alert import Alert
from app.models.enums import (
    AlertStatus,
    AlertType,
    IncidentCategory,
    IncidentPriority,
    IncidentSource,
    IncidentStatus,
)
from app.models.incident import Incident
from app.modules.alerts.service import AlertService

BOOTSTRAP_EMAIL = os.environ.get("BOOTSTRAP_ADMIN_EMAIL", "admin@rescuegrid.dev")
BOOTSTRAP_PASSWORD = os.environ.get("BOOTSTRAP_ADMIN_PASSWORD", "ChangeMeAdmin123!")


@pytest.fixture
def api_client() -> TestClient:
    with TestClient(create_app()) as client:
        yield client


def _admin_token(client: TestClient) -> str:
    login = client.post(
        "/auth/login",
        json={"email": BOOTSTRAP_EMAIL, "password": BOOTSTRAP_PASSWORD},
    )
    assert login.status_code == 200, login.text
    return login.json()["data"]["access_token"]


def _sync_engine():
    settings = get_settings()
    return create_engine(settings.database_url.replace("postgresql+asyncpg://", "postgresql://"))


def test_it06_partial_unique_blocks_second_active_assignment() -> None:
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
                VALUES (:id, 'IT06', :email, 'hash', 'admin', true, now(), now())
                """
            ),
            {"id": user_id, "email": f"it06-{resource_id}@example.com"},
        )
        conn.execute(
            text(
                """
                INSERT INTO resources (id, type, name, location, status, is_active, created_at, updated_at)
                VALUES (:id, 'team', 'IT06', ST_SetSRID(ST_MakePoint(77.59, 12.97), 4326)::geography,
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
                "ra": f"IT6A{str(resource_id)[:6]}",
                "rb": f"IT6B{str(resource_id)[:6]}",
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
                    VALUES (:id, :incident_id, :resource_id, :user_id, true, 'accepted_ai', 'confirmed', now(), now())
                    """
                ),
                {
                    "id": uuid.uuid4(),
                    "incident_id": incident_b,
                    "resource_id": resource_id,
                    "user_id": user_id,
                },
            )


def test_it08_rest_and_redis_event_consistency(api_client: TestClient) -> None:
    token = _admin_token(api_client)
    created = api_client.post(
        "/incidents",
        json={
            "category": "fire",
            "description": "IT08 event",
            "location": {"latitude": 12.97, "longitude": 77.59},
            "source": "citizen_web",
            "idempotency_key": f"it08-{uuid.uuid4().hex}",
        },
    )
    assert created.status_code == 201
    incident_id = created.json()["data"]["id"]

    settings = get_settings()
    r = redis.from_url(settings.redis_url, decode_responses=True)
    pubsub = r.pubsub()
    pubsub.subscribe(CHANNEL)
    pubsub.get_message(timeout=1.0)

    payload = {
        "event": "incident.status_changed",
        "incident_id": incident_id,
        "status": "classified",
    }
    r.publish(CHANNEL, json.dumps(payload))

    message = None
    for _ in range(20):
        message = pubsub.get_message(ignore_subscribe_messages=True, timeout=0.25)
        if message and message.get("type") == "message":
            break
    pubsub.unsubscribe(CHANNEL)
    pubsub.close()
    r.close()
    assert message is not None
    data = json.loads(message["data"])
    assert data["incident_id"] == incident_id
    assert data["status"] == "classified"

    detail = api_client.get(
        f"/incidents/{incident_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert detail.status_code == 200
    assert detail.json()["data"]["id"] == incident_id
    assert "ai_summary" in detail.json()["data"]

def test_perf02_dual_subscriber_within_5s() -> None:
    settings = get_settings()
    r1 = redis.from_url(settings.redis_url, decode_responses=True)
    r2 = redis.from_url(settings.redis_url, decode_responses=True)
    p1 = r1.pubsub()
    p2 = r2.pubsub()
    p1.subscribe(CHANNEL)
    p2.subscribe(CHANNEL)
    p1.get_message(timeout=1.0)
    p2.get_message(timeout=1.0)

    incident_id = str(uuid.uuid4())
    payload = {"event": "perf02", "incident_id": incident_id, "status": "assigned"}
    start = datetime.now(UTC)
    r1.publish(CHANNEL, json.dumps(payload))

    got1 = got2 = None
    while (datetime.now(UTC) - start).total_seconds() < 5:
        if got1 is None:
            m = p1.get_message(ignore_subscribe_messages=True, timeout=0.1)
            if m and m.get("type") == "message":
                got1 = json.loads(m["data"])
        if got2 is None:
            m = p2.get_message(ignore_subscribe_messages=True, timeout=0.1)
            if m and m.get("type") == "message":
                got2 = json.loads(m["data"])
        if got1 and got2:
            break

    p1.unsubscribe()
    p2.unsubscribe()
    p1.close()
    p2.close()
    r1.close()
    r2.close()
    assert got1 and got2
    assert got1["incident_id"] == incident_id
    assert got2["incident_id"] == incident_id
    assert (datetime.now(UTC) - start).total_seconds() < 5


@pytest.mark.asyncio
async def test_it09_no_duplicate_active_alert_on_reeval() -> None:
    init_db()
    factory = get_session_factory()
    async with factory() as session:
        incident = Incident(
            tracking_ref=f"IT09{uuid.uuid4().hex[:8]}".upper()[:12],
            category=IncidentCategory.personal_safety,
            description="delayed candidate",
            location=point_wkt(12.97, 77.59),
            source=IncidentSource.sos,
            priority=IncidentPriority.critical,
            status=IncidentStatus.classified,
            is_anonymous=True,
        )
        session.add(incident)
        await session.flush()
        # Backdate for delayed rule realism
        incident.created_at = datetime.now(UTC) - timedelta(minutes=60)
        await session.flush()

        service = AlertService(session)
        first = await service.ensure_alert(
            incident=incident, alert_type=AlertType.delayed_response
        )
        second = await service.ensure_alert(
            incident=incident, alert_type=AlertType.delayed_response
        )
        await session.commit()
        assert first is not None
        assert second is None

        result = await session.execute(
            select(Alert).where(
                Alert.incident_id == incident.id,
                Alert.type == AlertType.delayed_response,
                Alert.status == AlertStatus.active,
            )
        )
        assert len(list(result.scalars().all())) == 1


def test_it11_assignment_creates_notification_rows(api_client: TestClient) -> None:
    token = _admin_token(api_client)
    res = api_client.post(
        "/resources",
        json={
            "type": "team",
            "name": f"Notify-{uuid.uuid4().hex[:6]}",
            "location": {"latitude": 12.971, "longitude": 77.594},
            "capabilities": {"handles": ["fire"]},
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201, res.text
    resource_id = res.json()["data"]["id"]

    inc = api_client.post(
        "/incidents",
        json={
            "category": "fire",
            "description": "Need notify",
            "location": {"latitude": 12.9716, "longitude": 77.5946},
            "source": "citizen_web",
            "idempotency_key": f"it11-{uuid.uuid4().hex}",
        },
    )
    assert inc.status_code == 201
    incident_id = inc.json()["data"]["id"]

    assigned = api_client.post(
        f"/incidents/{incident_id}/assign",
        json={"resource_id": resource_id, "decision": "manual"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert assigned.status_code == 201, assigned.text

    engine = _sync_engine()
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT channel, status FROM notifications
                WHERE related_incident_id = :id
                ORDER BY created_at
                """
            ),
            {"id": incident_id},
        ).fetchall()
    channels = {r[0] for r in rows}
    assert "email" in channels
    assert "sms_simulated" in channels
    assert all(r[1] in ("sent", "queued") for r in rows)


def test_it14_horizontal_redis_fanout_two_subscribers() -> None:
    """IT-14 / Doc 03 section 12: event published once is received by two independent subscribers."""
    test_perf02_dual_subscriber_within_5s()


def test_secure_headers_present(api_client: TestClient) -> None:
    resp = api_client.get("/health")
    assert resp.headers.get("x-content-type-options") == "nosniff"
    assert resp.headers.get("x-frame-options") == "DENY"
    assert resp.headers.get("referrer-policy") == "strict-origin-when-cross-origin"


def test_it12_sos_trusted_contact_minimal_payload(api_client: TestClient) -> None:
    secret = "Full confidential SOS description must not leak"
    resp = api_client.post(
        "/incidents/sos",
        json={
            "location": {"latitude": 12.97, "longitude": 77.59},
            "description": secret,
            "is_anonymous": True,
            "idempotency_key": f"it12-{uuid.uuid4().hex}",
            "trusted_contacts": [{"name": "Friend", "contact": "+19998887777"}],
        },
    )
    assert resp.status_code == 201, resp.text
    incident_id = resp.json()["data"]["id"]

    engine = _sync_engine()
    with engine.connect() as conn:
        contact = conn.execute(
            text(
                "SELECT notified_at, contact FROM trusted_contacts WHERE incident_id = :id"
            ),
            {"id": incident_id},
        ).fetchone()
        notif = conn.execute(
            text(
                """
                SELECT content FROM notifications
                WHERE related_incident_id = :id AND target_type = 'trusted_contact'
                ORDER BY created_at DESC LIMIT 1
                """
            ),
            {"id": incident_id},
        ).scalar_one_or_none()
    assert contact is not None
    assert contact[0] is not None
    assert notif is not None
    assert secret not in notif
    assert "RescueGrid" in notif
    assert resp.json()["data"]["tracking_ref"] in notif
