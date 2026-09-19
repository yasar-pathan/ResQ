import json
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.enums import IncidentCategory, IncidentPriority, IncidentSource, IncidentStatus
from app.models.incident import Incident
from app.modules.classification.llm_client import LLMClient, LLMClientError
from app.modules.classification.schemas import ClassificationResult
from app.modules.classification.service import ClassificationService


def _incident(**kwargs: object) -> Incident:
    base = {
        "category": IncidentCategory.fire,
        "description": "Large smoke visible near warehouse",
        "source": IncidentSource.citizen_web,
        "status": IncidentStatus.reported,
    }
    base.update(kwargs)
    return Incident(**base)


def test_ut04_classification_result_schema() -> None:
    raw = {
        "severity": 4,
        "priority": "high",
        "summary": "Possible structure fire with smoke.",
        "confidence": 0.82,
    }
    result = ClassificationResult.model_validate(raw)
    assert result.priority == IncidentPriority.high
    assert result.severity == 4


def test_ut04_invalid_json_raises() -> None:
    with pytest.raises(Exception):
        ClassificationResult.model_validate({"severity": 10, "priority": "high", "summary": "x", "confidence": 1})


@pytest.mark.asyncio
async def test_ut04b_fallback_when_llm_fails() -> None:
    session = AsyncMock()
    settings = MagicMock()
    settings.llm_api_key = "key"
    settings.llm_api_base_url = "https://api.example.com/v1"
    settings.llm_model = "test"
    settings.dedup_radius_meters = 150
    settings.dedup_time_window_minutes = 30

    incident = _incident()
    service = ClassificationService(session, settings)
    with patch.object(service.llm, "classify", AsyncMock(side_effect=LLMClientError("timeout"))):
        result, source = await service.classify_incident(incident)
    assert source.value == "fallback"
    assert result.summary


@pytest.mark.asyncio
async def test_ut04b_fallback_when_llm_not_configured() -> None:
    session = AsyncMock()
    settings = MagicMock()
    settings.llm_api_key = None
    settings.llm_api_base_url = None
    service = ClassificationService(session, settings)
    result, source = await service.classify_incident(_incident())
    assert source.value == "fallback"
    assert result.confidence == Decimal("0.45")


def test_ut04_llm_client_requires_model_when_configured() -> None:
    settings = MagicMock()
    settings.llm_api_key = "k"
    settings.llm_api_base_url = "https://api.example.com/v1"
    settings.llm_model = None
    client = LLMClient(settings)
    assert client.is_configured() is False


@pytest.mark.asyncio
async def test_ut04_llm_client_parses_response() -> None:
    settings = MagicMock()
    settings.llm_api_key = "k"
    settings.llm_api_base_url = "https://api.example.com/v1"
    settings.llm_model = "m"
    client = LLMClient(settings)
    payload = {
        "choices": [
            {
                "message": {
                    "content": json.dumps(
                        {
                            "severity": 3,
                            "priority": "medium",
                            "summary": "Test summary here.",
                            "confidence": 0.7,
                        }
                    )
                }
            }
        ]
    }
    with patch("httpx.AsyncClient") as mock_client:
        instance = mock_client.return_value.__aenter__.return_value
        response = MagicMock()
        response.raise_for_status = MagicMock()
        response.json.return_value = payload
        instance.post = AsyncMock(return_value=response)

        result = await client.classify(_incident())
    assert result.priority == IncidentPriority.medium
