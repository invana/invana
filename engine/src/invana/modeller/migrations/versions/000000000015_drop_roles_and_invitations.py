"""Drop graph roles + invitations (RFC-023).

Membership is flattened to binary access: ``graph_members`` loses its ``role``
column, the ``graph_role`` enum type is dropped, and the ``invitations`` table
(and its indexes) are removed entirely. ``GraphMember`` survives as the
user↔graph access join; the role tiers and the whole invitation flow are gone.

Revision ID: 000000000015
Revises: 000000000014
Create Date: 2026-06-10
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision: str = "000000000015"
down_revision: str | Sequence[str] | None = "000000000014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_GRAPH_ROLE_ENUM = "graph_role"
_GRAPH_ROLE_VALUES = ("developer", "analyst", "admin")


def _graph_role_enum() -> sa.Enum:
    # Mirror the initial migration: create_type=False so add_column never
    # re-emits CREATE TYPE (the DO-block below owns type creation on Postgres).
    return pg.ENUM(*_GRAPH_ROLE_VALUES, name=_GRAPH_ROLE_ENUM, create_type=False)


def upgrade() -> None:
    # Invitations table first (it also referenced the graph_role enum).
    op.drop_index("ix_invitations_email", table_name="invitations")
    op.drop_index("ix_invitations_token_hash", table_name="invitations")
    op.drop_table("invitations")

    # graph_members loses its role dimension.
    op.drop_column("graph_members", "role")

    # The enum type is now unreferenced — drop it (Postgres only; SQLite has no
    # standalone enum types).
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        bind.exec_driver_sql(f"DROP TYPE IF EXISTS {_GRAPH_ROLE_ENUM};")


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        bind.exec_driver_sql(
            f"DO $$ BEGIN CREATE TYPE {_GRAPH_ROLE_ENUM} AS ENUM "
            f"({', '.join(repr(v) for v in _GRAPH_ROLE_VALUES)}); "
            f"EXCEPTION WHEN duplicate_object THEN null; END $$;",
        )

    # Re-add with a server_default so any existing rows satisfy NOT NULL; the
    # ORM never relied on the default (it always set role explicitly).
    op.add_column(
        "graph_members",
        sa.Column("role", _graph_role_enum(), nullable=False, server_default="admin"),
    )

    op.create_table(
        "invitations",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("graph_id", sa.String(length=36), nullable=False),
        sa.Column("role", _graph_role_enum(), nullable=False),
        sa.Column("invited_by_id", sa.String(length=36), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["graph_id"], ["graphs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["invited_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("token_hash", name="uq_invitations_token_hash"),
    )
    op.create_index("ix_invitations_token_hash", "invitations", ["token_hash"], unique=True)
    op.create_index("ix_invitations_email", "invitations", ["email"])
