"""Add persona + Graph-ownership fields to graph_models (RFC-019).

Multi-model groundwork: a Graph owns many GraphModels (persona-scoped). Adds
``graph_id`` (owner FK), ``persona``, ``status`` (model lifecycle), ``is_default``,
and ``yaml_path`` (YAML-ownership indicator — replaces a separate ``source``).

``graph_id`` is nullable for now (transition off the legacy
``graph_connections.model_id`` 1:1 pointer); it is tightened to NOT NULL once
creation paths populate it. All new columns are defaulted so the add is
non-breaking on existing rows.

Revision ID: 00000000000f
Revises: 00000000000e
Create Date: 2026-05-25
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "00000000000f"
down_revision: str | Sequence[str] | None = "00000000000e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_PERSONA_ENUM = "model_persona_enum"
_PERSONA_VALUES = ("architecture", "code", "test", "business", "domain", "custom")
_MODEL_STATUS_ENUM = "model_status_enum"
_MODEL_STATUS_VALUES = ("draft", "active", "archived")


def _create_pg_enum_if_absent(name: str, values: tuple[str, ...]) -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    bind.exec_driver_sql(
        f"DO $$ BEGIN CREATE TYPE {name} AS ENUM "
        f"({', '.join(repr(v) for v in values)}); "
        f"EXCEPTION WHEN duplicate_object THEN null; END $$;",
    )


def _persona_enum() -> sa.Enum:
    return sa.Enum(*_PERSONA_VALUES, name=_PERSONA_ENUM, create_type=False)


def _model_status_enum() -> sa.Enum:
    return sa.Enum(*_MODEL_STATUS_VALUES, name=_MODEL_STATUS_ENUM, create_type=False)


def upgrade() -> None:
    _create_pg_enum_if_absent(_PERSONA_ENUM, _PERSONA_VALUES)
    _create_pg_enum_if_absent(_MODEL_STATUS_ENUM, _MODEL_STATUS_VALUES)

    op.add_column("graph_models", sa.Column("graph_id", sa.String(length=36), nullable=True))
    op.add_column(
        "graph_models",
        sa.Column("persona", _persona_enum(), nullable=False, server_default="custom"),
    )
    op.add_column(
        "graph_models",
        sa.Column("status", _model_status_enum(), nullable=False, server_default="draft"),
    )
    op.add_column(
        "graph_models",
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("graph_models", sa.Column("yaml_path", sa.String(length=1024), nullable=True))
    op.create_index("ix_graph_models_graph_id", "graph_models", ["graph_id"])

    # SQLite can't ALTER ADD a named FK constraint; enforce it on Postgres only.
    # The ORM relationship + index carry the link in dev (SQLite).
    if op.get_bind().dialect.name == "postgresql":
        op.create_foreign_key(
            "fk_graph_models_graph_id",
            "graph_models",
            "graphs",
            ["graph_id"],
            ["id"],
            ondelete="CASCADE",
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.drop_constraint("fk_graph_models_graph_id", "graph_models", type_="foreignkey")
    op.drop_index("ix_graph_models_graph_id", table_name="graph_models")
    op.drop_column("graph_models", "yaml_path")
    op.drop_column("graph_models", "is_default")
    op.drop_column("graph_models", "status")
    op.drop_column("graph_models", "persona")
    op.drop_column("graph_models", "graph_id")
    if bind.dialect.name == "postgresql":
        bind.exec_driver_sql(f"DROP TYPE IF EXISTS {_PERSONA_ENUM};")
        bind.exec_driver_sql(f"DROP TYPE IF EXISTS {_MODEL_STATUS_ENUM};")
