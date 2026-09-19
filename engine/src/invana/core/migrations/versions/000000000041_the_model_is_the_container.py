"""The model is the container — `datasets` and `import_jobs` are dropped (§ 6.7).

Both were records of the loading machinery rather than of the product: one said
*this load happened*, the other said *these records arrived together*. The run
answers the first. The model answers the second, and always did — a dataset
bound to exactly one model, carried no shape of its own, and existed so the
importer had somewhere to hang a name and a path.

| What it held | Where it is now |
|---|---|
| ``datasets.model_id`` | the model **is** the container; the column was the relationship stated twice |
| ``datasets.name`` · ``storage_uri`` | a fact about one load → that run's ``params`` |
| ``datasets.record_counts`` | what ``write_graph`` and ``stitch`` already report |
| ``import_jobs`` | the run, which every load has been since M11a |

**BEFORE UPGRADING, RESTAMP EVERY GRAPH.** These two tables are the only mapping
from the old provenance stamps to the new ones — ``_inv_dataset_id`` →
``_inv_model_id`` and ``_inv_job_id`` → ``_inv_run_id``, and the *value* changes
with the name, because a job id is not a run id. ``invana records restamp
--graph <ref> --apply`` did that remap and is deleted with these tables, so an
element still carrying an old stamp when this runs is stranded permanently: no
later release can resolve it.

There is no way for a migration to check this — the stamps are in the graph
database, which Alembic cannot see. It is a release note, not a guard.

Revision ID: 000000000041
Revises: 000000000040
Create Date: 2026-09-17
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000041"
down_revision: str | Sequence[str] | None = "000000000040"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # `import_jobs` first: it points at `datasets`.
    op.drop_index("ix_import_jobs_dataset_id", table_name="import_jobs")
    op.drop_table("import_jobs")
    op.drop_table("datasets")


def downgrade() -> None:
    # The shapes come back; the rows do not, and neither does the mapping they
    # carried. A downgrade past this point leaves provenance resolvable only
    # forwards — which is the honest outcome, because the facts these tables
    # held now live on the runs and the models.
    op.create_table(
        "datasets",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("graph_id", sa.String(length=36), nullable=False),
        sa.Column("model_id", sa.String(length=36), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("storage_uri", sa.Text(), nullable=False),
        sa.Column("record_counts", sa.JSON(), nullable=False),
        sa.Column("created_by_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["graph_id"], ["graphs.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("graph_id", "name", name="uq_dataset_graph_name"),
    )
    op.create_table(
        "import_jobs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("dataset_id", sa.String(length=36), nullable=False),
        sa.Column("run_id", sa.String(length=36), nullable=True),
        sa.Column("model_version_id", sa.String(length=36), nullable=True),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("records_processed", sa.Integer(), nullable=False),
        sa.Column("error_count", sa.Integer(), nullable=False),
        sa.Column("report", sa.JSON(), nullable=False),
        sa.Column("logs", sa.JSON(), nullable=False),
        sa.Column("actor_id", sa.String(length=36), nullable=True),
        sa.Column("actor_label", sa.String(length=255), nullable=True),
        sa.Column("invocation", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_import_jobs_dataset_id", "import_jobs", ["dataset_id"])
