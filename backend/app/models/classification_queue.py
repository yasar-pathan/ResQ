import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, SmallInteger
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import QueueStatus

if TYPE_CHECKING:
    from app.models.incident import Incident


class ClassificationQueue(Base, TimestampMixin):
    __tablename__ = "classification_queue"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    incident_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("incidents.id"), index=True, nullable=False
    )
    status: Mapped[QueueStatus] = mapped_column(
        Enum(QueueStatus, name="queue_status", create_type=False),
        nullable=False,
        default=QueueStatus.pending,
        index=True,
    )
    attempts: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)

    incident: Mapped["Incident"] = relationship(back_populates="queue_entries")
