from sqlalchemy import create_engine, text

from app.config import get_settings


def test_core_tables_exist() -> None:
    settings = get_settings()
    sync_url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
    engine = create_engine(sync_url)
    expected = {
        "incidents",
        "incident_media",
        "resources",
        "assignments",
        "alerts",
        "notifications",
        "trusted_contacts",
        "classification_queue",
        "incident_idempotency_keys",
    }
    with engine.connect() as conn:
        for table in expected:
            exists = conn.execute(
                text("SELECT to_regclass(:name)"),
                {"name": f"public.{table}"},
            ).scalar_one()
            assert exists is not None, f"missing table {table}"
