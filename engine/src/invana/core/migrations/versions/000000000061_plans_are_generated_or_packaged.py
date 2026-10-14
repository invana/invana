"""Plans are generated or packaged; a rollback names the version it restored.

A plan that ships with Invana or a plugin pack is ``origin = packaged``. Every
row seeded before reads ``builtin``, which named the same thing, so it is
renamed in place and the column's server default follows.

``skill_versions.restored_from_version`` is the earlier version a rollback
copied — null for a version somebody wrote.

Revision ID: 000000000061
Revises: 000000000060
Create Date: 2026-10-12
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000061"
down_revision: str | Sequence[str] | None = "000000000060"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("UPDATE task_plans SET origin = 'packaged' WHERE origin = 'builtin'")
    with op.batch_alter_table("task_plans") as batch:
        batch.alter_column("origin", existing_type=sa.String(16), server_default="packaged")
    with op.batch_alter_table("skill_versions") as batch:
        batch.add_column(sa.Column("restored_from_version", sa.Integer(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("skill_versions") as batch:
        batch.drop_column("restored_from_version")
    with op.batch_alter_table("task_plans") as batch:
        batch.alter_column("origin", existing_type=sa.String(16), server_default="builtin")
    op.execute("UPDATE task_plans SET origin = 'builtin' WHERE origin = 'packaged'")
