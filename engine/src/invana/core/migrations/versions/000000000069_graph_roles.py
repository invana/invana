"""Graph roles on membership; the guardrail permission folds into them.

``graph_members.roles`` is the set of Graph roles a member holds
(docs/for-developers/modules/identity-and-access/features/roles.md): a JSON
list of ``viewer · contributor · builder · modeller · owner``, never empty.

Everyone keeps what they had. Membership used to be full access, so the Graph's
creator becomes ``owner`` and every other member ``contributor · builder ·
modeller``. ``can_edit_guardrails`` is dropped: editing a guardrail is the
``modeller`` role now, which ``owner`` implies.

Revision ID: 000000000069
Revises: 000000000068
Create Date: 2026-10-12
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000069"
down_revision: str | Sequence[str] | None = "000000000068"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("graph_members") as batch:
        batch.add_column(sa.Column("roles", sa.JSON(), nullable=False, server_default='["viewer"]'))

    op.execute("""UPDATE graph_members SET roles = '["contributor", "builder", "modeller"]'""")
    op.execute(
        """
        UPDATE graph_members
           SET roles = '["owner"]'
         WHERE EXISTS (
               SELECT 1 FROM graphs
                WHERE graphs.id = graph_members.graph_id
                  AND graphs.created_by_id = graph_members.user_id
         )
        """
    )

    with op.batch_alter_table("graph_members") as batch:
        batch.drop_column("can_edit_guardrails")


def downgrade() -> None:
    with op.batch_alter_table("graph_members") as batch:
        batch.add_column(sa.Column("can_edit_guardrails", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.execute(
        """
        UPDATE graph_members
           SET can_edit_guardrails = true
         WHERE CAST(roles AS TEXT) LIKE '%owner%' OR CAST(roles AS TEXT) LIKE '%modeller%'
        """
    )
    with op.batch_alter_table("graph_members") as batch:
        batch.drop_column("roles")
