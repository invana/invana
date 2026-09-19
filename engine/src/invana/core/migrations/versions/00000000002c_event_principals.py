"""Principals and the causal trace on ``events`` (S12a, docs/for-developers/modules/work/spec.md).

``actor_type`` becomes ``actor_kind`` and grows two values (``agent``,
``external``); ``actor_id`` **loses its FK to users**, because a principal is a
polymorphic pair now (D5) and an agent id is not a user id. The rest is the
causal spine: who the actor acted for, what caused the row, and the three
scopes a reader filters by.

Renaming rather than adding: an event has exactly one actor, and two columns
meaning "who" is how a log stops being trustworthy.

Revision ID: 00000000002c
Revises: 00000000002b
Create Date: 2026-09-06
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "00000000002c"
down_revision: str | Sequence[str] | None = "00000000002b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_ENUM_NAME = "event_actor_type"
_NEW_VALUES = ("agent", "external")


def upgrade() -> None:
    bind = op.get_bind()

    if bind.dialect.name == "postgresql":
        # ALTER TYPE … ADD VALUE cannot run inside a transaction block on older
        # servers, and IF NOT EXISTS keeps a re-run harmless.
        for value in _NEW_VALUES:
            bind.exec_driver_sql(f"ALTER TYPE {_ENUM_NAME} ADD VALUE IF NOT EXISTS '{value}'")

    # SQLite rebuilds the table for a rename or a constraint drop; batch mode is
    # the only form that works on both backends.
    with op.batch_alter_table("events") as batch:
        batch.alter_column("actor_type", new_column_name="actor_kind")
        batch.add_column(sa.Column("on_behalf_of_user_id", sa.String(length=36), nullable=True))
        batch.add_column(sa.Column("parent_event_id", sa.String(length=36), nullable=True))
        batch.add_column(sa.Column("project_id", sa.String(length=36), nullable=True))
        batch.add_column(sa.Column("task_id", sa.String(length=36), nullable=True))
        batch.add_column(sa.Column("thinking_id", sa.String(length=36), nullable=True))
        batch.add_column(sa.Column("thinking_step_id", sa.String(length=36), nullable=True))
        batch.add_column(sa.Column("skill_ids", sa.JSON(), nullable=False, server_default="[]"))

    if bind.dialect.name == "postgresql":
        # Named by the audit-event migration (docs/for-developers/modules/operate/features/audit-and-activity.md);
        # dropped here because ``actor_id`` is
        # no longer always a user.
        bind.exec_driver_sql("ALTER TABLE events DROP CONSTRAINT IF EXISTS events_actor_id_fkey")

    op.create_index("ix_events_on_behalf_of_user_id", "events", ["on_behalf_of_user_id"])
    op.create_index("ix_events_task_id_created_at", "events", ["task_id", "created_at"])
    op.create_index("ix_events_thinking_id_created_at", "events", ["thinking_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_events_thinking_id_created_at", table_name="events")
    op.drop_index("ix_events_task_id_created_at", table_name="events")
    op.drop_index("ix_events_on_behalf_of_user_id", table_name="events")
    with op.batch_alter_table("events") as batch:
        batch.drop_column("skill_ids")
        batch.drop_column("thinking_step_id")
        batch.drop_column("thinking_id")
        batch.drop_column("task_id")
        batch.drop_column("project_id")
        batch.drop_column("parent_event_id")
        batch.drop_column("on_behalf_of_user_id")
        batch.alter_column("actor_kind", new_column_name="actor_type")
    # The two enum values stay: PostgreSQL cannot remove one, and an unused
    # value is harmless.
