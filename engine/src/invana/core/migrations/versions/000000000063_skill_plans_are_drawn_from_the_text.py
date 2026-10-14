"""A skill version records the digest of the text its plan was drawn from.

``skill_versions.drawn_digest`` is the sha256 of the description, content and
when-to-use a draw read. Publish refuses a draft whose text no longer matches
it, so a published plan is always the one drawn from the published words.
Existing rows stay null: a published version is immutable, and a draft opened
over one is stamped from its text when it opens.

Revision ID: 000000000063
Revises: 000000000062
Create Date: 2026-10-12
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000063"
down_revision: str | Sequence[str] | None = "000000000062"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("skill_versions") as batch:
        batch.add_column(sa.Column("drawn_digest", sa.String(64), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("skill_versions") as batch:
        batch.drop_column("drawn_digest")
