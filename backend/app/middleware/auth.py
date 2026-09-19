import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.core.security import decode_access_token
from app.db.session import get_session_factory
from app.modules.auth.service import get_user_by_id


class AuthContextMiddleware(BaseHTTPMiddleware):
    """Attach user to request.state when a valid Bearer token is present."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
            try:
                payload = decode_access_token(token)
                user_id = uuid.UUID(payload["sub"])
                factory = get_session_factory()
                async with factory() as session:
                    user = await get_user_by_id(session, user_id)
                    if user is not None and user.is_active:
                        request.state.user = user
            except (ValueError, KeyError):
                pass
        return await call_next(request)
