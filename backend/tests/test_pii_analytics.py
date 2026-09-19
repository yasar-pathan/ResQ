"""Phase 9 PII + analytics security/integration tests."""

from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from app.config import get_settings
from app.core.security import hash_password
from app.factory import create_app

BOOTSTRAP_EMAIL = os.environ.get("BOOTSTRAP_ADMIN_EMAIL", "admin@rescuegrid.dev")
BOOTSTRAP_PASSWORD = os.environ.get("BOOTSTRAP_ADMIN_PASSWORD", "ChangeMeAdmin123!")


@pytest.fixture
def api_client() -> TestClient:
    with TestClient(create_app()) as client:
        yield client


def _token(client: TestClient, email: str, password: str) -> str:
    login = client.post("/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    return login.json()["data"]["access_token"]


def _admin_token(client: TestClient) -> str:
    return _token(client, BOOTSTRAP_EMAIL, BOOTSTRAP_PASSWORD)


def _ensure_dispatcher(email: str) -> None:
    settings = get_settings()
    engine = create_engine(settings.database_url.replace("postgresql+asyncpg://", "postgresql://"))
    with engine.begin() as conn:
        existing = conn.execute(
            text("SELECT id FROM users WHERE email = :e"), {"e": email}
        ).scalar_one_or_none()
        if existing:
            return
        conn.execute(
            text(
                """
                INSERT INTO users (id, name, email, password_hash, role, is_active, created_at, updated_at)
                VALUES (:id, 'Disp', :email, :hash, 'dispatcher', true, now(), now())
                """
            ),
            {
                "id": uuid.uuid4(),
                "email": email,
                "hash": hash_password("ChangeMeOps123!"),
            },
        )


def test_it10_analytics_aggregates_no_identity(api_client: TestClient) -> None:
    token = _admin_token(api_client)
    for path in (
        "/analytics/overview",
        "/analytics/incidents-by-category",
        "/analytics/response-delays",
        "/analytics/hotspots",
    ):
        resp = api_client.get(path, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200, resp.text
        blob = resp.text.lower()
        assert "reporter_id" not in blob
        assert "password" not in blob


def test_sec05_unassigned_dispatcher_pii_restricted(api_client: TestClient) -> None:
    email = f"disp-sec05-{uuid.uuid4().hex[:8]}@example.com"
    _ensure_dispatcher(email)
    disp_token = _token(api_client, email, "ChangeMeOps123!")
    admin = _admin_token(api_client)

    sos = api_client.post(
        "/incidents/sos",
        json={
            "location": {"latitude": 12.97, "longitude": 77.59},
            "description": "SEC05 secret",
            "is_anonymous": False,
            "idempotency_key": f"sec05-{uuid.uuid4().hex}",
        },
        headers={"Authorization": f"Bearer {admin}"},
    )
    assert sos.status_code == 201
    incident_id = sos.json()["data"]["id"]

    detail = api_client.get(
        f"/incidents/{incident_id}",
        headers={"Authorization": f"Bearer {disp_token}"},
    )
    assert detail.status_code == 200
    pii = detail.json()["data"]["pii"]
    assert pii["restricted"] is True
    assert pii["reporter_id"] is None

    hotspots = api_client.get(
        "/analytics/hotspots",
        headers={"Authorization": f"Bearer {disp_token}"},
    )
    assert hotspots.status_code == 200
    assert "reporter_id" not in hotspots.text


def test_sec06_pii_audit_rows(api_client: TestClient) -> None:
    email = f"disp-sec06-{uuid.uuid4().hex[:8]}@example.com"
    _ensure_dispatcher(email)
    disp_token = _token(api_client, email, "ChangeMeOps123!")
    admin = _admin_token(api_client)

    sos = api_client.post(
        "/incidents/sos",
        json={
            "location": {"latitude": 12.971, "longitude": 77.591},
            "description": "SEC06",
            "idempotency_key": f"sec06-{uuid.uuid4().hex}",
        },
        headers={"Authorization": f"Bearer {admin}"},
    )
    incident_id = sos.json()["data"]["id"]
    api_client.get(
        f"/incidents/{incident_id}",
        headers={"Authorization": f"Bearer {disp_token}"},
    )
    api_client.get(
        f"/incidents/{incident_id}",
        headers={"Authorization": f"Bearer {admin}"},
    )

    settings = get_settings()
    engine = create_engine(settings.database_url.replace("postgresql+asyncpg://", "postgresql://"))
    with engine.connect() as conn:
        denied = conn.execute(
            text(
                "SELECT COUNT(*) FROM audit_log WHERE entity_id = :id AND action = 'pii.denied'"
            ),
            {"id": incident_id},
        ).scalar_one()
        granted = conn.execute(
            text(
                "SELECT COUNT(*) FROM audit_log WHERE entity_id = :id AND action = 'pii.read'"
            ),
            {"id": incident_id},
        ).scalar_one()
    assert denied >= 1
    assert granted >= 1


def test_sec07_tracking_ref_status_is_public_minimal(api_client: TestClient) -> None:
    created = api_client.post(
        "/incidents",
        json={
            "category": "fire",
            "description": "public status",
            "location": {"latitude": 12.97, "longitude": 77.59},
            "source": "citizen_web",
            "idempotency_key": f"sec07-{uuid.uuid4().hex}",
        },
    )
    ref = created.json()["data"]["tracking_ref"]
    status = api_client.get(f"/incidents/{ref}/status")
    assert status.status_code == 200
    data = status.json()["data"]
    assert set(data.keys()) == {"tracking_ref", "status", "updated_at"}


def test_it13_assigned_dispatcher_sees_identity(api_client: TestClient) -> None:
    admin = _admin_token(api_client)
    email = f"disp-it13-{uuid.uuid4().hex[:8]}@example.com"
    _ensure_dispatcher(email)
    disp_token = _token(api_client, email, "ChangeMeOps123!")

    # Create dispatcher user id for assignment via admin register already done
    settings = get_settings()
    engine = create_engine(settings.database_url.replace("postgresql+asyncpg://", "postgresql://"))
    with engine.connect() as conn:
        disp_id = conn.execute(
            text("SELECT id FROM users WHERE email = :e"), {"e": email}
        ).scalar_one()

    res = api_client.post(
        "/resources",
        json={
            "type": "team",
            "name": f"IT13-{uuid.uuid4().hex[:6]}",
            "location": {"latitude": 12.97, "longitude": 77.59},
            "operator_user_id": str(disp_id),
            "capabilities": {"handles": ["personal_safety"]},
        },
        headers={"Authorization": f"Bearer {admin}"},
    )
    assert res.status_code == 201, res.text
    resource_id = res.json()["data"]["id"]

    sos = api_client.post(
        "/incidents/sos",
        json={
            "location": {"latitude": 12.9705, "longitude": 77.5905},
            "description": "IT13",
            "is_anonymous": False,
            "idempotency_key": f"it13-{uuid.uuid4().hex}",
        },
        headers={"Authorization": f"Bearer {admin}"},
    )
    incident_id = sos.json()["data"]["id"]

    assigned = api_client.post(
        f"/incidents/{incident_id}/assign",
        json={"resource_id": resource_id, "decision": "manual"},
        headers={"Authorization": f"Bearer {admin}"},
    )
    # Assign as admin, then also assign-by link: update assigned_by to dispatcher for PII rule
    # PII checks assignee OR assigned_by — set assigned_by via SQL to dispatcher
    with engine.begin() as conn:
        conn.execute(
            text(
                "UPDATE assignments SET assigned_by_user_id = :d WHERE incident_id = :i"
            ),
            {"d": disp_id, "i": incident_id},
        )

    assert assigned.status_code == 201, assigned.text
    detail = api_client.get(
        f"/incidents/{incident_id}",
        headers={"Authorization": f"Bearer {disp_token}"},
    )
    assert detail.status_code == 200
    assert detail.json()["data"]["pii"]["restricted"] is False
