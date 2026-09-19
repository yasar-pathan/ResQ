import uuid

from app.core.security import create_access_token, decode_access_token
from app.models.user import UserRole


def test_jwt_issue_and_decode_role() -> None:
    user_id = uuid.uuid4()
    token = create_access_token(user_id, UserRole.dispatcher)
    payload = decode_access_token(token)
    assert payload["sub"] == str(user_id)
    assert payload["role"] == "dispatcher"
    assert payload["type"] == "access"
