"""Add ``users.preferences`` JSON bag (RFC-044).

Backs per-user UI preferences — currently the studio theme selection under
``preferences.theme`` ({"theme", "mode", "accent"}), read/written via
``PATCH /auth/me`` so the choice follows the user across devices. ``server_default``
``'{}'`` backfills existing rows; the ORM supplies the default on insert.

Revision ID: 000000000022
Revises: 000000000021
Create Date: 2026-07-06
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000022"
down_revision: str | Sequence[str] | None = "000000000021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("preferences", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
    )
    # Existing rows are backfilled by the server_default above; drop it so the
    # ORM's `default=dict` owns new inserts (matches the surface/model_id pattern).
    op.alter_column("users", "preferences", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "preferences")
