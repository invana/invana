"""A skill uses a plan (a-skill-uses-a-plan.md § 3).

Two columns, and between them they hold one act: **a plan inlined another
plan's rows, and tuned the arguments that plan declares.**

``task_plans.uses`` is what the composition *spent* — ``[{"key", "version",
"args"}]`` — so *what will this plan do for me* is answerable without opening
the library ([LB19](docs/for-developers/modules/workflows/features/the-library.md)).
It is not a corner of ``args_schema``, which is what a plan **offers**; one
column for both would make a plan that declares an argument and a plan that
tunes one the same shape.

``tasks.source_plan_key`` is what each copied row *came from* — ``nl-single@1``
— so the Flow tab can group five rows under the plan they arrived with, and a
re-inline knows exactly which rows it replaces
([SK33](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
``NULL`` is a row somebody wrote, which is every row that exists today.

Neither is a **link**. The rows are a copy, taken when somebody composed them
([SK32](docs/for-developers/modules/skills/features/authoring-a-skill.md)), so
nothing here points at a library plan that could later move underneath it.

Revision ID: 000000000052
Revises: 000000000051
Create Date: 2026-09-20
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000052"
down_revision: str | Sequence[str] | None = "000000000051"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("task_plans") as batch:
        batch.add_column(sa.Column("uses", sa.JSON(), nullable=False, server_default="[]"))

    with op.batch_alter_table("tasks") as batch:
        batch.add_column(sa.Column("source_plan_key", sa.String(80), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("tasks") as batch:
        batch.drop_column("source_plan_key")
    with op.batch_alter_table("task_plans") as batch:
        batch.drop_column("uses")
