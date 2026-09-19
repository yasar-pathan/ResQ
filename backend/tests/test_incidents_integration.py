import os
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from app.config import get_settings
from app.factory import create_app

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


def _incident_payload(**overrides: object) -> dict:
    base = {
        "category": "fire",
        "description": "Smoke test incident",
        "location": {"latitude": 12.9716, "longitude": 77.5946},
        "source": "citizen_web",
        "idempotency_key": f"idem-{uuid.uuid4().hex}",
    }
    base.update(overrides)
    return base


def test_it01_post_incident_creates_classification_queue_row(api_client: TestClient) -> None:
    key = f"it01-{uuid.uuid4().hex}"
    resp = api_client.post("/incidents", json=_incident_payload(idempotency_key=key))
    assert resp.status_code == 201, resp.text
    data = resp.json()["data"]
    incident_id = data["id"]

    settings = get_settings()
    sync_url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
    engine = create_engine(sync_url)
    with engine.connect() as conn:
        row = conn.execute(
            text(
                "SELECT status FROM classification_queue WHERE incident_id = :id ORDER BY created_at DESC LIMIT 1"
            ),
            {"id": incident_id},
        ).scalar_one_or_none()
    assert row == "pending"


def test_it01_idempotency_returns_same_incident(api_client: TestClient) -> None:
    key = f"idem-repeat-{uuid.uuid4().hex}"
    first = api_client.post("/incidents", json=_incident_payload(idempotency_key=key))
    second = api_client.post("/incidents", json=_incident_payload(idempotency_key=key))
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["data"]["id"] == second.json()["data"]["id"]
    assert "idempotent" in second.json()["message"].lower()


def test_it07_deactivated_resource_excluded_from_active_list(api_client: TestClient) -> None:
    token = _admin_token(api_client)
    name = f"Inactive-{uuid.uuid4().hex[:8]}"
    created = api_client.post(
        "/resources",
        json={
            "type": "team",
            "name": name,
            "location": {"latitude": 12.97, "longitude": 77.59},
            "capabilities": {},
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert created.status_code == 201, created.text
    resource_id = created.json()["data"]["id"]
    patched = api_client.patch(
        f"/resources/{resource_id}",
        json={"is_active": False},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert patched.status_code == 200

    listed = api_client.get(
        "/resources?active_only=true",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert listed.status_code == 200
    ids = [item["id"] for item in listed.json()["data"]["items"]]
    assert resource_id not in ids


def test_sec04_sql_injection_in_description_rejected(api_client: TestClient) -> None:
    payload = _incident_payload(
        description="'; DROP TABLE incidents; --",
        idempotency_key=f"sec04-{uuid.uuid4().hex}",
    )
    resp = api_client.post("/incidents", json=payload)
    assert resp.status_code in (201, 400, 422)
    if resp.status_code == 201:
        assert "DROP TABLE" in resp.json()["data"]["description"]
    body = resp.text.lower()
    assert "syntax error" not in body
    assert "postgresql" not in body or resp.status_code != 500


def test_sec08_no_secrets_in_incident_response(api_client: TestClient) -> None:
    resp = api_client.post(
        "/incidents",
        json=_incident_payload(idempotency_key=f"sec08-{uuid.uuid4().hex}"),
    )
    assert resp.status_code == 201
    text = resp.text.lower()
    assert "jwt_secret" not in text
    assert "password_hash" not in text
