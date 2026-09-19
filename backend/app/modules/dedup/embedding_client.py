import logging
import math
from typing import Any

import httpx

from app.config import Settings

logger = logging.getLogger(__name__)


class EmbeddingClientError(Exception):
    pass


def cosine_similarity(a: list[float], b: list[float]) -> float:
    if len(a) != len(b) or not a:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b, strict=True))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0.0 or nb == 0.0:
        return 0.0
    return max(0.0, min(1.0, dot / (na * nb)))


class EmbeddingClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._timeout = httpx.Timeout(30.0, connect=10.0)

    def is_configured(self) -> bool:
        return bool(
            self.settings.llm_api_key
            and self.settings.llm_api_base_url
            and self.settings.llm_embedding_model
        )

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not self.is_configured():
            raise EmbeddingClientError("Embeddings not configured")
        if not texts:
            return []
        base = (self.settings.llm_api_base_url or "").rstrip("/")
        model = self.settings.llm_embedding_model or ""
        url = f"{base}/embeddings"
        payload: dict[str, Any] = {"model": model, "input": texts}
        headers = {
            "Authorization": f"Bearer {self.settings.llm_api_key}",
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                body = response.json()
            data = body.get("data") or []
            vectors: list[list[float]] = []
            for item in sorted(data, key=lambda x: x.get("index", 0)):
                vectors.append([float(v) for v in item["embedding"]])
            if len(vectors) != len(texts):
                raise EmbeddingClientError("Embedding count mismatch")
            return vectors
        except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
            logger.warning("Embedding request failed: %s", exc)
            raise EmbeddingClientError(str(exc)) from exc
