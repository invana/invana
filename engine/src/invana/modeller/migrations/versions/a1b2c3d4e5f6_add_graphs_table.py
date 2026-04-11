"""add graphs table

Revision ID: a1b2c3d4e5f6
Revises: 6426041eefc5
Create Date: 2026-04-14 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | Sequence[str] | None = "6426041eefc5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema — add graphs table."""
    op.create_table(
        "graphs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("uri", sa.String(length=2048), nullable=False),
        sa.Column("connector_class", sa.String(length=512), nullable=False),
        sa.Column("auth_encrypted", sa.LargeBinary(), nullable=True),
        sa.Column("read_only", sa.Boolean(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("CONNECTING", "ACTIVE", "ERROR", "INACTIVE", name="graph_status_enum"),
            nullable=False,
        ),
        sa.Column("last_health_check_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column(
            "schema_id",
            sa.String(length=36),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["schema_id"], ["graph_schemas.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("schema_id", name="uq_graph_schema_id"),
    )


def downgrade() -> None:
    """Downgrade schema — remove graphs table."""
    op.drop_table("graphs")
    op.execute("DROP TYPE IF EXISTS graph_status_enum")
