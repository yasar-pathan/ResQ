"""Phase 7–8: field-team operator link on resources and assignees on assignments.

Revision ID: 004_ops
Revises: 003_core
Create Date: 2026-03-19

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "004_ops"
down_revision: Union[str, None] = "003_core"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "resources",
        sa.Column("operator_user_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_resources_operator_user_id",
        "resources",
        "users",
        ["operator_user_id"],
        ["id"],
    )
    op.create_index("ix_resources_operator_user_id", "resources", ["operator_user_id"])

    op.add_column(
        "assignments",
        sa.Column("assignee_user_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_assignments_assignee_user_id",
        "assignments",
        "users",
        ["assignee_user_id"],
        ["id"],
    )
    op.create_index("ix_assignments_assignee_user_id", "assignments", ["assignee_user_id"])


def downgrade() -> None:
    op.drop_index("ix_assignments_assignee_user_id", table_name="assignments")
    op.drop_constraint("fk_assignments_assignee_user_id", "assignments", type_="foreignkey")
    op.drop_column("assignments", "assignee_user_id")
    op.drop_index("ix_resources_operator_user_id", table_name="resources")
    op.drop_constraint("fk_resources_operator_user_id", "resources", type_="foreignkey")
    op.drop_column("resources", "operator_user_id")
