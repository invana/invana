"""Personal access tokens (docs/for-developers/modules/identity-and-access/features/personal-access-tokens.md).

A person automating against their own Graphs had two choices: put a password in a
cron file, or re-post `/auth/login` every fifteen minutes for an access token that
expires. Both are a password held by a script.

A **personal access token** is a long-lived credential that carries its owner's
identity and nothing else (PT1) — membership is still resolved per request, so
revoking someone's access to a Graph closes their token's way in at the same
moment. Only the sha256 hash is stored (PT2); the secret is returned once, at
creation, and cannot be read back.

Revocation is a stamp rather than a delete, so a call made with a revoked secret
is told it was revoked instead of that it never existed.

Revision ID: 000000000034
Revises: 000000000033
Create Date: 2026-09-14
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000034"
down_revision: str | Sequence[str] | None = "000000000033"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "personal_access_tokens",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        # Display tail only — never enough to reconstruct the secret.
        sa.Column("last_four", sa.String(4), nullable=False),
        # NULL = never expires (PT7).
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "name", name="uq_pat_user_name"),
    )
    op.create_index("ix_personal_access_tokens_user_id", "personal_access_tokens", ["user_id"])
    # Every authenticated request carrying a token is this lookup.
    op.create_index("ix_personal_access_tokens_token_hash", "personal_access_tokens", ["token_hash"], unique=True)


def downgrade() -> None:
    # Every minted token goes with the table — a secret cannot be re-issued, so
    # coming back down means every script holding one has to be handed a new one.
    op.drop_index("ix_personal_access_tokens_token_hash", table_name="personal_access_tokens")
    op.drop_index("ix_personal_access_tokens_user_id", table_name="personal_access_tokens")
    op.drop_table("personal_access_tokens")
