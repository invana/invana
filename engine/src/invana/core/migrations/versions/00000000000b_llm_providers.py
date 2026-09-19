"""Add llm_providers table (MVP § 2.6).

Graph-scoped LLM bindings: provider, model_id, Fernet-encrypted api_key,
optional base_url, guardrails, is_default. At most one row per Graph may have
``is_default = true`` (partial unique index).

Revision ID: 00000000000b
Revises: 00000000000a
Create Date: 2026-05-21
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision: str = "00000000000b"
down_revision: str | Sequence[str] | None = "00000000000a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_LLM_KIND_ENUM = "llm_provider_kind"
_LLM_KIND_VALUES = ("anthropic", "openai", "google", "azure", "ollama", "local")


def _llm_kind_enum() -> sa.Enum:
    return pg.ENUM(*_LLM_KIND_VALUES, name=_LLM_KIND_ENUM, create_type=False)


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
    _create_pg_enum_if_absent(_LLM_KIND_ENUM, _LLM_KIND_VALUES)

    op.create_table(
        "llm_providers",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("graph_id", sa.String(length=36), nullable=False),
        sa.Column("provider", _llm_kind_enum(), nullable=False),
        sa.Column("model_id", sa.String(length=255), nullable=False),
        sa.Column("api_key_encrypted", sa.LargeBinary(), nullable=True),
        sa.Column("base_url", sa.String(length=2048), nullable=True),
        sa.Column("guardrails", sa.JSON(), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["graph_id"], ["graphs.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_llm_providers_graph_id", "llm_providers", ["graph_id"])
    # At most one default per graph. Partial unique works on both Postgres + SQLite.
    op.create_index(
        "uq_llm_providers_default_per_graph",
        "llm_providers",
        ["graph_id"],
        unique=True,
        postgresql_where=sa.text("is_default = true"),
        sqlite_where=sa.text("is_default = 1"),
    )


def downgrade() -> None:
    op.drop_index("uq_llm_providers_default_per_graph", table_name="llm_providers")
    op.drop_index("ix_llm_providers_graph_id", table_name="llm_providers")
    op.drop_table("llm_providers")
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        bind.exec_driver_sql(f"DROP TYPE IF EXISTS {_LLM_KIND_ENUM};")
