from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_validation_error_envelope_shape() -> None:
    response = client.post("/auth/register", json={"email": "not-an-email"})
    assert response.status_code == 400
    body = response.json()
    assert body["success"] is False
    assert body["data"] is None
    assert body["error"]["code"] == "validation_error"
    assert "errors" in body["error"]["details"]


def test_app_error_envelope_shape() -> None:
    response = client.post(
        "/auth/login",
        json={"email": "nobody@example.com", "password": "wrong-password-123"},
    )
    assert response.status_code == 401
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "authentication_error"
