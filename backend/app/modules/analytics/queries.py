"""Analytics aggregate SQL (API-021–024). Never returns personal_safety identity."""

from __future__ import annotations

from datetime import date

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def overview_kpis(
    session: AsyncSession, *, date_from: date | None, date_to: date | None
) -> dict:
    where, params = _date_clause(date_from, date_to, alias="i")
    row = (
        await session.execute(
            text(
                f"""
                SELECT
                  COUNT(*)::int AS total_incidents,
                  COUNT(*) FILTER (WHERE i.status IN ('assigned','in_progress'))::int AS active,
                  COUNT(*) FILTER (WHERE i.status IN ('resolved','closed'))::int AS resolved,
                  COUNT(*) FILTER (WHERE i.priority = 'critical')::int AS critical,
                  COUNT(*) FILTER (WHERE i.category = 'personal_safety')::int AS personal_safety_count
                FROM incidents i
                WHERE 1=1 {where}
                """
            ),
            params,
        )
    ).mappings().one()
    return dict(row)


async def incidents_by_category(
    session: AsyncSession, *, date_from: date | None, date_to: date | None
) -> list[dict]:
    where, params = _date_clause(date_from, date_to, alias="i")
    rows = (
        await session.execute(
            text(
                f"""
                SELECT i.category::text AS category, COUNT(*)::int AS count
                FROM incidents i
                WHERE 1=1 {where}
                GROUP BY i.category
                ORDER BY count DESC
                """
            ),
            params,
        )
    ).mappings().all()
    return [dict(r) for r in rows]


async def response_delays(
    session: AsyncSession, *, date_from: date | None, date_to: date | None
) -> dict:
    where, params = _date_clause(date_from, date_to, alias="i")
    row = (
        await session.execute(
            text(
                f"""
                SELECT
                  COUNT(*) FILTER (WHERE a.assigned_at IS NOT NULL)::int AS assigned_count,
                  COALESCE(
                    AVG(EXTRACT(EPOCH FROM (a.assigned_at - i.created_at)) / 60.0)
                    FILTER (WHERE a.assigned_at IS NOT NULL),
                    0
                  )::float AS avg_minutes_to_assign
                FROM incidents i
                LEFT JOIN LATERAL (
                  SELECT assigned_at FROM assignments
                  WHERE incident_id = i.id
                  ORDER BY created_at ASC LIMIT 1
                ) a ON true
                WHERE 1=1 {where}
                """
            ),
            params,
        )
    ).mappings().one()
    return {
        "assigned_count": row["assigned_count"],
        "avg_minutes_to_assign": round(float(row["avg_minutes_to_assign"] or 0), 2),
    }


async def hotspots(
    session: AsyncSession, *, date_from: date | None, date_to: date | None
) -> list[dict]:
    """Anonymized grid cells — no incident ids or reporter fields (SEC-012)."""
    where, params = _date_clause(date_from, date_to, alias="i")
    rows = (
        await session.execute(
            text(
                f"""
                SELECT
                  ROUND(ST_Y(i.location::geometry)::numeric, 2) AS lat_bucket,
                  ROUND(ST_X(i.location::geometry)::numeric, 2) AS lng_bucket,
                  COUNT(*)::int AS count
                FROM incidents i
                WHERE 1=1 {where}
                GROUP BY 1, 2
                ORDER BY count DESC
                LIMIT 50
                """
            ),
            params,
        )
    ).mappings().all()
    return [
        {
            "lat": float(r["lat_bucket"]),
            "lng": float(r["lng_bucket"]),
            "count": r["count"],
        }
        for r in rows
    ]


def _date_clause(
    date_from: date | None, date_to: date | None, *, alias: str
) -> tuple[str, dict]:
    clauses: list[str] = []
    params: dict = {}
    if date_from:
        clauses.append(f"AND {alias}.created_at::date >= :date_from")
        params["date_from"] = date_from
    if date_to:
        clauses.append(f"AND {alias}.created_at::date <= :date_to")
        params["date_to"] = date_to
    return " ".join(clauses), params
