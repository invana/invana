"""Add query sessions tables (RFC-024).

A ``Session`` is a threaded conversation against a graph; ``session_messages``
are its ordered user/assistant turns. Both graph-scoped and private to the
creator — graph delete and user delete hard-CASCADE (RFC-024 Decision 11).
Only message metadata is stored, never result payloads.

Revision ID: 000000000016
Revises: 000000000015
Create Date: 2026-06-11
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision: str = "000000000016"
down_revision: str | Sequence[str] | None = "000000000015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_ROLE_ENUM = "session_message_role"
_ROLE_VALUES = ("user", "assistant")
_STATUS_ENUM = "session_message_status"
_STATUS_VALUES = ("running", "ok", "error")


def _create_pg_enum_if_absent(name: str, values: tuple[str, ...]) -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    bind.exec_driver_sql(
        f"DO $$ BEGIN CREATE TYPE {name} AS ENUM "
        f"({', '.join(repr(v) for v in values)}); "
        f"EXCEPTION WHEN duplicate_object THEN null; END $$;",
    )


def upgrade() -> None:
    _create_pg_enum_if_absent(_ROLE_ENUM, _ROLE_VALUES)
    _create_pg_enum_if_absent(_STATUS_ENUM, _STATUS_VALUES)

    op.create_table(
        "sessions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("graph_id", sa.String(length=36), nullable=False),
        sa.Column("created_by_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("message_count", sa.Integer(), nullable=False),
        sa.Column("node_count", sa.Integer(), nullable=False),
        sa.Column("edge_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["graph_id"], ["graphs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_sessions_graph_id", "sessions", ["graph_id"])
    op.create_index("ix_sessions_created_by_id", "sessions", ["created_by_id"])

    op.create_table(
        "session_messages",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("session_id", sa.String(length=36), nullable=False),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("role", pg.ENUM(*_ROLE_VALUES, name=_ROLE_ENUM, create_type=False), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "status",
            pg.ENUM(*_STATUS_VALUES, name=_STATUS_ENUM, create_type=False),
            nullable=True,
        ),
        sa.Column("via", sa.String(length=255), nullable=True),
        sa.Column("query_language", sa.String(length=32), nullable=True),
        sa.Column("source_query", sa.Text(), nullable=True),
        sa.Column("row_count", sa.Integer(), nullable=True),
        sa.Column("execution_time_ms", sa.Integer(), nullable=True),
        sa.Column("node_count", sa.Integer(), nullable=True),
        sa.Column("edge_count", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("session_id", "seq", name="uq_session_message_seq"),
    )
    op.create_index("ix_session_messages_session_id", "session_messages", ["session_id"])


def downgrade() -> None:
    op.drop_index("ix_session_messages_session_id", table_name="session_messages")
    op.drop_table("session_messages")
    op.drop_index("ix_sessions_created_by_id", table_name="sessions")
    op.drop_index("ix_sessions_graph_id", table_name="sessions")
    op.drop_table("sessions")

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        bind.exec_driver_sql(f"DROP TYPE IF EXISTS {_STATUS_ENUM};")
        bind.exec_driver_sql(f"DROP TYPE IF EXISTS {_ROLE_ENUM};")
