"""Canvases are boards (docs/for-developers/building-engine/boards-migration.md **B2**).

``canvases`` → ``boards`` and ``canvas_states`` → ``board_versions``, plus the
three columns that make one table serve a drawn board and a declared one.

The word had three meanings — the renderer, the drawing surface and the saved
row — so ``canvas.kind = dashboard`` read as a canvas that is not drawn on a
canvas. The record becomes a **board**; the renderer and the surface keep the
word.

``kind`` is one flat axis of nine values and is **not** split into
``canvas | dashboard`` plus a subject: two columns would make
``kind=canvas, subject=run`` representable and meaningless. Whether a board is
drawn or declared is ``renders``, a property of the kind in ``apps/boards/kinds.py``
and never a column (B3).

``session_id`` relaxes to **nullable**. It was ``NOT NULL UNIQUE``, which is the
reason only a ``data`` board could ever be saved — a model, plan or dashboard
board has no backing thread. It stays a CASCADE FK for the boards that have one:
provenance, not identity (B4).

``canvas_states.kind`` becomes ``board_versions.cause``. Two ``kind`` columns in
one module, meaning different things, is a bug waiting for a join (B7).

Existing rows are data, not a schema problem: every one of them is a data canvas,
so they land as ``kind='data'`` with a null ``subject_id``.

Revision ID: 000000000043
Revises: 000000000042
Create Date: 2026-09-19
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000043"
down_revision: str | Sequence[str] | None = "000000000042"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── 1 · the tables take their new names ──────────────────────────────────
    op.rename_table("canvases", "boards")
    op.rename_table("canvas_states", "board_versions")

    # ── 2 · boards: the identity columns ─────────────────────────────────────
    # server_default on `kind` so the existing rows land as data canvases, then
    # dropped — a default would let a later insert skip the one column that says
    # what a board is.
    op.add_column("boards", sa.Column("kind", sa.String(32), nullable=False, server_default="data"))
    op.alter_column("boards", "kind", server_default=None)
    op.add_column("boards", sa.Column("subject_id", sa.String(64), nullable=True))

    # Provenance, not identity (B4).
    op.alter_column("boards", "session_id", existing_type=sa.String(36), nullable=True)

    op.create_unique_constraint("uq_boards_graph_kind_subject", "boards", ["graph_id", "kind", "subject_id"])
    op.create_index("ix_boards_graph_kind", "boards", ["graph_id", "kind"])

    # ── 3 · board_versions: kind is the board's word now ─────────────────────
    op.alter_column("board_versions", "canvas_id", new_column_name="board_id", existing_type=sa.String(36))
    op.alter_column("board_versions", "kind", new_column_name="cause", existing_type=sa.String(16))
    op.create_index("ix_board_versions_board_created", "board_versions", ["board_id", "created_at"])

    # ── 4 · the names the objects are known by ───────────────────────────────
    # A rename_table carries its indexes and constraints along under their old
    # names, so a migrated database would disagree with the models about what
    # every one of them is called. Renaming them here is what keeps
    # `tests/golden/schema.models.sql` a description of a real database.
    for old, new in _RENAMES:
        op.execute(f'ALTER INDEX IF EXISTS "{old}" RENAME TO "{new}"')
    op.execute("ALTER TABLE boards RENAME CONSTRAINT uq_canvases_session_id TO uq_boards_session_id")
    for table, old, new in _FK_RENAMES:
        op.execute(f'ALTER TABLE {table} RENAME CONSTRAINT "{old}" TO "{new}"')


#: ``(old, new)`` for every index and primary key carried over by the renames.
_RENAMES: tuple[tuple[str, str], ...] = (
    ("canvases_pkey", "boards_pkey"),
    ("ix_canvases_graph_id", "ix_boards_graph_id"),
    ("ix_canvases_created_by_id", "ix_boards_created_by_id"),
    ("canvas_states_pkey", "board_versions_pkey"),
    ("ix_canvas_states_canvas_id", "ix_board_versions_board_id"),
    ("ix_canvas_states_graph_id", "ix_board_versions_graph_id"),
    ("ix_canvas_states_created_by_id", "ix_board_versions_created_by_id"),
)

#: ``(table, old, new)`` for the foreign keys, which carry the old table's name.
_FK_RENAMES: tuple[tuple[str, str, str], ...] = (
    ("boards", "canvases_session_id_fkey", "boards_session_id_fkey"),
    ("boards", "canvases_graph_id_fkey", "boards_graph_id_fkey"),
    ("boards", "canvases_created_by_id_fkey", "boards_created_by_id_fkey"),
    ("board_versions", "canvas_states_canvas_id_fkey", "board_versions_board_id_fkey"),
    ("board_versions", "canvas_states_graph_id_fkey", "board_versions_graph_id_fkey"),
    ("board_versions", "canvas_states_created_by_id_fkey", "board_versions_created_by_id_fkey"),
    ("board_versions", "canvas_states_message_id_fkey", "board_versions_message_id_fkey"),
)


def downgrade() -> None:
    for table, old, new in _FK_RENAMES:
        op.execute(f'ALTER TABLE {table} RENAME CONSTRAINT "{new}" TO "{old}"')
    op.execute("ALTER TABLE boards RENAME CONSTRAINT uq_boards_session_id TO uq_canvases_session_id")
    for old, new in _RENAMES:
        op.execute(f'ALTER INDEX IF EXISTS "{new}" RENAME TO "{old}"')

    op.drop_index("ix_board_versions_board_created", table_name="board_versions")
    op.alter_column("board_versions", "cause", new_column_name="kind", existing_type=sa.String(16))
    op.alter_column("board_versions", "board_id", new_column_name="canvas_id", existing_type=sa.String(36))

    op.drop_index("ix_boards_graph_kind", table_name="boards")
    op.drop_constraint("uq_boards_graph_kind_subject", "boards", type_="unique")

    # Every declared board goes with the column that made it possible — nothing
    # downstream of this revision can read one.
    op.execute("DELETE FROM boards WHERE session_id IS NULL")
    op.alter_column("boards", "session_id", existing_type=sa.String(36), nullable=False)

    op.drop_column("boards", "subject_id")
    op.drop_column("boards", "kind")

    op.rename_table("board_versions", "canvas_states")
    op.rename_table("boards", "canvases")
