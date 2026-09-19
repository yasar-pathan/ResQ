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


def test_sec02_field_team_cannot_access_admin_only(api_client: TestClient) -> None:
    admin_access = _admin_token(api_client)
    field_email = f"field-{uuid.uuid4().hex[:8]}@example.com"
    password = "password-12345"
    created = api_client.post(
        "/auth/register",
        json={
            "name": "Field",
            "email": field_email,
            "password": password,
            "role": "field_team",
        },
        headers={"Authorization": f"Bearer {admin_access}"},
    )
    assert created.status_code == 201
    login = api_client.post("/auth/login", json={"email": field_email, "password": password})
    access = login.json()["data"]["access_token"]
    denied = api_client.get("/auth/admin-only", headers={"Authorization": f"Bearer {access}"})
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "authorization_error"


def test_all_roles_can_authenticate(api_client: TestClient) -> None:
    admin_access = _admin_token(api_client)
    password = "password-12345"
    for role in ("citizen", "dispatcher", "field_team", "admin"):
        email = f"{role}-{uuid.uuid4().hex[:8]}@example.com"
        if role == "citizen":
            reg = api_client.post(
                "/auth/register",
                json={"name": role, "email": email, "password": password, "role": role},
            )
        else:
            reg = api_client.post(
                "/auth/register",
                json={"name": role, "email": email, "password": password, "role": role},
                headers={"Authorization": f"Bearer {admin_access}"},
            )
        assert reg.status_code == 201
        login = api_client.post("/auth/login", json={"email": email, "password": password})
        assert login.status_code == 200
        assert login.json()["success"] is True
        assert "access_token" in login.json()["data"]


def test_login_writes_audit_log(api_client: TestClient) -> None:
    email = f"audit-{uuid.uuid4().hex[:8]}@example.com"
    password = "password-12345"
    api_client.post(
        "/auth/register",
        json={"name": "Audit User", "email": email, "password": password, "role": "citizen"},
    )
    login = api_client.post("/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200

    settings = get_settings()
    sync_url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
    engine = create_engine(sync_url)
    with engine.connect() as conn:
        count = conn.execute(
            text("SELECT COUNT(*) FROM audit_log WHERE action = 'auth.login'")
        ).scalar_one()
    assert count >= 1
