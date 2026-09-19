import json
import logging
from typing import Any

import redis.asyncio as aioredis

from app.config import get_settings

logger = logging.getLogger(__name__)

CHANNEL = "rescuegrid:incidents"


async def publish_incident_update(payload: dict[str, Any]) -> None:
    settings = get_settings()
    try:
        client = aioredis.from_url(settings.redis_url, decode_responses=True)
        try:
            await client.publish(CHANNEL, json.dumps(payload))
        finally:
            await client.aclose()
    except Exception:
        logger.warning("Failed to publish incident update to Redis", exc_info=True)
