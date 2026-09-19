"""Shared input validators (Phase 11 production hardening)."""

from __future__ import annotations

import re

PHONE_RE = re.compile(r"^\+?[1-9]\d{7,14}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
TRACKING_REF_RE = re.compile(r"^[A-F0-9]{12}$")
PASSWORD_RE = re.compile(r"^(?=.*[A-Za-z])(?=.*\d).{8,128}$")


def is_valid_phone(value: str) -> bool:
    return bool(PHONE_RE.match(value.strip()))


def is_valid_email_loose(value: str) -> bool:
    return bool(EMAIL_RE.match(value.strip()))


def is_valid_contact(value: str) -> bool:
    v = value.strip()
    return is_valid_phone(v) or is_valid_email_loose(v)


def is_valid_tracking_ref(value: str) -> bool:
    return bool(TRACKING_REF_RE.match(value.strip().upper()))


def is_valid_password(value: str) -> bool:
    return bool(PASSWORD_RE.match(value))


def validate_phone_optional(value: str | None) -> str | None:
    if value is None or value == "":
        return None
    if not is_valid_phone(value):
        raise ValueError("phone must be E.164-like (+ and 8–15 digits)")
    return value.strip()


def validate_contact(value: str) -> str:
    if not is_valid_contact(value):
        raise ValueError("contact must be a valid email or E.164-like phone")
    return value.strip()


def validate_password(value: str) -> str:
    if not is_valid_password(value):
        raise ValueError("password must be 8–128 chars with at least one letter and one digit")
    return value


def validate_tracking_ref(value: str) -> str:
    normalized = value.strip().upper()
    if not is_valid_tracking_ref(normalized):
        raise ValueError("tracking_ref must be 12 hexadecimal characters")
    return normalized
