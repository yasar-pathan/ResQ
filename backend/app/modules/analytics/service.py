"""Analytics service with Redis TTL cache."""

from __future__ import annotations

import json
from datetime import date

import redis.asyncio as aioredis
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.modules.analytics import queries

CACHE_TTL = 45


class AnalyticsService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def _cached(self, key: str, loader) -> dict | list:
        settings = get_settings()
        client = aioredis.from_url(settings.redis_url, decode_responses=True)
        try:
            cached = await client.get(key)
            if cached:
                return json.loads(cached)
            data = await loader()
            await client.set(key, json.dumps(data), ex=CACHE_TTL)
            return data
        finally:
            await client.aclose()

    def _key(self, name: str, date_from: date | None, date_to: date | None) -> str:
        return f"analytics:{name}:{date_from}:{date_to}"

    async def overview(self, date_from: date | None, date_to: date | None) -> dict:
        return await self._cached(
            self._key("overview", date_from, date_to),
            lambda: queries.overview_kpis(
                self.session, date_from=date_from, date_to=date_to
            ),
        )

    async def by_category(self, date_from: date | None, date_to: date | None) -> dict:
        items = await self._cached(
            self._key("by_category", date_from, date_to),
            lambda: queries.incidents_by_category(
                self.session, date_from=date_from, date_to=date_to
            ),
        )
        return {"items": items}

    async def delays(self, date_from: date | None, date_to: date | None) -> dict:
        return await self._cached(
            self._key("delays", date_from, date_to),
            lambda: queries.response_delays(
                self.session, date_from=date_from, date_to=date_to
            ),
        )

    async def hotspots(self, date_from: date | None, date_to: date | None) -> dict:
        items = await self._cached(
            self._key("hotspots", date_from, date_to),
            lambda: queries.hotspots(
                self.session, date_from=date_from, date_to=date_to
            ),
        )
        return {"items": items}
