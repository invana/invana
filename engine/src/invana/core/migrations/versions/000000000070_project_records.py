"""Project records — type, question and visibility on a project; branches,
findings, decisions, proposals and the report.

docs/for-developers/modules/work/features/branches-and-decisions.md ·
project-reports.md · private-projects.md. Every existing project keeps what it
had: type ``general``, visible to its Graph, and one open branch named for the
project, because every project starts with one.

Revision ID: 000000000070
Revises: 000000000069
Create Date: 2026-10-12
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op

revision: str = "000000000070"
down_revision: str | Sequence[str] | None = "000000000069"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _fk(table: str, ondelete: str):
    return sa.ForeignKey(f"{table}.id", ondelete=ondelete)


def upgrade() -> None:
    with op.batch_alter_table("projects") as batch:
        batch.add_column(sa.Column("type", sa.String(16), nullable=False, server_default="general"))
        batch.add_column(sa.Column("question", sa.Text(), nullable=False, server_default=""))
        batch.add_column(sa.Column("visibility", sa.String(16), nullable=False, server_default="graph"))

    op.create_table(
        "project_branches",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), _fk("projects", "CASCADE"), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("parent_id", sa.String(36), _fk("project_branches", "CASCADE"), nullable=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("merged_into_id", sa.String(36), _fk("project_branches", "SET NULL"), nullable=True),
        sa.Column("created_by_kind", sa.String(16), nullable=False),
        sa.Column("created_by_id", sa.String(36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("project_id", "number", name="uq_project_branch_number"),
    )
    op.create_index("ix_project_branches_project_id", "project_branches", ["project_id"])
    op.create_index("ix_project_branches_parent_id", "project_branches", ["parent_id"])

    op.create_table(
        "project_findings",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), _fk("projects", "CASCADE"), nullable=False),
        sa.Column("branch_id", sa.String(36), _fk("project_branches", "CASCADE"), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("statement", sa.Text(), nullable=False),
        sa.Column("stance", sa.String(16), nullable=False),
        sa.Column("cites", sa.JSON(), nullable=False),
        sa.Column("added_by_kind", sa.String(16), nullable=False),
        sa.Column("added_by_id", sa.String(36), nullable=True),
        sa.Column("reviewed_by_id", sa.String(36), _fk("users", "SET NULL"), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("project_id", "number", name="uq_project_finding_number"),
    )
    op.create_index("ix_project_findings_project_id", "project_findings", ["project_id"])
    op.create_index("ix_project_findings_branch_id", "project_findings", ["branch_id"])

    op.create_table(
        "branch_findings",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("branch_id", sa.String(36), _fk("project_branches", "CASCADE"), nullable=False),
        sa.Column("finding_id", sa.String(36), _fk("project_findings", "CASCADE"), nullable=False),
        sa.Column("via", sa.String(8), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("branch_id", "finding_id", name="uq_branch_finding"),
    )
    op.create_index("ix_branch_findings_branch_id", "branch_findings", ["branch_id"])
    op.create_index("ix_branch_findings_finding_id", "branch_findings", ["finding_id"])

    op.create_table(
        "project_decisions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), _fk("projects", "CASCADE"), nullable=False),
        sa.Column("branch_id", sa.String(36), _fk("project_branches", "CASCADE"), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("verdict", sa.String(16), nullable=False),
        sa.Column("choice", sa.String(16), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=False),
        sa.Column("cites", sa.JSON(), nullable=False),
        sa.Column("addresses", sa.JSON(), nullable=False),
        sa.Column("into_branch_id", sa.String(36), _fk("project_branches", "SET NULL"), nullable=True),
        sa.Column("supersedes_id", sa.String(36), _fk("project_decisions", "SET NULL"), nullable=True, unique=True),
        sa.Column("checks", sa.JSON(), nullable=False),
        sa.Column("warnings", sa.JSON(), nullable=False),
        sa.Column("decided_by_id", sa.String(36), _fk("users", "SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("project_id", "number", name="uq_project_decision_number"),
    )
    op.create_index("ix_project_decisions_project_id", "project_decisions", ["project_id"])
    op.create_index("ix_project_decisions_branch_id", "project_decisions", ["branch_id"])

    op.create_table(
        "project_proposals",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), _fk("projects", "CASCADE"), nullable=False),
        sa.Column("branch_id", sa.String(36), _fk("project_branches", "CASCADE"), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("agent_id", sa.String(36), _fk("agents", "SET NULL"), nullable=True),
        sa.Column("submitted_by_id", sa.String(36), nullable=True),
        sa.Column("resolved_by_id", sa.String(36), _fk("users", "SET NULL"), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("result", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("project_id", "number", name="uq_project_proposal_number"),
    )
    op.create_index("ix_project_proposals_project_id", "project_proposals", ["project_id"])
    op.create_index("ix_project_proposals_branch_id", "project_proposals", ["branch_id"])
    op.create_index("ix_project_proposals_status", "project_proposals", ["status"])

    op.create_table(
        "project_reports",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), _fk("projects", "CASCADE"), nullable=False, unique=True),
        sa.Column("draft", sa.Text(), nullable=False),
        sa.Column("draft_updated_by_id", sa.String(36), _fk("users", "SET NULL"), nullable=True),
        sa.Column("draft_updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "project_report_versions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("report_id", sa.String(36), _fk("project_reports", "CASCADE"), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("cites", sa.JSON(), nullable=False),
        sa.Column("published_by_id", sa.String(36), _fk("users", "SET NULL"), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("report_id", "version", name="uq_project_report_version"),
    )
    op.create_index("ix_project_report_versions_report_id", "project_report_versions", ["report_id"])

    with op.batch_alter_table("todos") as batch:
        batch.add_column(sa.Column("branch_id", sa.String(36), nullable=True))
        batch.create_foreign_key("fk_todos_branch_id", "project_branches", ["branch_id"], ["id"], ondelete="SET NULL")
        batch.create_index("ix_todos_branch_id", ["branch_id"])

    # Every project starts with one branch: the question as asked, open.
    bind = op.get_bind()
    branches = sa.table(
        "project_branches",
        sa.column("id", sa.String),
        sa.column("project_id", sa.String),
        sa.column("number", sa.Integer),
        sa.column("title", sa.String),
        sa.column("body", sa.Text),
        sa.column("status", sa.String),
        sa.column("created_by_kind", sa.String),
        sa.column("created_by_id", sa.String),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    now = datetime.now(UTC)
    rows = bind.execute(sa.text("SELECT id, name, created_by_kind, created_by_id FROM projects")).all()
    if rows:
        op.bulk_insert(
            branches,
            [
                {
                    "id": str(uuid.uuid4()),
                    "project_id": project_id,
                    "number": 1,
                    "title": name[:500],
                    "body": "",
                    "status": "open",
                    "created_by_kind": kind,
                    "created_by_id": by_id,
                    "created_at": now,
                    "updated_at": now,
                }
                for project_id, name, kind, by_id in rows
            ],
        )


def downgrade() -> None:
    with op.batch_alter_table("todos") as batch:
        batch.drop_index("ix_todos_branch_id")
        batch.drop_constraint("fk_todos_branch_id", type_="foreignkey")
        batch.drop_column("branch_id")
    op.drop_table("project_report_versions")
    op.drop_table("project_reports")
    op.drop_table("project_proposals")
    op.drop_table("project_decisions")
    op.drop_table("branch_findings")
    op.drop_table("project_findings")
    op.drop_table("project_branches")
    with op.batch_alter_table("projects") as batch:
        batch.drop_column("visibility")
        batch.drop_column("question")
        batch.drop_column("type")
