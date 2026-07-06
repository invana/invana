"""Record canvas operations as session turns (RFC-046).

Adds ``session_messages.operation`` (nullable ``"expand"`` | ``"load"``) so a
node-expand or a "Load to canvas" click can be logged as a message pair
alongside NL/QL composer queries. Null on existing rows — they're composer
turns — so no backfill is needed.

Revision ID: 000000000025
Revises: 000000000024
Create Date: 2026-07-07
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000025"
down_revision: str | Sequence[str] | None = "000000000024"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("session_messages", sa.Column("operation", sa.String(length=16), nullable=True))


def downgrade() -> None:
    op.drop_column("session_messages", "operation")
