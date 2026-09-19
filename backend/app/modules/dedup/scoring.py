from dataclasses import dataclass
from datetime import datetime
from difflib import SequenceMatcher

from app.models.enums import IncidentCategory

HIGH_THRESHOLD = 0.85
BORDERLINE_THRESHOLD = 0.65


@dataclass(frozen=True)
class DedupCandidate:
    incident_id: object
    distance_meters: float
    created_at: datetime
    category: IncidentCategory
    description: str


def text_similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def time_proximity_score(created_at: datetime, other: datetime, window_minutes: int) -> float:
    if window_minutes <= 0:
        return 0.0
    delta_seconds = abs((created_at - other).total_seconds())
    window_seconds = window_minutes * 60
    if delta_seconds >= window_seconds:
        return 0.0
    return 1.0 - (delta_seconds / window_seconds)


def distance_score(distance_meters: float, radius_meters: float) -> float:
    if radius_meters <= 0:
        return 0.0
    if distance_meters >= radius_meters:
        return 0.0
    return 1.0 - (distance_meters / radius_meters)


def compute_dedup_score(
    *,
    distance_meters: float,
    radius_meters: float,
    created_at: datetime,
    other_created_at: datetime,
    window_minutes: int,
    category: IncidentCategory,
    other_category: IncidentCategory,
    description: str,
    other_description: str,
    embedding_similarity: float | None = None,
) -> float:
    if category != other_category:
        return 0.0
    dist = distance_score(distance_meters, radius_meters)
    time_part = time_proximity_score(created_at, other_created_at, window_minutes)
    seq = text_similarity(description, other_description)
    if embedding_similarity is not None:
        text_part = max(seq, embedding_similarity)
    else:
        text_part = seq
    return 0.45 * dist + 0.25 * time_part + 0.30 * text_part


def classify_match_score(score: float) -> str:
    if score >= HIGH_THRESHOLD:
        return "merge"
    if score >= BORDERLINE_THRESHOLD:
        return "possible_duplicate"
    return "none"
