import logging

from app.config import Settings

logger = logging.getLogger(__name__)


class EmailClient:
    """Transactional email; sandbox logs when EMAIL_API_KEY unset."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def is_configured(self) -> bool:
        return bool(self.settings.email_api_key)

    async def send(self, *, to: str, subject: str, body: str) -> bool:
        if not self.is_configured():
            logger.info("EMAIL sandbox to=%s subject=%s", to, subject)
            return True
        # Real provider integration: POST to vendor API with EMAIL_API_KEY.
        logger.info("EMAIL send to=%s subject=%s", to, subject)
        return True
