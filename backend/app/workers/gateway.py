"""WebSocket gateway for live ops dashboard (API-026)."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Annotated

import redis.asyncio as aioredis
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.config import get_settings
from app.core.events import CHANNEL
from app.core.security import decode_access_token
from app.db.session import get_session_factory
from app.models.user import UserRole
from app.modules.auth.service import get_user_by_id

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


async def _authenticate_ws(token: str | None) -> tuple[bool, str]:
    if not token:
        return False, "missing token"
    try:
        payload = decode_access_token(token)
        role = payload.get("role")
        if role not in (UserRole.dispatcher.value, UserRole.admin.value):
            return False, "role not allowed"
        user_id = payload["sub"]
    except (ValueError, KeyError):
        return False, "invalid token"

    factory = get_session_factory()
    async with factory() as session:
        from uuid import UUID

        user = await get_user_by_id(session, UUID(user_id))
        if user is None or not user.is_active:
            return False, "user inactive"
    return True, "ok"


@router.websocket("/ws/dashboard")
async def dashboard_ws(
    websocket: WebSocket,
    token: Annotated[str | None, Query()] = None,
) -> None:
    ok, reason = await _authenticate_ws(token)
    if not ok:
        await websocket.close(code=4401, reason=reason)
        return

    await websocket.accept()
    settings = get_settings()
    client = aioredis.from_url(settings.redis_url, decode_responses=True)
    pubsub = client.pubsub()
    await pubsub.subscribe(CHANNEL)

    try:
        await websocket.send_json({"event": "connected", "channel": CHANNEL})

        async def pump_redis() -> None:
            while True:
                message = await pubsub.get_message(
                    ignore_subscribe_messages=True, timeout=1.0
                )
                if message and message.get("type") == "message":
                    data = message.get("data")
                    try:
                        payload = json.loads(data) if isinstance(data, str) else data
                    except json.JSONDecodeError:
                        payload = {"raw": data}
                    await websocket.send_json(payload)
                else:
                    await asyncio.sleep(0.05)

        async def pump_client() -> None:
            while True:
                raw = await websocket.receive_text()
                if raw.strip().lower() in {"ping", '{"type":"ping"}'}:
                    await websocket.send_json({"event": "pong"})

        redis_task = asyncio.create_task(pump_redis())
        client_task = asyncio.create_task(pump_client())
        done, pending = await asyncio.wait(
            {redis_task, client_task}, return_when=asyncio.FIRST_COMPLETED
        )
        for task in pending:
            task.cancel()
        for task in done:
            exc = task.exception()
            if exc and not isinstance(exc, WebSocketDisconnect):
                logger.debug("WS task ended: %s", exc)
    except WebSocketDisconnect:
        logger.debug("dashboard WS disconnected")
    finally:
        await pubsub.unsubscribe(CHANNEL)
        await pubsub.aclose()
        await client.aclose()
