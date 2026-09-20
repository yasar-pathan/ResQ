from typing import Any

from app.schemas.envelope import ApiResponse, ErrorBody


def success_response(
    data: Any = None,
    message: str | None = None,
) -> dict[str, Any]:
    return ApiResponse(success=True, data=data, message=message, error=None).model_dump(mode="json")


def error_response(
    code: str,
    details: dict[str, Any] | None = None,
    message: str | None = None,
    correlation_id: str | None = None,
) -> dict[str, Any]:
    return ApiResponse(
        success=False,
        data=None,
        message=message,
        error=ErrorBody(
            code=code,
            message=message,
            details=details or {},
            correlation_id=correlation_id,
        ),
    ).model_dump(mode="json")
