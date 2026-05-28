"""Drop graph_models.persona + is_default (RFC-021).

Both are removed from `GraphModel`: models are distinguished by name + origin
(studio/yaml/introspected), not a persona role, and there is no "default" model
concept anymore.

Revision ID: 000000000013
Revises: 000000000012
Create Date: 2026-05-28
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000013"
down_revision: str | Sequence[str] | None = "000000000012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_PERSONA_ENUM = "model_persona_enum"
_PERSONA_VALUES = ("architecture", "code", "test", "business", "domain", "custom")


def upgrade() -> None:
    op.drop_column("graph_models", "persona")
    op.drop_column("graph_models", "is_default")
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        bind.exec_driver_sql(f"DROP TYPE IF EXISTS {_PERSONA_ENUM};")


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        bind.exec_driver_sql(
            f"DO $$ BEGIN CREATE TYPE {_PERSONA_ENUM} AS ENUM "
            f"({', '.join(repr(v) for v in _PERSONA_VALUES)}); "
            f"EXCEPTION WHEN duplicate_object THEN null; END $$;",
        )
    op.add_column(
        "graph_models",
        sa.Column(
            "persona",
            sa.Enum(*_PERSONA_VALUES, name=_PERSONA_ENUM, create_type=False),
            nullable=False,
            server_default="custom",
        ),
    )
    op.add_column(
        "graph_models",
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
