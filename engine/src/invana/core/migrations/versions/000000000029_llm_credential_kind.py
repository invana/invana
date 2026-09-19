"""Add ``credential_kind`` to ``llm_providers`` (docs/for-developers/modules/agents/features/providers-and-models.md).

Disambiguates ``api_key_encrypted`` for ``claude_agent_sdk`` rows: a Claude API
key vs. a ``claude setup-token`` subscription token. Nullable, no backfill —
NULL means "api_key" semantics for every existing row (the only shape
docs/for-developers/modules/agents/features/providers-and-models.md describes
originally had) and is simply unused for every non-``claude_agent_sdk`` kind.

Revision ID: 000000000029
Revises: 000000000028
Create Date: 2026-09-03
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision: str = "000000000029"
down_revision: str | Sequence[str] | None = "000000000028"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_ENUM_NAME = "llm_credential_kind"
_ENUM_VALUES = ("api_key", "oauth_token")


def _credential_kind_enum() -> sa.Enum:
    return pg.ENUM(*_ENUM_VALUES, name=_ENUM_NAME, create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        bind.exec_driver_sql(
            f"DO $$ BEGIN CREATE TYPE {_ENUM_NAME} AS ENUM "
            f"({', '.join(repr(v) for v in _ENUM_VALUES)}); "
            f"EXCEPTION WHEN duplicate_object THEN null; END $$;",
        )
        op.add_column("llm_providers", sa.Column("credential_kind", _credential_kind_enum(), nullable=True))
    else:
        op.add_column("llm_providers", sa.Column("credential_kind", sa.String(length=32), nullable=True))


def downgrade() -> None:
    op.drop_column("llm_providers", "credential_kind")
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        bind.exec_driver_sql(f"DROP TYPE IF EXISTS {_ENUM_NAME};")
