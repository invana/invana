"""Make sessions surface-aware + bind to a model (RFC-031).

Adds ``sessions.surface`` (``explorer`` | ``modeller``, default ``explorer`` so
existing rows + the create path keep working) and ``sessions.model_id`` (nullable
FK to ``graph_models``, ``ON DELETE SET NULL``) — a modeller session authors one
model's draft. No backfill needed: existing sessions are Explorer with a null
model binding.

Revision ID: 000000000021
Revises: 000000000020
Create Date: 2026-06-25
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision: str = "000000000021"
down_revision: str | Sequence[str] | None = "000000000020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_SURFACE_ENUM = "session_surface"
_SURFACE_VALUES = ("explorer", "modeller")


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
    _create_pg_enum_if_absent(_SURFACE_ENUM, _SURFACE_VALUES)

    # server_default backfills existing rows; the ORM supplies the default on
    # insert, so drop it once the column is populated.
    op.add_column(
        "sessions",
        sa.Column(
            "surface",
            pg.ENUM(*_SURFACE_VALUES, name=_SURFACE_ENUM, create_type=False),
            nullable=False,
            server_default="explorer",
        ),
    )
    op.alter_column("sessions", "surface", server_default=None)

    op.add_column("sessions", sa.Column("model_id", sa.String(length=36), nullable=True))
    op.create_foreign_key(
        "fk_sessions_model_id",
        "sessions",
        "graph_models",
        ["model_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_sessions_model_id", "sessions", ["model_id"])
    op.create_index(
        "ix_sessions_graph_user_surface",
        "sessions",
        ["graph_id", "created_by_id", "surface"],
    )


def downgrade() -> None:
    op.drop_index("ix_sessions_graph_user_surface", table_name="sessions")
    op.drop_index("ix_sessions_model_id", table_name="sessions")
    op.drop_constraint("fk_sessions_model_id", "sessions", type_="foreignkey")
    op.drop_column("sessions", "model_id")
    op.drop_column("sessions", "surface")

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        bind.exec_driver_sql(f"DROP TYPE IF EXISTS {_SURFACE_ENUM};")
