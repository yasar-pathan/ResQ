from types import SimpleNamespace

from app.modules.notifications.service import (
    build_assignment_email,
    build_trusted_contact_payload,
)


def test_ut11_assignment_email_content() -> None:
    incident = SimpleNamespace(
        tracking_ref="TESTREF0001",
        category=SimpleNamespace(value="fire"),
        priority=SimpleNamespace(value="high"),
        ai_summary=None,
        description="Smoke on floor 3",
    )
    resource = SimpleNamespace(name="Alpha Unit")
    body = build_assignment_email(incident, resource)  # type: ignore[arg-type]
    assert "Alpha Unit" in body
    assert "TESTREF0001" in body
    assert "Smoke on floor 3" in body


def test_ut16_trusted_contact_excludes_full_description() -> None:
    incident = SimpleNamespace(
        tracking_ref="TESTREF0001",
        description="Full confidential description that must not leak",
    )
    payload = build_trusted_contact_payload(incident, include_full_description=False)  # type: ignore[arg-type]
    assert "TESTREF0001" in payload
    assert "Full confidential description" not in payload
    full = build_trusted_contact_payload(incident, include_full_description=True)  # type: ignore[arg-type]
    assert "Full confidential description" in full
