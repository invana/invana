"""An agent keeps one draft of its instructions.

``agents.instructions_draft`` is the unpublished text; null is no draft open.
Publishing moves it into ``instructions`` as an ordinary ``agent.update``.

Revision ID: 000000000064
Revises: 000000000063
Create Date: 2026-10-12
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000064"
down_revision: str | Sequence[str] | None = "000000000063"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("agents") as batch:
        batch.add_column(sa.Column("instructions_draft", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("agents") as batch:
        batch.drop_column("instructions_draft")
