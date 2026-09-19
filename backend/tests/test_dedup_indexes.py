from sqlalchemy import create_engine, text

from app.config import get_settings


def test_perf04_incidents_location_has_gist_index() -> None:
    settings = get_settings()
    sync_url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
    engine = create_engine(sync_url)
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT indexname FROM pg_indexes
                WHERE tablename = 'incidents' AND indexdef ILIKE '%gist%'
                """
            )
        ).fetchall()
    assert len(rows) >= 1
