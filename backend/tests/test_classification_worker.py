import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.modules.classification.llm_client import LLMClientError

from app.config import get_settings
from app.db.geo import point_wkt
from app.db.session import close_db, get_session_factory, init_db
from app.models.classification_queue import ClassificationQueue
from app.models.enums import (
    ClassificationSource,
    IncidentCategory,
    IncidentSource,
    IncidentStatus,
    QueueStatus,
)
from app.models.incident import Incident
from app.modules.classification.service import ClassificationService


@pytest.fixture
def settings():
    return get_settings()


@pytest.fixture(autouse=True)
async def isolated_db_engine() -> None:
    await close_db()
    init_db()
    yield
    await close_db()


@pytest.mark.asyncio
async def test_it04_classify_via_fallback_without_llm_key(settings) -> None:
    factory = get_session_factory()
    async with factory() as session:
        incident = Incident(
            tracking_ref=f"IT04{uuid.uuid4().hex[:8].upper()}",
            category=IncidentCategory.fire,
            description="Smoke and flames visible in remote test grid",
            location=point_wkt(-33.8688, 151.2093),
            source=IncidentSource.citizen_web,
            status=IncidentStatus.reported,
        )
        session.add(incident)
        await session.flush()
        queue = ClassificationQueue(incident_id=incident.id, status=QueueStatus.pending, attempts=0)
        session.add(queue)
        await session.commit()

    async with factory() as session:
        svc = ClassificationService(session, settings)
        with patch("app.modules.classification.service.publish_incident_update", return_value=None):
            await svc.process_queue_item(queue.id)

    async with factory() as session:
        updated = await session.get(Incident, incident.id)
        assert updated is not None
        assert updated.classification_source == ClassificationSource.fallback
        assert updated.status != IncidentStatus.reported
        assert updated.ai_summary


@pytest.mark.asyncio
async def test_it04_llm_success(settings) -> None:
    settings_mock = MagicMock()
    settings_mock.llm_api_key = "test-key"
    settings_mock.llm_api_base_url = "https://api.example.com/v1"
    settings_mock.llm_model = "gpt-test"
    settings_mock.dedup_radius_meters = settings.dedup_radius_meters
    settings_mock.dedup_time_window_minutes = settings.dedup_time_window_minutes

    factory = get_session_factory()
    async with factory() as session:
        incident = Incident(
            tracking_ref=f"IT04L{uuid.uuid4().hex[:7].upper()}",
            category=IncidentCategory.fire,
            description="Building fire",
            location=point_wkt(12.9720, 77.5950),
            source=IncidentSource.citizen_web,
            status=IncidentStatus.reported,
        )
        session.add(incident)
        await session.flush()
        queue = ClassificationQueue(incident_id=incident.id, status=QueueStatus.pending, attempts=0)
        session.add(queue)
        await session.commit()
        qid = queue.id

    async with factory() as session:
        svc = ClassificationService(session, settings_mock)
        from decimal import Decimal

        from app.models.enums import IncidentPriority
        from app.modules.classification.schemas import ClassificationResult

        mock_result = ClassificationResult(
            severity=4,
            priority=IncidentPriority.high,
            summary="LLM classified fire incident.",
            confidence=Decimal("0.88"),
        )
        with patch.object(
            svc.llm, "classify", AsyncMock(return_value=mock_result)
        ), patch("app.modules.classification.service.publish_incident_update", return_value=None):
            await svc.process_queue_item(qid)

    async with factory() as session:
        updated = await session.get(Incident, incident.id)
        assert updated.classification_source == ClassificationSource.llm
        assert updated.priority.value == "high"


@pytest.mark.asyncio
async def test_it04_llm_malformed_falls_back(settings) -> None:
    settings_mock = MagicMock()
    settings_mock.llm_api_key = "test-key"
    settings_mock.llm_api_base_url = "https://api.example.com/v1"
    settings_mock.llm_model = "gpt-test"
    settings_mock.dedup_radius_meters = settings.dedup_radius_meters
    settings_mock.dedup_time_window_minutes = settings.dedup_time_window_minutes

    factory = get_session_factory()
    async with factory() as session:
        incident = Incident(
            tracking_ref=f"IT04B{uuid.uuid4().hex[:7].upper()}",
            category=IncidentCategory.medical,
            description="Injury at site",
            location=point_wkt(12.9700, 77.5900),
            source=IncidentSource.citizen_web,
            status=IncidentStatus.reported,
        )
        session.add(incident)
        await session.flush()
        queue = ClassificationQueue(incident_id=incident.id, status=QueueStatus.pending, attempts=0)
        session.add(queue)
        await session.commit()
        qid = queue.id

    async with factory() as session:
        svc = ClassificationService(session, settings_mock)
        with patch.object(
            svc.llm, "classify", side_effect=LLMClientError("bad json")
        ), patch("app.modules.classification.service.publish_incident_update", return_value=None):
            await svc.process_queue_item(qid)

    async with factory() as session:
        updated = await session.get(Incident, incident.id)
        assert updated.classification_source == ClassificationSource.fallback


@pytest.mark.asyncio
async def test_it01_post_then_classified(settings) -> None:
    """IT-01 extension: queue row processed to classified."""
    factory = get_session_factory()
    async with factory() as session:
        incident = Incident(
            tracking_ref=f"IT01{uuid.uuid4().hex[:8].upper()}",
            category=IncidentCategory.road_incident,
            description="Minor accident on highway",
            location=point_wkt(40.7128, -74.0060),
            source=IncidentSource.citizen_web,
            status=IncidentStatus.reported,
        )
        session.add(incident)
        await session.flush()
        queue = ClassificationQueue(incident_id=incident.id, status=QueueStatus.pending, attempts=0)
        session.add(queue)
        await session.commit()
        qid = queue.id

    async with factory() as session:
        svc = ClassificationService(session, settings)
        with patch("app.modules.classification.service.publish_incident_update", return_value=None):
            await svc.process_queue_item(qid)

    async with factory() as session:
        updated = await session.get(Incident, incident.id)
        assert updated.status in (
            IncidentStatus.classified,
            IncidentStatus.merged,
            IncidentStatus.possible_duplicate,
        )
        assert updated.ai_summary


@pytest.mark.asyncio
async def test_it05_dedup_merges_near_duplicate(settings) -> None:
    factory = get_session_factory()
    desc = "Warehouse fire with heavy smoke on MG Road"
    loc = point_wkt(12.9716, 77.5946)

    async with factory() as session:
        parent = Incident(
            tracking_ref=f"IT05P{uuid.uuid4().hex[:7].upper()}",
            category=IncidentCategory.fire,
            description=desc,
            location=loc,
            source=IncidentSource.citizen_web,
            status=IncidentStatus.classified,
            severity=4,
        )
        session.add(parent)
        await session.flush()
        child = Incident(
            tracking_ref=f"IT05C{uuid.uuid4().hex[:7].upper()}",
            category=IncidentCategory.fire,
            description=desc,
            location=point_wkt(12.97161, 77.59461),
            source=IncidentSource.citizen_web,
            status=IncidentStatus.reported,
        )
        session.add(child)
        await session.flush()
        queue = ClassificationQueue(incident_id=child.id, status=QueueStatus.pending, attempts=0)
        session.add(queue)
        await session.commit()
        child_id = child.id
        parent_id = parent.id
        qid = queue.id

    async with factory() as session:
        svc = ClassificationService(session, settings)
        with patch("app.modules.classification.service.publish_incident_update", return_value=None):
            await svc.process_queue_item(qid)

    async with factory() as session:
        merged = await session.get(Incident, child_id)
        assert merged is not None
        assert merged.status in (IncidentStatus.merged, IncidentStatus.possible_duplicate)
        assert merged.merged_into_id == parent_id
