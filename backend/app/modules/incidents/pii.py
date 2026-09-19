"""PII visibility resolver (SEC-011) — expanded in Phase 9."""

import uuid
from typing import Any

from app.models.incident import Incident
from app.models.enums import IncidentCategory
from app.models.user import User, UserRole


def resolve_pii_visibility(
    incident: Incident,
    viewer: User | None,
    *,
    is_assigned_field_team: bool = False,
) -> dict[str, Any]:
    """Return reporter-related fields with redaction for personal_safety incidents."""
    if incident.category != IncidentCategory.personal_safety:
        return {"restricted": False, "reporter_id": str(incident.reporter_id) if incident.reporter_id else None}

    if viewer is None:
        return {"restricted": True, "reporter_id": None}

    if viewer.role == UserRole.admin:
        return {"restricted": False, "reporter_id": str(incident.reporter_id) if incident.reporter_id else None}

    if viewer.role == UserRole.dispatcher:
        return {
            "restricted": False,
            "reporter_id": str(incident.reporter_id) if incident.reporter_id else None,
        }

    if viewer.role == UserRole.field_team and is_assigned_field_team:
        return {"restricted": False, "reporter_id": str(incident.reporter_id) if incident.reporter_id else None}

    return {"restricted": True, "reporter_id": None}
