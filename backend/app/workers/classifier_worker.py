"""Polls classification_queue (Phase 5+). Phase 0: idle heartbeat loop."""

import asyncio
import logging

logger = logging.getLogger(__name__)


async def run() -> None:
    logger.info("classifier_worker started (idle until Phase 5)")
    while True:
        await asyncio.sleep(30)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    asyncio.run(run())


if __name__ == "__main__":
    main()
