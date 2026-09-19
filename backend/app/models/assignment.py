import uuid
from datetime import datetime

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import AssignmentDecision, AssignmentStatus


class Assignment(Base, TimestampMixin):
    __tablename__ = "assignments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    incident_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("incidents.id"), index=True, nullable=False
    )
    resource_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("resources.id"), index=True, nullable=False
    )
    assigned_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    ai_recommended: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    recommendation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    decision: Mapped[AssignmentDecision] = mapped_column(
        Enum(AssignmentDecision, name="assignment_decision", create_type=False), nullable=False
    )
    status: Mapped[AssignmentStatus] = mapped_column(
        Enum(AssignmentStatus, name="assignment_status", create_type=False),
        nullable=False,
        default=AssignmentStatus.proposed,
        index=True,
    )
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    incident: Mapped["Incident"] = relationship(back_populates="assignments")
    resource: Mapped["Resource"] = relationship(back_populates="assignments")


if TYPE_CHECKING:
    from app.models.incident import Incident
    from app.models.resource import Resource
