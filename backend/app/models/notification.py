import uuid

from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin
from app.models.enums import NotificationChannel, NotificationStatus, NotificationTargetType


class Notification(Base, TimestampMixin):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    target_type: Mapped[NotificationTargetType] = mapped_column(
        Enum(NotificationTargetType, name="notification_target_type", create_type=False),
        nullable=False,
    )
    target_ref: Mapped[str] = mapped_column(String(255), nullable=False)
    channel: Mapped[NotificationChannel] = mapped_column(
        Enum(NotificationChannel, name="notification_channel", create_type=False), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[NotificationStatus] = mapped_column(
        Enum(NotificationStatus, name="notification_status", create_type=False),
        nullable=False,
        default=NotificationStatus.queued,
        index=True,
    )
    related_incident_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("incidents.id"), nullable=True, index=True
    )
