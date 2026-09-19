from datetime import UTC, datetime, timedelta

from app.models.enums import IncidentCategory
from app.modules.dedup.scoring import (
    BORDERLINE_THRESHOLD,
    HIGH_THRESHOLD,
    classify_match_score,
    compute_dedup_score,
)


def test_ut06_high_score_classified_as_merge() -> None:
    now = datetime.now(UTC)
    score = compute_dedup_score(
        distance_meters=10.0,
        radius_meters=150.0,
        created_at=now,
        other_created_at=now - timedelta(minutes=2),
        window_minutes=30,
        category=IncidentCategory.fire,
        other_category=IncidentCategory.fire,
        description="Warehouse fire with heavy smoke",
        other_description="Warehouse fire with heavy smoke reported",
    )
    assert score >= HIGH_THRESHOLD
    assert classify_match_score(score) == "merge"


def test_ut06_different_category_scores_zero() -> None:
    now = datetime.now(UTC)
    score = compute_dedup_score(
        distance_meters=5.0,
        radius_meters=150.0,
        created_at=now,
        other_created_at=now,
        window_minutes=30,
        category=IncidentCategory.fire,
        other_category=IncidentCategory.flood,
        description="same text",
        other_description="same text",
    )
    assert score == 0.0
    assert classify_match_score(score) == "none"


def test_ut06_borderline_possible_duplicate() -> None:
    assert classify_match_score(BORDERLINE_THRESHOLD) == "possible_duplicate"
