"""Polls classification_queue and runs AI triage + dedup (Phase 5)."""

import asyncio
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.session import get_session_factory, init_db
from app.models.classification_queue import ClassificationQueue
from app.models.enums import QueueStatus
from app.modules.classification.service import ClassificationService

logger = logging.getLogger(__name__)


async def _claim_next_pending(session: AsyncSession) -> ClassificationQueue | None:
    stmt = (
        select(ClassificationQueue)
        .where(ClassificationQueue.status == QueueStatus.pending)
        .order_by(ClassificationQueue.created_at.asc())
        .limit(1)
        .with_for_update(skip_locked=True)
    )
    result = await session.execute(stmt)
    row = result.scalar_one_or_none()
    if row is None:
        return None
    row.status = QueueStatus.processing
    row.attempts = int(row.attempts) + 1
    await session.flush()
    return row


async def _process_once() -> bool:
    settings = get_settings()
    factory = get_session_factory()
    async with factory() as session:
        row = await _claim_next_pending(session)
        if row is None:
            return False
        queue_id = row.id
        incident_id = row.incident_id
        try:
            service = ClassificationService(session, settings)
            await service.process_incident(incident_id)
            row.status = QueueStatus.done
            await session.commit()
            logger.info("Classified incident %s (queue %s)", incident_id, queue_id)
            return True
        except Exception:
            logger.exception("Classification failed for incident %s", incident_id)
            await session.rollback()
            async with factory() as retry_session:
                row = await retry_session.get(ClassificationQueue, queue_id)
                if row is None:
                    return False
                if row.attempts >= settings.classifier_max_attempts:
                    row.status = QueueStatus.failed
                else:
                    row.status = QueueStatus.pending
                await retry_session.commit()
            return False


async def run() -> None:
    init_db()
    settings = get_settings()
    logger.info("classifier_worker started (poll=%ss)", settings.classifier_poll_seconds)
    while True:
        processed = await _process_once()
        if not processed:
            await asyncio.sleep(settings.classifier_poll_seconds)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    asyncio.run(run())


if __name__ == "__main__":
    main()
