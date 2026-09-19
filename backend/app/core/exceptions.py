from typing import Any


class AppError(Exception):
    code: str = "internal_server_error"
    status_code: int = 500

    def __init__(
        self,
        message: str | None = None,
        *,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message or self.code)
        self.message = message
        self.details = details or {}


class ValidationAppError(AppError):
    code = "validation_error"
    status_code = 400


class AuthenticationError(AppError):
    code = "authentication_error"
    status_code = 401


class AuthorizationError(AppError):
    code = "authorization_error"
    status_code = 403


class NotFoundError(AppError):
    code = "not_found"
    status_code = 404


class ConflictError(AppError):
    code = "conflict"
    status_code = 409


class RateLimitError(AppError):
    code = "rate_limit"
    status_code = 429


class ExternalServiceError(AppError):
    code = "external_service_error"
    status_code = 502


class InternalServerError(AppError):
    code = "internal_server_error"
    status_code = 500
