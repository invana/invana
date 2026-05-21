"""Add events table for domain audit log (RFC-018).

Append-only, FKs ON DELETE SET NULL so the audit trail outlives the entities
it describes. Indexes per RFC § Schema. Postgres-only trigger emits
``pg_notify('events', ...)`` on each INSERT so the SSE LISTEN daemon can
fan-out live events to subscribed Studio clients without polling.

Revision ID: 00000000000d
Revises: 00000000000c
Create Date: 2026-05-22
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision: str = "00000000000d"
down_revision: str | Sequence[str] | None = "00000000000c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_ACTOR_TYPE_ENUM = "event_actor_type"
_ACTOR_TYPE_VALUES = ("user", "system", "anonymous")


def _actor_type_enum() -> sa.Enum:
    return pg.ENUM(*_ACTOR_TYPE_VALUES, name=_ACTOR_TYPE_ENUM, create_type=False)


def _create_pg_enum_if_absent(name: str, values: tuple[str, ...]) -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    bind.exec_driver_sql(
        f"DO $$ BEGIN CREATE TYPE {name} AS ENUM "
        f"({', '.join(repr(v) for v in values)}); "
        f"EXCEPTION WHEN duplicate_object THEN null; END $$;",
    )


# pg_notify payload is capped at 8000 bytes per notify. We send a compact
# snapshot of the row (no `details` payload — SSE handlers re-fetch by id if
# they need the full payload, but in practice the row is small enough to
# include details too). Keeping it lean here keeps us well under the cap.
_TRIGGER_FN = """
CREATE OR REPLACE FUNCTION events_notify() RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify(
        'events',
        json_build_object(
            'id', NEW.id,
            'graph_id', NEW.graph_id,
            'created_at', to_char(NEW.created_at AT TIME ZONE 'UTC',
                                  'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

_TRIGGER = """
CREATE TRIGGER events_notify_insert
    AFTER INSERT ON events
    FOR EACH ROW
    EXECUTE FUNCTION events_notify();
"""


def upgrade() -> None:
    _create_pg_enum_if_absent(_ACTOR_TYPE_ENUM, _ACTOR_TYPE_VALUES)

    op.create_table(
        "events",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("graph_id", sa.String(length=36), nullable=True),
        sa.Column("actor_id", sa.String(length=36), nullable=True),
        sa.Column("actor_type", _actor_type_enum(), nullable=False),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("target_kind", sa.String(length=32), nullable=True),
        sa.Column("target_id", sa.String(length=36), nullable=True),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("trace_id", sa.String(length=32), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["graph_id"], ["graphs.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_events_graph_id_created_at", "events", ["graph_id", "created_at"])
    op.create_index("ix_events_created_at", "events", ["created_at"])
    op.create_index("ix_events_actor_id_created_at", "events", ["actor_id", "created_at"])
    op.create_index("ix_events_action_created_at", "events", ["action", "created_at"])

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        bind.exec_driver_sql(_TRIGGER_FN)
        bind.exec_driver_sql(_TRIGGER)


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        bind.exec_driver_sql("DROP TRIGGER IF EXISTS events_notify_insert ON events;")
        bind.exec_driver_sql("DROP FUNCTION IF EXISTS events_notify();")

    op.drop_index("ix_events_action_created_at", table_name="events")
    op.drop_index("ix_events_actor_id_created_at", table_name="events")
    op.drop_index("ix_events_created_at", table_name="events")
    op.drop_index("ix_events_graph_id_created_at", table_name="events")
    op.drop_table("events")

    if bind.dialect.name == "postgresql":
        bind.exec_driver_sql(f"DROP TYPE IF EXISTS {_ACTOR_TYPE_ENUM};")
