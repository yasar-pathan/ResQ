"""Pure recommendation ranking (UT-07)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RankedCandidate:
    resource_id: str
    name: str
    distance_meters: float
    capability_match: bool
    load: int
    score: float
    recommendation_reason: str


def capability_matches(capabilities: dict | None, category: str) -> bool:
    if not capabilities:
        return False
    handles = capabilities.get("handles") or []
    if isinstance(handles, str):
        handles = [handles]
    return category in handles


def score_candidate(
    *,
    distance_meters: float,
    capability_match: bool,
    load: int,
    max_distance_meters: float = 50_000.0,
) -> float:
    if max_distance_meters <= 0:
        proximity = 0.0
    else:
        proximity = max(0.0, 1.0 - min(distance_meters, max_distance_meters) / max_distance_meters)
    cap = 1.0 if capability_match else 0.15
    load_factor = 1.0 / (1.0 + max(0, load))
    return 0.45 * proximity + 0.40 * cap + 0.15 * load_factor


def build_reason(
    *,
    name: str,
    distance_meters: float,
    capability_match: bool,
    category: str,
    is_primary: bool = True,
) -> str:
    km = distance_meters / 1000.0
    match = f"matches {category}" if capability_match else "partial capability match"
    proximity_desc = "nearest available unit" if is_primary else "alternate nearby unit"
    return f"{name}: {proximity_desc}, {km:.1f}km, {match}"


def rank_candidates(candidates: list[RankedCandidate], limit: int = 3) -> list[RankedCandidate]:
    return sorted(candidates, key=lambda c: c.score, reverse=True)[:limit]
