import uuid
from typing import TYPE_CHECKING, Any

from geoalchemy2 import Geography
from sqlalchemy import Boolean, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import ResourceStatus, ResourceType


class Resource(Base, TimestampMixin):
    __tablename__ = "resources"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type: Mapped[ResourceType] = mapped_column(
        Enum(ResourceType, name="resource_type", create_type=False), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    location: Mapped[object] = mapped_column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=True), nullable=False
    )
    capabilities: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[ResourceStatus] = mapped_column(
        Enum(ResourceStatus, name="resource_status", create_type=False),
        nullable=False,
        default=ResourceStatus.available,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    operator_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), index=True, nullable=True
    )

    assignments: Mapped[list["Assignment"]] = relationship(back_populates="resource")


if TYPE_CHECKING:
    from app.models.assignment import Assignment
