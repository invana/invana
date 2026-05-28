"""Add graph_models.origin (RFC-021 — system vs authored provenance).

``origin`` distinguishes the read-only, system-managed **global** model
(``introspected`` — regenerated from the physical DB) from hand-authored
(``studio``) and YAML-managed (``yaml``) models. Defaulted to ``studio`` so the
add is non-breaking on existing rows.

Revision ID: 000000000012
Revises: 000000000011
Create Date: 2026-05-28
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000012"
down_revision: str | Sequence[str] | None = "000000000011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_ORIGIN_ENUM = "model_origin_enum"
_ORIGIN_VALUES = ("studio", "yaml", "introspected")


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
    _create_pg_enum_if_absent(_ORIGIN_ENUM, _ORIGIN_VALUES)
    op.add_column(
        "graph_models",
        sa.Column(
            "origin",
            sa.Enum(*_ORIGIN_VALUES, name=_ORIGIN_ENUM, create_type=False),
            nullable=False,
            server_default="studio",
        ),
    )


def downgrade() -> None:
    op.drop_column("graph_models", "origin")
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        bind.exec_driver_sql(f"DROP TYPE IF EXISTS {_ORIGIN_ENUM};")
