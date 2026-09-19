"""Local image upload for citizen report photos (Compose disk storage)."""

from __future__ import annotations

import re
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Request, UploadFile
from fastapi.responses import JSONResponse
from starlette import status

from app.core.exceptions import ValidationAppError
from app.core.responses import success_response

router = APIRouter(prefix="/media", tags=["media"])

ALLOWED_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MAX_BYTES = 2 * 1024 * 1024


def uploads_dir() -> Path:
    # backend/app/modules/media/router.py → parents[3] == backend/
    path = Path(__file__).resolve().parents[3] / "uploads"
    path.mkdir(parents=True, exist_ok=True)
    return path


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_media(request: Request, file: UploadFile = File(...)) -> JSONResponse:
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_TYPES:
        raise ValidationAppError(
            "Unsupported file type",
            details={"allowed": list(ALLOWED_TYPES.keys())},
        )

    data = await file.read()
    if len(data) == 0:
        raise ValidationAppError("Empty file")
    if len(data) > MAX_BYTES:
        raise ValidationAppError("File too large (max 2MB)")

    # Light magic-byte check
    if content_type == "image/jpeg" and not data.startswith(b"\xff\xd8"):
        raise ValidationAppError("Invalid JPEG content")
    if content_type == "image/png" and not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValidationAppError("Invalid PNG content")
    if content_type == "image/webp" and b"WEBP" not in data[:16]:
        raise ValidationAppError("Invalid WebP content")

    ext = ALLOWED_TYPES[content_type]
    name = f"{uuid.uuid4().hex}{ext}"
    dest = uploads_dir() / name
    dest.write_bytes(data)

    # Prefer public API origin from request so browsers can load the image
    base = str(request.base_url).rstrip("/")
    url = f"{base}/uploads/{name}"
    if not re.match(r"^https?://", url):
        url = f"/uploads/{name}"

    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content=success_response({"url": url, "content_type": content_type, "size": len(data)}),
    )
