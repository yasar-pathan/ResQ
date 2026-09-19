import logging

logger = logging.getLogger(__name__)


class SmsSimulator:
    """Simulated SMS/push — logged only, never presented as a live carrier."""

    async def send(self, *, to: str, body: str) -> bool:
        logger.info("SMS_SIMULATED to=%s body=%s", to, body[:200])
        return True
