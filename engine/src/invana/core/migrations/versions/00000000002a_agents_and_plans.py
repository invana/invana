"""Agents as principals, session bindings, and the per-thinking plan (S9c + S9d).

Three things land together because they are one idea: the workflow moves from
the *session surface* to the **agent**, and the plan moves from a static list in
code to ``thinkings.plan`` (docs/for-developers/modules/agents/spec.md).

- ``agents`` — the graph's named actors, with an envelope, lineage and bounds.
- ``graphs.default_agent_id`` · ``sessions.agent_id`` — the bindings.
- ``thinkings.agent_id`` · ``agent_version`` · ``plan`` · ``triggered_by`` ·
  ``parent_thinking_id`` · ``delegated_by_step_id`` · ``task_id``.
- ``thinking_steps.skills_offered`` · ``skills_applied`` — offered is a fact,
  applied is a self-report (docs/for-developers/modules/work/spec.md).

Seeded agent rows are inserted per existing graph so a session that names no
agent behaves exactly as it did before; ``sessions.agent_id`` is backfilled from
the surface and left nullable, because a graph created before this migration
may have no rows to point at until the app seeds them.

Revision ID: 00000000002a
Revises: 000000000029
Create Date: 2026-09-06
"""

from __future__ import annotations

import json
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op

revision: str = "00000000002a"
down_revision: str | Sequence[str] | None = "000000000029"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "agents",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "graph_id",
            sa.String(length=36),
            sa.ForeignKey("graphs.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("key", sa.String(length=64), nullable=True, index=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("kind", sa.String(length=16), nullable=False, server_default="authored"),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="active", index=True),
        sa.Column("workflow_spec", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column(
            "llm_config_id",
            sa.String(length=36),
            sa.ForeignKey("llm_providers.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("skill_ids", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("instructions", sa.Text(), nullable=False, server_default=""),
        sa.Column("lifetime", sa.String(length=16), nullable=False, server_default="persistent"),
        sa.Column(
            "parent_agent_id",
            sa.String(length=36),
            sa.ForeignKey("agents.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("spawned_in_thinking_id", sa.String(length=36), nullable=True),
        sa.Column("budget", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("policy", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_by_kind", sa.String(length=16), nullable=False, server_default="user"),
        sa.Column("created_by_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("graph_id", "name", name="uq_agent_graph_name"),
    )

    # The reusable plan library (docs/for-developers/modules/agents/spec.md). Seeded templates load into
    # it at startup; a *promoted* plan is what makes the table necessary — it
    # needs somewhere to go that is not the repo.
    op.create_table(
        "workflows",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "graph_id",
            sa.String(length=36),
            sa.ForeignKey("graphs.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("key", sa.String(length=64), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("spec", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("intents", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("source", sa.String(length=16), nullable=False, server_default="seeded"),
        sa.Column("promoted_from_thinking_id", sa.String(length=36), nullable=True),
        sa.Column("created_by_kind", sa.String(length=16), nullable=False, server_default="user"),
        sa.Column("created_by_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("graph_id", "key", "version", name="uq_workflow_graph_key_version"),
    )

    op.add_column("graphs", sa.Column("default_agent_id", sa.String(length=36), nullable=True))
    op.add_column("sessions", sa.Column("agent_id", sa.String(length=36), nullable=True))

    op.add_column("thinkings", sa.Column("agent_id", sa.String(length=36), nullable=True))
    op.add_column("thinkings", sa.Column("agent_version", sa.Integer(), nullable=True))
    op.add_column("thinkings", sa.Column("plan", sa.JSON(), nullable=True))
    op.add_column("thinkings", sa.Column("plan_source", sa.String(length=64), nullable=True))
    op.add_column("thinkings", sa.Column("plan_version", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("thinkings", sa.Column("triggered_by", sa.String(length=16), nullable=False, server_default="user"))
    op.add_column("thinkings", sa.Column("parent_thinking_id", sa.String(length=36), nullable=True))
    op.add_column("thinkings", sa.Column("delegated_by_step_id", sa.String(length=36), nullable=True))
    op.add_column("thinkings", sa.Column("task_id", sa.String(length=36), nullable=True))
    op.add_column("thinkings", sa.Column("on_behalf_of_user_id", sa.String(length=36), nullable=True))
    op.add_column("thinkings", sa.Column("clarifications", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("thinkings", sa.Column("replans", sa.Integer(), nullable=False, server_default="0"))
    op.create_index("ix_thinkings_parent_thinking_id", "thinkings", ["parent_thinking_id"])
    op.create_index("ix_thinkings_task_id", "thinkings", ["task_id"])

    op.add_column("thinking_steps", sa.Column("skills_offered", sa.JSON(), nullable=False, server_default="[]"))
    op.add_column("thinking_steps", sa.Column("skills_applied", sa.JSON(), nullable=False, server_default="[]"))
    op.add_column("thinking_steps", sa.Column("step_id", sa.String(length=64), nullable=True))
    op.add_column("thinking_steps", sa.Column("args", sa.JSON(), nullable=True))
    op.add_column("thinking_steps", sa.Column("child_thinking_id", sa.String(length=36), nullable=True))

    _seed_agents()


def _seed_agents() -> None:
    """One row per seeded agent, per existing graph.

    Imported lazily from the registry so the seed and the runtime can never
    drift: adding a seeded agent is one entry there, not an entry plus a
    migration edit.
    """
    from invana.apps.agents.registry import SEEDED_AGENTS

    bind = op.get_bind()
    graphs = bind.execute(sa.text("SELECT id FROM graphs")).fetchall()
    if not graphs:
        return

    now = datetime.now(UTC)
    insert = sa.text(
        "INSERT INTO agents (id, graph_id, key, name, description, kind, status, workflow_spec, "
        "llm_config_id, skill_ids, instructions, lifetime, budget, policy, version, "
        "created_by_kind, created_by_id, created_at, updated_at) "
        "VALUES (:id, :graph_id, :key, :name, :description, 'seeded', 'active', :workflow_spec, "
        ":llm_config_id, '[]', :instructions, 'persistent', '{}', '{}', 1, "
        "'system', NULL, :now, :now)"
    )
    for (graph_id,) in graphs:
        # The graph's default LLM provider, if it has one. A graph with no
        # provider gets unbound agents that say so rather than failing to exist.
        row = bind.execute(
            sa.text("SELECT id FROM llm_providers WHERE graph_id = :g AND is_default = TRUE LIMIT 1"),
            {"g": graph_id},
        ).fetchone()
        llm_id = row[0] if row else None

        default_id: str | None = None
        for seeded in SEEDED_AGENTS:
            agent_id = str(uuid.uuid4())
            bind.execute(
                insert,
                {
                    "id": agent_id,
                    "graph_id": graph_id,
                    "key": seeded.key,
                    "name": seeded.name,
                    "description": seeded.description,
                    "workflow_spec": json.dumps(seeded.workflow_spec),
                    "llm_config_id": llm_id,
                    "instructions": seeded.instructions,
                    "now": now,
                },
            )
            if seeded.default:
                default_id = agent_id
            # Point every existing session at the seeded agent for its surface,
            # so no thread is left without one.
            bind.execute(
                sa.text("UPDATE sessions SET agent_id = :a WHERE graph_id = :g AND surface = :s"),
                {"a": agent_id, "g": graph_id, "s": seeded.surface},
            )
        if default_id:
            bind.execute(
                sa.text("UPDATE graphs SET default_agent_id = :a WHERE id = :g"),
                {"a": default_id, "g": graph_id},
            )


def downgrade() -> None:
    op.drop_column("thinking_steps", "child_thinking_id")
    op.drop_column("thinking_steps", "args")
    op.drop_column("thinking_steps", "step_id")
    op.drop_column("thinking_steps", "skills_applied")
    op.drop_column("thinking_steps", "skills_offered")

    op.drop_index("ix_thinkings_task_id", table_name="thinkings")
    op.drop_index("ix_thinkings_parent_thinking_id", table_name="thinkings")
    for column in (
        "replans",
        "clarifications",
        "on_behalf_of_user_id",
        "task_id",
        "delegated_by_step_id",
        "parent_thinking_id",
        "triggered_by",
        "plan_version",
        "plan_source",
        "plan",
        "agent_version",
        "agent_id",
    ):
        op.drop_column("thinkings", column)

    op.drop_column("sessions", "agent_id")
    op.drop_column("graphs", "default_agent_id")
    op.drop_table("workflows")
    op.drop_table("agents")
