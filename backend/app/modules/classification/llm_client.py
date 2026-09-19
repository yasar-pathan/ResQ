import json
import logging
from typing import Any

import httpx

from app.config import Settings
from app.models.incident import Incident
from app.modules.classification.prompts import build_classification_messages
from app.modules.classification.schemas import ClassificationResult

logger = logging.getLogger(__name__)


class LLMClientError(Exception):
    pass


class LLMClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._timeout = httpx.Timeout(30.0, connect=10.0)

    def is_configured(self) -> bool:
        return bool(self.settings.llm_api_key and self.settings.llm_api_base_url)

    async def classify(self, incident: Incident) -> ClassificationResult:
        if not self.is_configured():
            raise LLMClientError("LLM not configured")
        base = (self.settings.llm_api_base_url or "").rstrip("/")
        model = self.settings.llm_model or "gpt-4o-mini"
        url = f"{base}/chat/completions"
        messages = build_classification_messages(incident)
        payload: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
        }
        headers = {
            "Authorization": f"Bearer {self.settings.llm_api_key}",
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                body = response.json()
        except (httpx.HTTPError, json.JSONDecodeError) as exc:
            logger.warning("LLM request failed: %s", exc)
            raise LLMClientError(str(exc)) from exc

        try:
            content = body["choices"][0]["message"]["content"]
            data = json.loads(content)
            return ClassificationResult.model_validate(data)
        except (KeyError, IndexError, json.JSONDecodeError, ValueError) as exc:
            raise LLMClientError(f"Invalid LLM response: {exc}") from exc
