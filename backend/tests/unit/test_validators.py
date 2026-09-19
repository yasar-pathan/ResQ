import pytest
from pydantic import ValidationError

from app.core.validators import (
    is_valid_contact,
    is_valid_password,
    is_valid_phone,
    is_valid_tracking_ref,
    validate_contact,
    validate_password,
    validate_tracking_ref,
)
from app.modules.auth.schemas import RegisterRequest
from app.modules.incidents.schemas import IncidentCreateRequest, LocationInput, SosCreateRequest


def test_phone_e164_like() -> None:
    assert is_valid_phone("+919876543210")
    assert is_valid_phone("919876543210")
    assert not is_valid_phone("123")
    assert not is_valid_phone("+0123")
    assert not is_valid_phone("'; DROP TABLE users;--")


def test_contact_email_or_phone() -> None:
    assert is_valid_contact("ops@example.com")
    assert is_valid_contact("+15551234567")
    assert not is_valid_contact("not-a-contact")
    with pytest.raises(ValueError):
        validate_contact("<script>alert(1)</script>")


def test_tracking_ref_hex12() -> None:
    assert is_valid_tracking_ref("ABCDEF012345")
    assert validate_tracking_ref("abcdef012345") == "ABCDEF012345"
    assert not is_valid_tracking_ref("short")
    assert not is_valid_tracking_ref("../../../etc/passwd")
    assert not is_valid_tracking_ref("'; DROP TABLE--")


def test_password_requires_letter_and_digit() -> None:
    assert is_valid_password("ChangeMe123!")
    assert not is_valid_password("short1")
    assert not is_valid_password("allletters")
    assert not is_valid_password("12345678")
    with pytest.raises(ValueError):
        validate_password("password")


def test_register_schema_rejects_weak_password() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest(
            name="Test",
            email="t@example.com",
            password="allletters",
        )


def test_register_schema_rejects_bad_phone() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest(
            name="Test",
            email="t@example.com",
            password="ValidPass1",
            phone="abc",
        )


def test_incident_description_bounds() -> None:
    with pytest.raises(ValidationError):
        IncidentCreateRequest(
            category="fire",
            description="too short",
            location=LocationInput(latitude=12.9, longitude=77.5),
            idempotency_key="key-12345678",
        )
    with pytest.raises(ValidationError):
        IncidentCreateRequest(
            category="fire",
            description="x" * 2001,
            location=LocationInput(latitude=12.9, longitude=77.5),
            idempotency_key="key-12345678",
        )


def test_sos_trusted_contact_validation() -> None:
    with pytest.raises(ValidationError):
        SosCreateRequest(
            location=LocationInput(latitude=12.9, longitude=77.5),
            idempotency_key="sos-12345678",
            trusted_contacts=[{"name": "Friend", "contact": "not-valid"}],
        )
