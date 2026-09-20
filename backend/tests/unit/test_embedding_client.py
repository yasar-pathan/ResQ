from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.modules.dedup.embedding_client import EmbeddingClient, cosine_similarity


def test_cosine_similarity_identical() -> None:
    assert cosine_similarity([1.0, 0.0], [1.0, 0.0]) == pytest.approx(1.0)


def test_embedding_client_not_configured_without_model() -> None:
    settings = MagicMock()
    settings.llm_api_key = "k"
    settings.llm_api_base_url = "https://api.openai.com/v1"
    settings.llm_embedding_model = None
    client = EmbeddingClient(settings)
    assert client.is_configured() is False


@pytest.mark.asyncio
async def test_embedding_client_parses_openai_response() -> None:
    settings = MagicMock()
    settings.llm_api_key = "k"
    settings.llm_api_base_url = "https://api.openai.com/v1"
    settings.llm_embedding_model = "text-embedding-3-small"
    client = EmbeddingClient(settings)
    payload = {
        "data": [
            {"index": 0, "embedding": [1.0, 0.0]},
            {"index": 1, "embedding": [0.0, 1.0]},
        ]
    }
    with patch("httpx.AsyncClient") as mock_client:
        instance = mock_client.return_value.__aenter__.return_value
        response = MagicMock()
        response.raise_for_status = MagicMock()
        response.json.return_value = payload
        instance.post = AsyncMock(return_value=response)
        vectors = await client.embed_texts(["a", "b"])
    assert len(vectors) == 2
    assert vectors[0][0] == 1.0
