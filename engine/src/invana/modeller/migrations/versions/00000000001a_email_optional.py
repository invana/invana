"""Make users.email optional (nullable).

Email becomes an optional login identity — accounts can be provisioned without
one (e.g. the default `invana init` superuser does carry an email, but operator
`users create` and future flows may not). The UNIQUE index is retained;
Postgres treats NULLs as distinct, so multiple email-less accounts are allowed.

Revision ID: 00000000001a
Revises: 000000000019
Create Date: 2026-06-17
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "00000000001a"
down_revision: str | Sequence[str] | None = "000000000019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "users",
        "email",
        existing_type=sa.String(length=320),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "users",
        "email",
        existing_type=sa.String(length=320),
        nullable=False,
    )
