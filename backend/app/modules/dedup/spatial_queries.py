import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import IncidentCategory, IncidentStatus

_OPEN_STATUSES = (
    IncidentStatus.classified.value,
    IncidentStatus.possible_duplicate.value,
    IncidentStatus.assigned.value,
    IncidentStatus.in_progress.value,
)


async def find_nearby_candidates(
    session: AsyncSession,
    *,
    incident_id: uuid.UUID,
    category: IncidentCategory,
    radius_meters: float,
    window_minutes: int,
) -> list[dict]:
    since = datetime.now(UTC) - timedelta(minutes=window_minutes)
    stmt = text(
        """
        SELECT
            i.id,
            i.description,
            i.created_at,
            i.category::text AS category,
            ST_Distance(
                i.location,
                (SELECT location FROM incidents WHERE id = :incident_id)
            ) AS distance_m
        FROM incidents i
        WHERE i.id != :incident_id
          AND i.category = :category
          AND i.status = ANY(:statuses)
          AND i.merged_into_id IS NULL
          AND i.created_at >= :since
          AND ST_DWithin(
                i.location,
                (SELECT location FROM incidents WHERE id = :incident_id),
                :radius_m
          )
        ORDER BY i.created_at ASC
        """
    )
    result = await session.execute(
        stmt,
        {
            "incident_id": incident_id,
            "category": category.value,
            "statuses": list(_OPEN_STATUSES),
            "since": since,
            "radius_m": radius_meters,
        },
    )
    rows = result.mappings().all()
    return [dict(row) for row in rows]
