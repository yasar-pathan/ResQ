from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import Settings, get_settings
from app.core.exception_handlers import register_exception_handlers
from app.db.session import close_db, init_db
from app.middleware.cors import add_cors_middleware
from app.middleware.correlation import CorrelationIdMiddleware
from app.middleware.logging import configure_logging, RequestLoggingMiddleware
from app.middleware.rate_limit import setup_rate_limiting


def create_app(settings: Settings | None = None) -> FastAPI:
    configure_logging()
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        init_db()
        yield
        await close_db()

    app = FastAPI(title="RescueGrid API", version="0.1.0", lifespan=lifespan)
    register_exception_handlers(app)

    setup_rate_limiting(app)
    add_cors_middleware(app, settings)
    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(CorrelationIdMiddleware)

    register_routes(app, settings)
    return app


def register_routes(app: FastAPI, settings: Settings) -> None:
    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": "api"}

    if settings.environment == "development":
        from app.core.exceptions import InternalServerError

        @app.get("/_dev/trigger-error")
        async def trigger_error() -> None:
            raise InternalServerError("deliberate test failure")
