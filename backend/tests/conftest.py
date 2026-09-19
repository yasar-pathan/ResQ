import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("JWT_SECRET", "test-secret-for-pytest-only")
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("BOOTSTRAP_ADMIN_EMAIL", "admin@rescuegrid.dev")
os.environ.setdefault("BOOTSTRAP_ADMIN_PASSWORD", "ChangeMeAdmin123!")

from app.config import get_settings

get_settings.cache_clear()
