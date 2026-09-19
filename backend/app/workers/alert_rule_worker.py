"""Evaluates alert rules (Phase 8+). Phase 0: idle heartbeat loop."""

import asyncio
import logging

logger = logging.getLogger(__name__)


async def run() -> None:
    logger.info("alert_rule_worker started (idle until Phase 8)")
    while True:
        await asyncio.sleep(60)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    asyncio.run(run())


if __name__ == "__main__":
    main()
