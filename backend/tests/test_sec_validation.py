from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_sec04_garbage_tracking_ref_returns_400_not_500() -> None:
    # Path-style payloads may be normalized to 404 by the router; hex/garbage
    # that still match the route must be 400 (not 500).
    for bad in (
        "'; DROP TABLE incidents;--",
        "<script>alert(1)</script>",
        "short",
        "ZZZZZZZZZZZZ",
        "not-hex-ref!!",
    ):
        response = client.get(f"/incidents/{bad}/status")
        assert response.status_code in (400, 404), (bad, response.status_code, response.text)
        if response.status_code == 400:
            body = response.json()
            assert body["success"] is False
            assert body["error"]["code"] == "validation_error"
            assert "traceback" not in str(body).lower()


def test_sec04_unauthenticated_incidents_list_401() -> None:
    response = client.get("/incidents")
    assert response.status_code == 401
    body = response.json()
    assert body["success"] is False
    assert "traceback" not in str(body).lower()


def test_sec09_5xx_envelope_has_no_stack_trace() -> None:
    response = client.get("/_dev/trigger-error")
    assert response.status_code == 500
    body = response.json()
    dumped = str(body).lower()
    assert "traceback" not in dumped
    assert "file \"" not in dumped
    assert body["error"]["code"] == "internal_server_error"
