"""Runs worker health HTTP server plus background worker loops in one process."""

import asyncio
import logging

from app.workers.alert_rule_worker import run as run_alert_worker
from app.workers.classifier_worker import run as run_classifier_worker
from app.workers.health_server import start_health_server

logger = logging.getLogger(__name__)


async def run_supervisor() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    health_task = start_health_server()
    worker_tasks = [
        asyncio.create_task(run_classifier_worker(), name="classifier_worker"),
        asyncio.create_task(run_alert_worker(), name="alert_rule_worker"),
    ]
    logger.info("worker supervisor running")
    await asyncio.gather(health_task, *worker_tasks)


def main() -> None:
    asyncio.run(run_supervisor())


if __name__ == "__main__":
    main()
