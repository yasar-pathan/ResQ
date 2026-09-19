import uuid

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_sec01_unauthenticated_me_returns_401_envelope() -> None:
    response = client.get("/auth/me")
    assert response.status_code == 401
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "authentication_error"


def test_sec03_tampered_jwt_rejected() -> None:
    from app.core.security import create_access_token
    from app.models.user import UserRole

    token = create_access_token(uuid.uuid4(), UserRole.citizen)
    parts = token.split(".")
    tampered = f"{parts[0]}.{parts[1]}.invalidsignature"
    response = client.get("/auth/me", headers={"Authorization": f"Bearer {tampered}"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_error"


def test_non_citizen_register_without_admin_is_forbidden() -> None:
    response = client.post(
        "/auth/register",
        json={
            "name": "Bad Admin",
            "email": f"bad-admin-{uuid.uuid4().hex[:8]}@example.com",
            "password": "password-12345",
            "role": "admin",
        },
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "authorization_error"
