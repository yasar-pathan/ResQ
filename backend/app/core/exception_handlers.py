import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.exceptions import AppError
from app.core.responses import error_response

logger = logging.getLogger(__name__)


def _correlation_id(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        body = error_response(
            code=exc.code,
            details=exc.details,
            message=str(exc) if exc.message else None,
            correlation_id=_correlation_id(request),
        )
        return JSONResponse(status_code=exc.status_code, content=body)

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        body = error_response(
            code="validation_error",
            details={"errors": exc.errors()},
            correlation_id=_correlation_id(request),
        )
        return JSONResponse(status_code=400, content=body)

    @app.exception_handler(ExceptionGroup)
    async def exception_group_handler(
        request: Request, exc: ExceptionGroup
    ) -> JSONResponse:
        inner = exc.exceptions[0] if exc.exceptions else exc
        if isinstance(inner, AppError):
            return await app_error_handler(request, inner)
        return await unhandled_error_handler(request, inner)  # type: ignore[arg-type]

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error", extra={"path": str(request.url.path)})
        body = error_response(
            code="internal_server_error",
            message="Internal server error",
            correlation_id=_correlation_id(request),
        )
        return JSONResponse(status_code=500, content=body)
