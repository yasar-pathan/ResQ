from io import BytesIO

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_media_upload_accepts_png() -> None:
    # Minimal valid 1x1 PNG
    png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
        b"\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    response = client.post(
        "/media/upload",
        files={"file": ("dot.png", BytesIO(png), "image/png")},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["success"] is True
    assert "/uploads/" in body["data"]["url"]


def test_media_upload_rejects_non_image() -> None:
    response = client.post(
        "/media/upload",
        files={"file": ("note.txt", BytesIO(b"hello"), "text/plain")},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_error"
