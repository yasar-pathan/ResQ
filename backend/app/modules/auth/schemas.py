from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.validators import validate_password, validate_phone_optional
from app.models.user import UserRole


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = UserRole.citizen
    phone: str | None = Field(default=None, max_length=20)

    @field_validator("password")
    @classmethod
    def _password(cls, v: str) -> str:
        return validate_password(v)

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str | None) -> str | None:
        return validate_phone_optional(v)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserPublic(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: UserRole
    phone: str | None

    model_config = {"from_attributes": True}
