from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_deliberate_error_returns_envelope_not_trace() -> None:
    response = client.get("/_dev/trigger-error")
    assert response.status_code == 500
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "internal_server_error"
    assert "traceback" not in str(body).lower()
    assert body["error"].get("correlation_id") is not None
    assert response.headers.get("X-Correlation-ID")
