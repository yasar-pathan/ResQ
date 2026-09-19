from app.modules.assignments.scoring import (
    RankedCandidate,
    capability_matches,
    rank_candidates,
    score_candidate,
)


def test_ut07_recommendation_ranking_deterministic() -> None:
    near_match = RankedCandidate(
        resource_id="a",
        name="Near Fire",
        distance_meters=500,
        capability_match=True,
        load=0,
        score=score_candidate(distance_meters=500, capability_match=True, load=0),
        recommendation_reason="x",
    )
    far_match = RankedCandidate(
        resource_id="b",
        name="Far Fire",
        distance_meters=20_000,
        capability_match=True,
        load=0,
        score=score_candidate(distance_meters=20_000, capability_match=True, load=0),
        recommendation_reason="x",
    )
    near_partial = RankedCandidate(
        resource_id="c",
        name="Near Other",
        distance_meters=400,
        capability_match=False,
        load=0,
        score=score_candidate(distance_meters=400, capability_match=False, load=0),
        recommendation_reason="x",
    )
    ranked = rank_candidates([far_match, near_partial, near_match], limit=3)
    assert [c.resource_id for c in ranked] == ["a", "b", "c"]
    assert capability_matches({"handles": ["fire"]}, "fire") is True
    assert capability_matches({"handles": ["medical"]}, "fire") is False
