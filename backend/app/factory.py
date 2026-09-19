from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import Settings, get_settings
from app.core.exception_handlers import register_exception_handlers
from app.db.session import close_db, init_db
from app.middleware.cors import add_cors_middleware
from app.middleware.correlation import CorrelationIdMiddleware
from app.middleware.logging import configure_logging, RequestLoggingMiddleware
from app.middleware.auth import AuthContextMiddleware
from app.middleware.rate_limit import setup_rate_limiting
from app.middleware.secure_headers import SecureHeadersMiddleware


def create_app(settings: Settings | None = None) -> FastAPI:
    configure_logging()
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        init_db()
        if (
            settings.environment == "development"
            and settings.bootstrap_admin_email
            and settings.bootstrap_admin_password
        ):
            from app.db.session import get_session_factory
            from app.modules.auth.service import bootstrap_admin_if_needed

            factory = get_session_factory()
            async with factory() as session:
                await bootstrap_admin_if_needed(
                    session,
                    settings.bootstrap_admin_email,
                    settings.bootstrap_admin_password,
                )
        yield
        await close_db()

    app = FastAPI(title="RescueGrid API", version="0.1.0", lifespan=lifespan)
    register_exception_handlers(app)

    # Outermost last: correlation → logging → CORS → rate limit → secure headers
    setup_rate_limiting(app)
    add_cors_middleware(app, settings)
    app.add_middleware(AuthContextMiddleware)
    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(CorrelationIdMiddleware)
    app.add_middleware(SecureHeadersMiddleware)

    register_routes(app, settings)
    return app


def register_routes(app: FastAPI, settings: Settings) -> None:
    from app.modules.alerts.router import router as alerts_router
    from app.modules.analytics.router import router as analytics_router
    from app.modules.assignments.router import assign_router, router as assignments_router
    from app.modules.auth.router import router as auth_router
    from app.modules.incidents.router import router as incidents_router
    from app.modules.notifications.router import router as notifications_router
    from app.modules.resources.router import router as resources_router
    from app.workers.gateway import router as ws_router

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": "api"}

    if settings.environment == "development":
        from app.core.exceptions import InternalServerError

        @app.get("/_dev/trigger-error")
        async def trigger_error() -> None:
            raise InternalServerError("deliberate test failure")

    app.include_router(auth_router)
    app.include_router(incidents_router)
    app.include_router(resources_router)
    app.include_router(assignments_router)
    app.include_router(assign_router)
    app.include_router(alerts_router)
    app.include_router(notifications_router)
    app.include_router(analytics_router)
    app.include_router(ws_router)
