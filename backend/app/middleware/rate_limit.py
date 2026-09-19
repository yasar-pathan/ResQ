"""Rate limiting — public intake tight; authenticated ops higher ceiling."""

from fastapi import FastAPI
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

# Global default; API-005/006 override to 60/minute on the route.
limiter = Limiter(key_func=get_remote_address, default_limits=["300/minute"])


def setup_rate_limiting(app: FastAPI) -> Limiter:
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)
    return limiter
