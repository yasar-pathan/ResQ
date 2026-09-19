import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app.factory import create_app

BOOTSTRAP_EMAIL = os.environ.get("BOOTSTRAP_ADMIN_EMAIL", "admin@rescuegrid.dev")
BOOTSTRAP_PASSWORD = os.environ.get("BOOTSTRAP_ADMIN_PASSWORD", "ChangeMeAdmin123!")


@pytest.fixture
def api_client() -> TestClient:
    with TestClient(create_app()) as client:
        yield client


def test_ut14_sos_forces_critical_and_anonymous(api_client: TestClient) -> None:
    key = f"sos-{uuid.uuid4().hex}"
    resp = api_client.post(
        "/incidents/sos",
        json={
            "location": {"latitude": 12.9716, "longitude": 77.5946},
            "idempotency_key": key,
            "is_anonymous": True,
            "trusted_contacts": [{"name": "Friend", "contact": "+15551234567"}],
        },
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()["data"]
    assert data["source"] == "sos"
    assert data["category"] == "personal_safety"
    assert data["priority"] == "critical"
    assert data["is_anonymous"] is True
    assert data["status"] == "reported"
    assert data["tracking_ref"]
