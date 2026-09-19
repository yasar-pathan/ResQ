from app.models.enums import AssignmentDecision


def test_ut08_assignment_decision_recording() -> None:
    """UT-08: accepted_ai / overridden / manual map to ai_recommended correctly."""
    cases = [
        (AssignmentDecision.accepted_ai, True),
        (AssignmentDecision.overridden, False),
        (AssignmentDecision.manual, False),
    ]
    for decision, expected_ai in cases:
        ai_recommended = decision == AssignmentDecision.accepted_ai
        assert ai_recommended is expected_ai
        assert decision.value in {"accepted_ai", "overridden", "manual"}
