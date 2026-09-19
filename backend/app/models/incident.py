import secrets
import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from geoalchemy2 import Geography
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Numeric, SmallInteger, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import (
    ClassificationSource,
    IncidentCategory,
    IncidentPriority,
    IncidentSource,
    IncidentStatus,
)

if TYPE_CHECKING:
    from app.models.assignment import Assignment
    from app.models.classification_queue import ClassificationQueue
    from app.models.incident_media import IncidentMedia


def generate_tracking_ref() -> str:
    return secrets.token_hex(6)[:12].upper()


class Incident(Base, TimestampMixin):
    __tablename__ = "incidents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tracking_ref: Mapped[str] = mapped_column(
        String(12), unique=True, index=True, nullable=False, default=generate_tracking_ref
    )
    reporter_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), index=True, nullable=True
    )
    is_anonymous: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    category: Mapped[IncidentCategory] = mapped_column(
        Enum(IncidentCategory, name="incident_category", create_type=False),
        nullable=False,
        index=True,
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    location: Mapped[object] = mapped_column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=True), nullable=False
    )
    address_text: Mapped[str | None] = mapped_column(String(500), nullable=True)
    source: Mapped[IncidentSource] = mapped_column(
        Enum(IncidentSource, name="incident_source", create_type=False),
        nullable=False,
        index=True,
    )
    severity: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    priority: Mapped[IncidentPriority | None] = mapped_column(
        Enum(IncidentPriority, name="incident_priority", create_type=False),
        nullable=True,
        index=True,
    )
    ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_confidence: Mapped[Decimal | None] = mapped_column(Numeric(3, 2), nullable=True)
    classification_source: Mapped[ClassificationSource | None] = mapped_column(
        Enum(ClassificationSource, name="classification_source", create_type=False),
        nullable=True,
    )
    status: Mapped[IncidentStatus] = mapped_column(
        Enum(IncidentStatus, name="incident_status", create_type=False),
        nullable=False,
        default=IncidentStatus.reported,
        index=True,
    )
    merged_into_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("incidents.id"), index=True, nullable=True
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    media: Mapped[list["IncidentMedia"]] = relationship(back_populates="incident")
    assignments: Mapped[list["Assignment"]] = relationship(back_populates="incident")
    queue_entries: Mapped[list["ClassificationQueue"]] = relationship(back_populates="incident")
