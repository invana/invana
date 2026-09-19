"""A step records the version it was offered (skills-pass.md **K2** · SK3 · SK19).

``task_runs.skills_offered`` and ``.skills_applied`` held **bare skill ids**, so
a count spanning a rewrite was a claim about two different texts wearing one
name. From here they hold ``skill_version_id``, which is what the writers in
``runtime/catalogue/contract.py`` produce, and what
[US3](docs/for-developers/modules/skills/features/usage.md) needs in order to say
*offered 40, applied 31* about **v3** and start v4 at zero.

Every historical entry is rewritten to name the v1 minted in ``44`` (SK19), so
one id shape means one thing everywhere and no reader carries a *before
versions* branch.

**An id that resolves to nothing is left as it is.** A skill hard-deleted before
this ran has no version to point at, and the row is already a dangling reference
— every reader drops or falls back on it today. Inventing a version for it would
be worse than leaving the record honest about what it lost.

The columns are ``json`` rather than ``jsonb``, so the rewrite goes through
``json_array_elements_text`` and rebuilds the array with ``json_agg``. An empty
array aggregates to ``NULL``, which is what the ``COALESCE`` guards — the
columns are ``NOT NULL``.

Revision ID: 000000000045
Revises: 000000000044
Create Date: 2026-09-19
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "000000000045"
down_revision: str | Sequence[str] | None = "000000000044"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

#: ``skills_offered`` and ``skills_applied`` are rewritten identically — one is
#: what assembly put in the prompt, the other what the model said it used, and
#: both name the same thing.
_COLUMNS = ("skills_offered", "skills_applied")


def _rewrite(column: str, *, frm: str, to: str) -> str:
    """Map every element of the array through ``skill_versions``, in one direction."""
    return f"""
        UPDATE task_runs t
        SET {column} = COALESCE((
            SELECT json_agg(COALESCE(v.{to}, e.value) ORDER BY e.ordinality)
            FROM json_array_elements_text(t.{column}) WITH ORDINALITY AS e(value, ordinality)
            LEFT JOIN skill_versions v ON v.{frm} = e.value AND v.version = 1
        ), '[]'::json)
        WHERE json_array_length(t.{column}) > 0
    """


def upgrade() -> None:
    for column in _COLUMNS:
        op.execute(_rewrite(column, frm="skill_id", to="id"))


def downgrade() -> None:
    # Back to bare skill ids. A version above 1 maps back to its skill just as
    # v1 does, so nothing published after this revision is stranded — what is
    # lost is *which* version, which is the whole point of going forward.
    for column in _COLUMNS:
        op.execute(
            f"""
            UPDATE task_runs t
            SET {column} = COALESCE((
                SELECT json_agg(COALESCE(v.skill_id, e.value) ORDER BY e.ordinality)
                FROM json_array_elements_text(t.{column}) WITH ORDINALITY AS e(value, ordinality)
                LEFT JOIN skill_versions v ON v.id = e.value
            ), '[]'::json)
            WHERE json_array_length(t.{column}) > 0
            """
        )
