"""Portable model identity and declared links between models (S7).

Three shapes land together because they are one idea: a model is a **package**
that travels, and two packages meet only through something a person declared.

- ``graph_models.package_id`` — the portable identity. The name is local, so an
  upgrade resolves against this (share-a-model.md SM2).
- ``graph_models.import_source`` — ``file`` or ``starter`` when the model arrived
  from an artefact; NULL when it was authored here (starter-models.md SR1).
- ``graph_versions.content_hash`` — stamped when a version publishes, so the same
  content under another name is recognised as an upgrade rather than a copy.
- ``model_links`` — anchors and relationship links, both endpoints pointing at a
  published version (stitch-models.md ST1, ST7).

Existing rows get a generated ``package_id``: they were authored here, so their
identity starts now.

Revision ID: 00000000002d
Revises: 00000000002c
Create Date: 2026-09-09
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "00000000002d"
down_revision: str | Sequence[str] | None = "00000000002c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()

    with op.batch_alter_table("graph_models") as batch:
        batch.add_column(sa.Column("package_id", sa.String(64), nullable=True))
        batch.add_column(sa.Column("import_source", sa.String(32), nullable=True))

    # Backfill before the NOT NULL: every existing model is its own package.
    models = bind.execute(sa.text("SELECT id FROM graph_models")).fetchall()
    for (model_id,) in models:
        bind.execute(
            sa.text("UPDATE graph_models SET package_id = :pkg WHERE id = :id"),
            {"pkg": str(uuid.uuid4()), "id": model_id},
        )

    with op.batch_alter_table("graph_models") as batch:
        batch.alter_column("package_id", existing_type=sa.String(64), nullable=False)
        batch.create_index("ix_graph_models_package_id", ["package_id"])

    with op.batch_alter_table("graph_versions") as batch:
        batch.add_column(sa.Column("content_hash", sa.String(64), nullable=True))
        batch.create_index("ix_graph_versions_content_hash", ["content_hash"])

    op.create_table(
        "model_links",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("graph_id", sa.String(36), sa.ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.Enum("anchor", "relationship", name="model_link_kind_enum"), nullable=False),
        sa.Column(
            "source_version_id",
            sa.String(36),
            sa.ForeignKey("graph_versions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("source_type", sa.String(255), nullable=False),
        sa.Column(
            "target_version_id",
            sa.String(36),
            sa.ForeignKey("graph_versions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("target_type", sa.String(255), nullable=False),
        sa.Column("identity_property", sa.String(255), nullable=True),
        sa.Column(
            "identity_match",
            sa.Enum("exact", "case_insensitive", name="model_link_match_enum"),
            nullable=False,
            server_default="exact",
        ),
        sa.Column("edge_type", sa.String(255), nullable=True),
        sa.Column("dataset_id", sa.String(36), nullable=True),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "graph_id",
            "kind",
            "source_version_id",
            "source_type",
            "target_version_id",
            "target_type",
            "edge_type",
            name="uq_model_link",
        ),
    )
    op.create_index("ix_model_links_graph_id", "model_links", ["graph_id"])


def downgrade() -> None:
    op.drop_index("ix_model_links_graph_id", table_name="model_links")
    op.drop_table("model_links")

    with op.batch_alter_table("graph_versions") as batch:
        batch.drop_index("ix_graph_versions_content_hash")
        batch.drop_column("content_hash")

    with op.batch_alter_table("graph_models") as batch:
        batch.drop_index("ix_graph_models_package_id")
        batch.drop_column("import_source")
        batch.drop_column("package_id")

    sa.Enum(name="model_link_kind_enum").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="model_link_match_enum").drop(op.get_bind(), checkfirst=True)
