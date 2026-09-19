import inspect

from app.factory import create_app
from app.models.enums import IncidentCategory, IncidentPriority, IncidentSource, IncidentStatus
from app.models.incident import Incident
from app.modules.incidents.router import create_incident, create_sos
from app.modules.incidents.service import serialize_incident
from slowapi.middleware import SlowAPIMiddleware


def test_sec09_slowapi_middleware_active() -> None:
    app = create_app()
    assert hasattr(app.state, "limiter")
    assert any(m.cls is SlowAPIMiddleware for m in app.user_middleware)


def test_sec09_intake_handlers_wired_for_limiter() -> None:
    for fn in (create_incident, create_sos):
        assert "request" in inspect.signature(fn).parameters
