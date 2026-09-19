"""A run names who ran it (docs/for-developers/modules/bring-data-in/spec.md BD10).

An audit journal that cannot say who ran what is a status page, so an import run
carries three more columns:

- ``actor_id``     — the user, when one is named (``--user``, or the API path).
- ``actor_label``  — what to show when there is no user row behind it: the OS
  user and host the CLI ran on.
- ``invocation``   — the command the run came from, so the journal can be read
  back as a list of things people did.
- ``kind``         — ``import`` for a validated load, ``bulk`` for ``invana
  loader``. The fast path writes no report and no provenance, and the journal
  has to say which kind of run a reader is looking at rather than letting the
  two read alike.

Revision ID: 000000000031
Revises: 000000000030
Create Date: 2026-09-12
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000031"
down_revision: str | Sequence[str] | None = "000000000030"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("import_jobs") as batch:
        batch.add_column(sa.Column("actor_id", sa.String(36), nullable=True))
        batch.add_column(sa.Column("actor_label", sa.String(255), nullable=True))
        batch.add_column(sa.Column("invocation", sa.Text(), nullable=True))
        batch.add_column(sa.Column("kind", sa.String(16), nullable=False, server_default="import"))


def downgrade() -> None:
    with op.batch_alter_table("import_jobs") as batch:
        batch.drop_column("kind")
        batch.drop_column("invocation")
        batch.drop_column("actor_label")
        batch.drop_column("actor_id")
