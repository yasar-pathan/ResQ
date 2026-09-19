"""Core domain schema per Doc 03 section 4.

Revision ID: 003_core
Revises: 002_auth
Create Date: 2026-03-19

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "003_core"
down_revision: Union[str, None] = "002_auth"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _create_enum(name: str, values: list[str]) -> None:
    postgresql.ENUM(*values, name=name).create(op.get_bind(), checkfirst=True)


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    enums = {
        "incident_category": [
            "fire",
            "flood",
            "industrial_accident",
            "road_incident",
            "medical",
            "personal_safety",
            "other",
        ],
        "incident_source": ["citizen_web", "sos", "sensor", "call", "field_team"],
        "incident_priority": ["low", "medium", "high", "critical"],
        "incident_status": [
            "reported",
            "classified",
            "possible_duplicate",
            "merged",
            "assigned",
            "in_progress",
            "resolved",
            "closed",
        ],
        "classification_source": ["llm", "fallback"],
        "media_type": ["photo", "audio"],
        "resource_type": ["team", "vehicle", "equipment", "facility"],
        "resource_status": ["available", "assigned", "unavailable"],
        "assignment_decision": ["accepted_ai", "overridden", "manual"],
        "assignment_status": [
            "proposed",
            "confirmed",
            "en_route",
            "on_scene",
            "completed",
            "cancelled",
        ],
        "alert_type": ["critical_incident", "delayed_response", "escalation_required"],
        "alert_status": ["active", "acknowledged", "resolved"],
        "notification_target_type": ["user", "trusted_contact"],
        "notification_channel": ["email", "sms_simulated", "push_simulated"],
        "notification_status": ["queued", "sent", "delivered", "failed", "failed_permanent"],
        "queue_status": ["pending", "processing", "done", "failed"],
    }
    for name, values in enums.items():
        _create_enum(name, values)

    def col_enum(name: str):
        return postgresql.ENUM(name=name, create_type=False)

    op.create_table(
        "incidents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tracking_ref", sa.String(12), nullable=False),
        sa.Column("reporter_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("is_anonymous", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("category", col_enum("incident_category"), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("location", sa.Text(), nullable=False),  # replaced below
        sa.Column("address_text", sa.String(500)),
        sa.Column("source", col_enum("incident_source"), nullable=False),
        sa.Column("severity", sa.SmallInteger()),
        sa.Column("priority", col_enum("incident_priority")),
        sa.Column("ai_summary", sa.Text()),
        sa.Column("ai_confidence", sa.Numeric(3, 2)),
        sa.Column("classification_source", col_enum("classification_source")),
        sa.Column(
            "status",
            col_enum("incident_status"),
            server_default="reported",
            nullable=False,
        ),
        sa.Column("merged_into_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("incidents.id")),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.execute("ALTER TABLE incidents DROP COLUMN location")
    op.execute("ALTER TABLE incidents ADD COLUMN location geography(POINT, 4326) NOT NULL")
    op.create_index("ix_incidents_tracking_ref", "incidents", ["tracking_ref"], unique=True)
    op.create_index("ix_incidents_reporter_id", "incidents", ["reporter_id"])
    op.create_index("ix_incidents_category", "incidents", ["category"])
    op.create_index("ix_incidents_source", "incidents", ["source"])
    op.create_index("ix_incidents_priority", "incidents", ["priority"])
    op.create_index("ix_incidents_status", "incidents", ["status"])
    op.create_index("ix_incidents_merged_into_id", "incidents", ["merged_into_id"])
    op.create_index("ix_incidents_created_at", "incidents", ["created_at"])
    op.create_index(
        "ix_incidents_queue_sort",
        "incidents",
        ["status", "priority", "created_at"],
    )
    op.execute(
        "CREATE INDEX ix_incidents_location_gist ON incidents USING GIST (location)"
    )

    op.create_table(
        "incident_media",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "incident_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("incidents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("type", col_enum("media_type"), nullable=False),
        sa.Column("storage_url", sa.String(500), nullable=False),
        sa.Column(
            "uploaded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_incident_media_incident_id", "incident_media", ["incident_id"])

    op.create_table(
        "resources",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("type", col_enum("resource_type"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("location", sa.Text(), nullable=False),
        sa.Column("capabilities", postgresql.JSONB()),
        sa.Column(
            "status",
            col_enum("resource_status"),
            server_default="available",
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.execute("ALTER TABLE resources DROP COLUMN location")
    op.execute("ALTER TABLE resources ADD COLUMN location geography(POINT, 4326) NOT NULL")
    op.create_index("ix_resources_type", "resources", ["type"])
    op.create_index("ix_resources_status", "resources", ["status"])
    op.execute("CREATE INDEX ix_resources_location_gist ON resources USING GIST (location)")

    op.create_table(
        "assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "incident_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("incidents.id"),
            nullable=False,
        ),
        sa.Column(
            "resource_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("resources.id"),
            nullable=False,
        ),
        sa.Column(
            "assigned_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("ai_recommended", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("recommendation_reason", sa.Text()),
        sa.Column("decision", col_enum("assignment_decision"), nullable=False),
        sa.Column(
            "status",
            col_enum("assignment_status"),
            server_default="proposed",
            nullable=False,
        ),
        sa.Column("assigned_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_assignments_incident_id", "assignments", ["incident_id"])
    op.create_index("ix_assignments_resource_id", "assignments", ["resource_id"])
    op.create_index("ix_assignments_status", "assignments", ["status"])
    op.execute(
        """
        CREATE UNIQUE INDEX uq_assignments_resource_active
        ON assignments (resource_id)
        WHERE status NOT IN ('completed', 'cancelled')
        """
    )

    op.create_table(
        "alerts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("incident_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("incidents.id")),
        sa.Column("type", col_enum("alert_type"), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column(
            "status",
            col_enum("alert_status"),
            server_default="active",
            nullable=False,
        ),
        sa.Column(
            "acknowledged_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_alerts_incident_id", "alerts", ["incident_id"])
    op.create_index("ix_alerts_status", "alerts", ["status"])

    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("target_type", col_enum("notification_target_type"), nullable=False),
        sa.Column("target_ref", sa.String(255), nullable=False),
        sa.Column("channel", col_enum("notification_channel"), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "status",
            col_enum("notification_status"),
            server_default="queued",
            nullable=False,
        ),
        sa.Column(
            "related_incident_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("incidents.id"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_notifications_status", "notifications", ["status"])
    op.create_index("ix_notifications_related_incident_id", "notifications", ["related_incident_id"])

    op.create_table(
        "trusted_contacts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "incident_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("incidents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("contact", sa.String(255), nullable=False),
        sa.Column("notified_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_trusted_contacts_incident_id", "trusted_contacts", ["incident_id"])

    op.create_table(
        "classification_queue",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "incident_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("incidents.id"),
            nullable=False,
        ),
        sa.Column(
            "status",
            col_enum("queue_status"),
            server_default="pending",
            nullable=False,
        ),
        sa.Column("attempts", sa.SmallInteger(), server_default="0", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_classification_queue_incident_id", "classification_queue", ["incident_id"])
    op.create_index("ix_classification_queue_status", "classification_queue", ["status"])

    op.create_table(
        "incident_idempotency_keys",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("idempotency_key", sa.String(128), nullable=False),
        sa.Column(
            "incident_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("incidents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_incident_idempotency_keys_key",
        "incident_idempotency_keys",
        ["idempotency_key"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_table("incident_idempotency_keys")
    op.drop_table("classification_queue")
    op.drop_table("trusted_contacts")
    op.drop_table("notifications")
    op.drop_table("alerts")
    op.execute("DROP INDEX IF EXISTS uq_assignments_resource_active")
    op.drop_table("assignments")
    op.execute("DROP INDEX IF EXISTS ix_resources_location_gist")
    op.drop_table("resources")
    op.drop_table("incident_media")
    op.execute("DROP INDEX IF EXISTS ix_incidents_location_gist")
    op.drop_table("incidents")
