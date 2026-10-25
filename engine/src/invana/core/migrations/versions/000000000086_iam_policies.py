"""IAM: policies, their versions and attachments, groups, service accounts, narrowed tokens, dataset drafts.

docs/for-developers/modules/identity-and-access/features/policies.md ·
effective-access.md · people-and-groups.md · tokens.md ·
modules/bring-data-in/features/datasets.md (DT17).

* New tables ``policies`` · ``policy_versions`` · ``policy_attachments`` ·
  ``groups`` · ``group_members``.
* Every Graph gets its six managed policies (the engine rewrites their
  statements on every start).
* Every Graph's creator also holds ``iam-admin``.
* Every agent keeps what its envelope let it do: ``viewer``, plus
  ``contributor`` when its envelope allows a ``work.*`` function and
  ``modeller`` when it allows a graph-write, schema-write or ingest one; an
  envelope that names nothing allows everything, so such an agent gets all three.
* ``users.is_service_account``; ``personal_access_tokens.graph_id`` ·
  ``policy_id`` · ``created_by_id``; ``dataset_versions.state``.

Revision ID: 000000000086
Revises: 000000000085
Create Date: 2026-10-25
"""

from __future__ import annotations

import json
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op

from invana.apps.iam.managed import MANAGED

revision: str = "000000000086"
down_revision: str | Sequence[str] | None = "000000000085"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_WRITES = ("graph.write.", "graph.stitch.commit", "graph.stitch.declare", "graph.stitch.run", "graph.stitch.withdraw")
_MODEL = ("model.migrate", "model.understand_ask", "model.validate_proposal", "data.")


def _ts() -> sa.Column:
    return sa.Column("created_at", sa.DateTime(timezone=True), nullable=False)


def upgrade() -> None:
    op.add_column("users", sa.Column("is_service_account", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("personal_access_tokens", sa.Column("graph_id", sa.String(36), nullable=True))
    op.add_column("personal_access_tokens", sa.Column("policy_id", sa.String(36), nullable=True))
    op.add_column("personal_access_tokens", sa.Column("created_by_id", sa.String(36), nullable=True))
    op.create_foreign_key("fk_pat_graph", "personal_access_tokens", "graphs", ["graph_id"], ["id"], ondelete="CASCADE")
    op.create_foreign_key(
        "fk_pat_created_by", "personal_access_tokens", "users", ["created_by_id"], ["id"], ondelete="SET NULL"
    )
    op.create_index("ix_personal_access_tokens_graph_id", "personal_access_tokens", ["graph_id"])
    op.add_column(
        "dataset_versions",
        sa.Column("state", sa.String(16), nullable=False, server_default="published"),
    )

    op.create_table(
        "policies",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("graph_id", sa.String(36), sa.ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("statements", sa.JSON(), nullable=False),
        sa.Column("limits", sa.JSON(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("owner_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("drafted_by", sa.String(16), nullable=False, server_default="person"),
        sa.Column("created_by_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("updated_by_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        _ts(),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("graph_id", "name", name="uq_policies_graph_name"),
    )
    op.create_index("ix_policies_graph_id", "policies", ["graph_id"])
    op.create_index("ix_policies_kind", "policies", ["kind"])
    op.create_table(
        "policy_versions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("policy_id", sa.String(36), sa.ForeignKey("policies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("statements", sa.JSON(), nullable=False),
        sa.Column("limits", sa.JSON(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("saved_by_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("saved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("why", sa.String(500), nullable=True),
        sa.UniqueConstraint("policy_id", "version", name="uq_policy_versions_number"),
    )
    op.create_index("ix_policy_versions_policy_id", "policy_versions", ["policy_id"])
    op.create_table(
        "policy_attachments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("policy_id", sa.String(36), sa.ForeignKey("policies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("graph_id", sa.String(36), sa.ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("holder_kind", sa.String(16), nullable=False),
        sa.Column("holder_id", sa.String(36), nullable=False),
        sa.Column("attached_by_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("attached_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("run_id", sa.String(36), nullable=True),
        sa.Column("via", sa.String(16), nullable=False, server_default="direct"),
        sa.Column("approval_id", sa.String(36), nullable=True),
        sa.UniqueConstraint("policy_id", "holder_kind", "holder_id", name="uq_policy_attachments_holder"),
    )
    op.create_index("ix_policy_attachments_policy_id", "policy_attachments", ["policy_id"])
    op.create_index("ix_policy_attachments_graph_id", "policy_attachments", ["graph_id"])
    op.create_index("ix_policy_attachments_holder_id", "policy_attachments", ["holder_id"])
    op.create_table(
        "groups",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("graph_id", sa.String(36), sa.ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_by_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        _ts(),
        sa.UniqueConstraint("graph_id", "name", name="uq_groups_graph_name"),
    )
    op.create_index("ix_groups_graph_id", "groups", ["graph_id"])
    op.create_table(
        "group_members",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("group_id", sa.String(36), sa.ForeignKey("groups.id", ondelete="CASCADE"), nullable=False),
        sa.Column("member_kind", sa.String(16), nullable=False),
        sa.Column("member_id", sa.String(36), nullable=False),
        sa.Column("added_by_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("added_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("group_id", "member_kind", "member_id", name="uq_group_members_member"),
    )
    op.create_index("ix_group_members_group_id", "group_members", ["group_id"])
    op.create_index("ix_group_members_member_id", "group_members", ["member_id"])

    _seed()


def _seed() -> None:
    conn = op.get_bind()
    now = datetime.now(UTC)
    graphs = conn.execute(sa.text("SELECT id, created_by_id FROM graphs")).all()
    policies = sa.table(
        "policies",
        sa.column("id"),
        sa.column("graph_id"),
        sa.column("name"),
        sa.column("kind"),
        sa.column("status"),
        sa.column("description"),
        sa.column("statements", sa.JSON),
        sa.column("limits", sa.JSON),
        sa.column("version"),
        sa.column("drafted_by"),
        sa.column("created_at"),
        sa.column("updated_at"),
    )
    managed_ids: dict[tuple[str, str], str] = {}
    for graph_id, creator_id in graphs:
        for m in MANAGED:
            pid = str(uuid.uuid4())
            managed_ids[(graph_id, m.name)] = pid
            conn.execute(
                policies.insert().values(
                    id=pid,
                    graph_id=graph_id,
                    name=m.name,
                    kind="managed",
                    status="saved",
                    description=m.description,
                    statements=list(m.statements),
                    limits={},
                    version=1,
                    drafted_by="person",
                    created_at=now,
                    updated_at=now,
                )
            )
        row = conn.execute(
            sa.text("SELECT roles FROM graph_members WHERE graph_id = :g AND user_id = :u"),
            {"g": graph_id, "u": creator_id},
        ).first()
        if row is not None:
            roles = row[0] if isinstance(row[0], list) else json.loads(row[0] or "[]")
            if "iam-admin" not in roles:
                roles = [r for r in roles if r != "viewer"] + ["iam-admin"]
                conn.execute(
                    sa.text("UPDATE graph_members SET roles = CAST(:r AS JSON) WHERE graph_id = :g AND user_id = :u"),
                    {"r": json.dumps(roles), "g": graph_id, "u": creator_id},
                )

    attachments = sa.table(
        "policy_attachments",
        sa.column("id"),
        sa.column("policy_id"),
        sa.column("graph_id"),
        sa.column("holder_kind"),
        sa.column("holder_id"),
        sa.column("attached_at"),
        sa.column("via"),
    )
    agents = conn.execute(sa.text("SELECT id, graph_id, workflow_spec FROM agents WHERE kind != 'spawned'")).all()
    for agent_id, graph_id, raw in agents:
        spec = raw if isinstance(raw, dict) else json.loads(raw or "{}")
        allow = list((spec or {}).get("allow") or [])
        names = ["viewer"]
        if not allow or any(k.startswith("work.") for k in allow):
            names.append("contributor")
        if not allow or any(k.startswith(_WRITES) or k.startswith(_MODEL) for k in allow):
            names.append("modeller")
        for name in names:
            pid = managed_ids.get((graph_id, name))
            if pid is None:
                continue
            conn.execute(
                attachments.insert().values(
                    id=str(uuid.uuid4()),
                    policy_id=pid,
                    graph_id=graph_id,
                    holder_kind="agent",
                    holder_id=agent_id,
                    attached_at=now,
                    via="direct",
                )
            )


def downgrade() -> None:
    op.drop_table("group_members")
    op.drop_table("groups")
    op.drop_table("policy_attachments")
    op.drop_table("policy_versions")
    op.drop_table("policies")
    op.drop_column("dataset_versions", "state")
    op.drop_index("ix_personal_access_tokens_graph_id", table_name="personal_access_tokens")
    op.drop_constraint("fk_pat_created_by", "personal_access_tokens", type_="foreignkey")
    op.drop_constraint("fk_pat_graph", "personal_access_tokens", type_="foreignkey")
    op.drop_column("personal_access_tokens", "created_by_id")
    op.drop_column("personal_access_tokens", "policy_id")
    op.drop_column("personal_access_tokens", "graph_id")
    op.drop_column("users", "is_service_account")
