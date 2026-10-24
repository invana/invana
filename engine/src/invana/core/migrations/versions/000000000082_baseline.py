"""The baseline — the whole schema an empty database needs, in one revision.

docs/for-developers/modules/platform/spec.md (PL11). ``000000000082_baseline.sql``
beside this file holds the DDL: the enum types, every table, its foreign keys,
its indexes, and the ``events`` insert trigger that feeds the live event stream.
Statements are separated by a ``--;`` line, because a function body carries
semicolons of its own.

It carries the id of the last revision it replaced, so a database that had
already reached that revision is at the baseline and is never rebuilt; the
revisions after it bring such a database to the same schema. Postgres only.

Revision ID: 000000000082
Revises:
Create Date: 2026-10-24
"""

from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path

from alembic import op

revision: str = "000000000082"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DDL = Path(__file__).with_suffix(".sql")


def statements() -> list[str]:
    """The baseline's statements, in the order they run."""
    return [s.strip() for s in DDL.read_text().split("\n--;\n") if s.strip()]


def upgrade() -> None:
    bind = op.get_bind()
    for statement in statements():
        bind.exec_driver_sql(statement)


def downgrade() -> None:
    raise NotImplementedError("the baseline is where the chain starts")
