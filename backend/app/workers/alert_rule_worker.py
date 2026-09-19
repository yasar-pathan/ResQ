"""Scheduled alert-rule evaluation (Phase 8)."""

import asyncio
import logging

from app.config import get_settings
from app.db.session import close_db, get_session_factory, init_db
from app.modules.alerts.service import AlertService

logger = logging.getLogger(__name__)


async def run_once() -> dict[str, int]:
    settings = get_settings()
    factory = get_session_factory()
    async with factory() as session:
        service = AlertService(session)
        return await service.evaluate_all(
            delayed_threshold_minutes=settings.delayed_response_threshold_minutes
        )


async def run() -> None:
    init_db()
    settings = get_settings()
    logger.info(
        "alert_rule_worker started (threshold=%sm)",
        settings.delayed_response_threshold_minutes,
    )
    try:
        while True:
            try:
                created = await run_once()
                if any(created.values()):
                    logger.info("alert_rule_worker created %s", created)
            except Exception:
                logger.exception("alert_rule_worker evaluation failed")
            await asyncio.sleep(30)
    finally:
        await close_db()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    asyncio.run(run())


if __name__ == "__main__":
    main()
