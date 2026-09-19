"""Minimal HTTP health endpoint for the background worker process."""

import asyncio
from typing import Any

from app.config import get_settings


async def handle_health(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
    try:
        await reader.readuntil(b"\r\n\r\n")
        body = b'{"status":"ok","service":"worker"}'
        response = (
            b"HTTP/1.1 200 OK\r\n"
            b"Content-Type: application/json\r\n"
            b"Content-Length: " + str(len(body)).encode() + b"\r\n"
            b"Connection: close\r\n"
            b"\r\n" + body
        )
        writer.write(response)
        await writer.drain()
    finally:
        writer.close()
        await writer.wait_closed()


async def run_health_server(port: int) -> None:
    server = await asyncio.start_server(handle_health, host="0.0.0.0", port=port)
    async with server:
        await server.serve_forever()


def start_health_server(port: int | None = None) -> Any:
    settings = get_settings()
    listen_port = port if port is not None else settings.worker_health_port
    return asyncio.create_task(run_health_server(listen_port))
