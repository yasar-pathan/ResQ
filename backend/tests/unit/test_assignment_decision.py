from app.models.enums import AssignmentDecision


def test_ut08_assignment_decision_values() -> None:
    assert AssignmentDecision.accepted_ai.value == "accepted_ai"
    assert AssignmentDecision.overridden.value == "overridden"
    assert AssignmentDecision.manual.value == "manual"
    assert set(AssignmentDecision) == {
        AssignmentDecision.accepted_ai,
        AssignmentDecision.overridden,
        AssignmentDecision.manual,
    }
