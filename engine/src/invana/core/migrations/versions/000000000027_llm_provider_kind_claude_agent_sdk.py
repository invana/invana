"""Add ``claude_agent_sdk`` to the ``llm_provider_kind`` enum
(docs/for-developers/modules/agents/features/providers-and-models.md).

Postgres: ``ALTER TYPE … ADD VALUE`` cannot run inside a transaction block, so
it goes through Alembic's autocommit block. SQLite: the column is a plain
VARCHAR there (the enum was created with ``create_type=False`` and no CHECK
constraint), so nothing to do. Postgres cannot drop an enum value, so the
downgrade is a deliberate no-op — rows of the new kind would have to be deleted
by hand first anyway.

Revision ID: 000000000027
Revises: 000000000026
Create Date: 2026-09-03
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "000000000027"
down_revision: str | Sequence[str] | None = "000000000026"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_LLM_KIND_ENUM = "llm_provider_kind"
_NEW_VALUE = "claude_agent_sdk"


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    with op.get_context().autocommit_block():
        op.execute(f"ALTER TYPE {_LLM_KIND_ENUM} ADD VALUE IF NOT EXISTS '{_NEW_VALUE}'")


def downgrade() -> None:
    # Postgres has no DROP VALUE for enums; leaving the value in place is harmless.
    pass
