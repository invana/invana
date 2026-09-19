"""A stitch stages on its own row (docs/for-developers/modules/connect-and-model/features/stitch-models.md ST21).

``model_links.status`` is ``staged`` or ``active``. Declaring writes a **staged**
row; a commit flips every staged row in the Graph to active in one action, and a
discard deletes them. The derived global model unions active rows only, so a
staged stitch changes no answer until somebody commits it.

The staged set lives on the server on purpose: it survives a reload and anyone
opening the Graph sees it, which is the property ``model-editor.md`` ME4 asks of
the model's own staged set. It is a *different mechanism* — the model's staged
set is the live diff between a draft and the version it replaces and records
nothing, and a stitch belongs to no version, so there is no draft to diff.

Every link that already exists is already in the union, so it backfills to
``active``. Nothing a person declared before this migration silently leaves the
global model.

Revision ID: 000000000032
Revises: 000000000031
Create Date: 2026-09-12
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000032"
down_revision: str | Sequence[str] | None = "000000000031"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# Adding an enum column to an existing table is not the same as creating a table
# with one: PostgreSQL auto-creates the type inside `create_table`, and does not
# inside `add_column`, so the type is created here by hand. `checkfirst` keeps it
# a no-op on a backend that has no enum types (SQLite) and on a re-run.
STATUS = sa.Enum("staged", "active", name="model_link_status_enum")


def upgrade() -> None:
    STATUS.create(op.get_bind(), checkfirst=True)
    # `server_default="active"` backfills every existing row: a link that was
    # already answering questions must keep answering them.
    with op.batch_alter_table("model_links") as batch:
        batch.add_column(
            sa.Column(
                "status",
                STATUS,
                nullable=False,
                server_default="active",
            )
        )


def downgrade() -> None:
    # Dropping the column makes every staged link live. That is the safe
    # direction: a stitch nobody committed reappearing in the union is visible
    # and removable, whereas dropping the rows would lose work.
    with op.batch_alter_table("model_links") as batch:
        batch.drop_column("status")
    STATUS.drop(op.get_bind(), checkfirst=True)
