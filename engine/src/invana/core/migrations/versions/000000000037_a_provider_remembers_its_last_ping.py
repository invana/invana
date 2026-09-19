"""A provider remembers its last ping (docs/for-developers/modules/platform/features/setup.md).

Saving a provider stores it; the ping proves it
(``providers-and-models.md`` C3) — and nothing kept the proof, so the result
lived in one toast and an event row. Setup's **Answering** gate waits on a
passing ping rather than on the row existing, and a failed one is what the
``broken`` state on the step reads, in the provider's own words.

``NULL`` in ``last_ping_ok`` means never pinged: neither passing nor broken.

Revision ID: 000000000037
Revises: 000000000036
Create Date: 2026-09-14
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000037"
down_revision: str | Sequence[str] | None = "000000000036"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("llm_providers", sa.Column("last_ping_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("llm_providers", sa.Column("last_ping_ok", sa.Boolean(), nullable=True))
    op.add_column("llm_providers", sa.Column("last_ping_error", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("llm_providers", "last_ping_error")
    op.drop_column("llm_providers", "last_ping_ok")
    op.drop_column("llm_providers", "last_ping_at")
