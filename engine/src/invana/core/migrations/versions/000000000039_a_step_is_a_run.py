"""A step is a run (docs/for-developers/building-engine/task-model-migration.md **M3**).

``thoughts`` + ``thinkings`` + ``thinking_steps`` → **one** ``task_runs``.

A Thinking and a ThinkingStep were the same fact at two resolutions, so every
question about *what ran* had to be asked twice and stitched — and a delegated
child, which is a whole Thinking hanging off a step, could only be reached by
joining the two. One table makes the chain one recursion on ``parent_run_id``.

The ask folds in with them. ``thoughts`` was a row that every root Thinking had
exactly one of, so ``body`` · ``params`` · ``ask_kind`` and the session pair
become columns on the root run. They are null on a child, which is the honest
shape: a node of a plan is not an ask. ``session_id`` and ``message_id`` stay
**foreign keys** rather than folding into a jsonb blob — a session delete has to
cascade, and *the runs of this session* has to be an indexed lookup.

``child_thinking_id`` does **not** survive. A delegating node's children are the
rows naming it in ``parent_run_id``, so the column duplicated the edge it sat
on, and a duplicate that can disagree with its source eventually does.

Data is migrated, not dropped: every Thought/Thinking pair becomes a root run
and every step becomes a child of it, keeping its own id so ``emissions`` and
``prompt_answers`` still resolve.

Revision ID: 000000000039
Revises: 000000000038
Create Date: 2026-09-17
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000039"
down_revision: str | Sequence[str] | None = "000000000038"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── 1 · the one table ────────────────────────────────────────────────────
    op.create_table(
        "task_runs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("graph_id", sa.String(36), sa.ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("parent_run_id", sa.String(36), sa.ForeignKey("task_runs.id", ondelete="CASCADE"), nullable=True),
        sa.Column("todo_id", sa.String(36), nullable=True),
        sa.Column("task_plan_id", sa.String(36), sa.ForeignKey("task_plans.id", ondelete="SET NULL"), nullable=True),
        sa.Column("task_id", sa.String(36), sa.ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True),
        sa.Column("role", sa.String(16), nullable=False, server_default="execute"),
        sa.Column("task_key", sa.String(64), nullable=False, server_default=""),
        sa.Column("step_key", sa.String(64), nullable=True),
        sa.Column("label", sa.String(64), nullable=False, server_default=""),
        sa.Column("seq", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("lane", sa.String(64), nullable=True),
        sa.Column("iteration", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("attempt", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("workflow_key", sa.String(64), nullable=False, server_default=""),
        sa.Column("plan_snapshot", sa.JSON(), nullable=True),
        sa.Column("plan_origin", sa.String(64), nullable=True),
        sa.Column("plan_revision", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("lens_id", sa.String(36), nullable=True),
        sa.Column("lens_snapshot", sa.JSON(), nullable=True),
        sa.Column("ask_kind", sa.String(16), nullable=True),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("params", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("session_id", sa.String(36), sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=True),
        sa.Column(
            "message_id", sa.String(36), sa.ForeignKey("session_messages.id", ondelete="SET NULL"), nullable=True
        ),
        sa.Column("author_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("author_kind", sa.String(16), nullable=False, server_default="user"),
        sa.Column("agent_id", sa.String(36), nullable=True),
        sa.Column("agent_version", sa.Integer(), nullable=True),
        sa.Column("triggered_by", sa.String(16), nullable=False, server_default="user"),
        sa.Column("on_behalf_of_user_id", sa.String(36), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="queued"),
        sa.Column("outcome", sa.String(16), nullable=True),
        sa.Column(
            "assistant_message_id",
            sa.String(36),
            sa.ForeignKey("session_messages.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("queued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cursor", sa.JSON(), nullable=True),
        sa.Column("stream_seq", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("clarifications", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("replans", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("detail", sa.String(255), nullable=False, server_default=""),
        sa.Column("args", sa.JSON(), nullable=True),
        sa.Column("input", sa.JSON(), nullable=True),
        sa.Column("output", sa.JSON(), nullable=True),
        sa.Column("result", sa.JSON(), nullable=True),
        sa.Column("error", sa.JSON(), nullable=True),
        sa.Column("tokens_in", sa.Integer(), nullable=True),
        sa.Column("tokens_out", sa.Integer(), nullable=True),
        sa.Column("skills_offered", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("skills_applied", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("parent_run_id", "task_id", "lane", "iteration", "attempt", name="uq_task_run_attempt"),
    )
    for col in (
        "graph_id",
        "parent_run_id",
        "todo_id",
        "task_plan_id",
        "task_id",
        "role",
        "session_id",
        "agent_id",
        "lens_id",
        "status",
        "assistant_message_id",
    ):
        op.create_index(f"ix_task_runs_{col}", "task_runs", [col])

    # ── 2 · every thinking becomes a root run, carrying its thought ──────────
    #
    # The ids are kept: `emissions`, `prompt_answers` and every stream row name
    # them, and a migration that renumbered would have to rewrite all three.
    op.execute(
        """
        INSERT INTO task_runs (
            id, graph_id, parent_run_id, todo_id, role,
            task_key, label, seq, iteration, attempt,
            workflow_key, plan_snapshot, plan_origin, plan_revision,
            ask_kind, body, params, session_id, message_id, author_id, author_kind,
            agent_id, agent_version, triggered_by, on_behalf_of_user_id,
            status, outcome, assistant_message_id,
            queued_at, started_at, finished_at, cursor, stream_seq,
            clarifications, replans, detail,
            skills_offered, skills_applied, created_at
        )
        SELECT
            t.id, t.graph_id, t.parent_thinking_id, th.work_item_id, 'execute',
            '', '', 0, 0, 1,
            t.workflow_key, t.plan, t.plan_source, t.plan_version,
            th.kind, th.body, th.params, th.session_id, th.message_id, th.author_id, th.author_kind,
            t.agent_id, t.agent_version, t.triggered_by, t.on_behalf_of_user_id,
            -- `thinking` is a retired word (terminology.md §8); the state it named
            -- is `running`, which is what a step already called it.
            CASE t.status WHEN 'thinking' THEN 'running' ELSE t.status END,
            t.outcome, t.assistant_message_id,
            t.queued_at, t.started_at, t.finished_at, t.cursor, t.stream_seq,
            t.clarifications, t.replans, '',
            '[]', '[]', t.queued_at
        FROM thinkings t JOIN thoughts th ON th.id = t.thought_id
        """
    )

    # ── 3 · every step becomes a child of its thinking ──────────────────────
    op.execute(
        """
        INSERT INTO task_runs (
            id, graph_id, parent_run_id, role, task_key, step_key, label,
            seq, iteration, attempt, status, message_id,
            started_at, finished_at, detail, args, input, output, error,
            tokens_in, tokens_out, skills_offered, skills_applied,
            params, author_kind, triggered_by, queued_at, created_at,
            stream_seq, clarifications, replans, plan_revision
        )
        SELECT
            s.id, t.graph_id, s.thinking_id, 'execute', s.task_key, s.step_id, s.label,
            s.seq, 0, s.attempt, s.status, s.message_id,
            s.started_at, s.finished_at, s.detail, s.args, s.input, s.output, s.error,
            s.tokens_in, s.tokens_out, s.skills_offered, s.skills_applied,
            '{}'::json, 'system', t.triggered_by, COALESCE(s.started_at, t.queued_at),
            COALESCE(s.started_at, t.queued_at), 0, 0, 0, 0
        FROM thinking_steps s JOIN thinkings t ON t.id = s.thinking_id
        """
    )

    # ── 4 · the stream and the prompts follow their run ─────────────────────
    op.rename_table("thought_stream", "task_stream")
    op.alter_column("task_stream", "thinking_id", new_column_name="run_id")
    op.rename_table("prompt_answers", "task_prompts")
    op.alter_column("task_prompts", "thinking_id", new_column_name="run_id")
    op.add_column("task_prompts", sa.Column("kind", sa.String(16), nullable=False, server_default="clarification"))
    op.add_column("task_prompts", sa.Column("options", sa.JSON(), nullable=False, server_default="[]"))
    op.add_column("task_prompts", sa.Column("deadline_s", sa.Integer(), nullable=True))

    # `emissions` names a run now, and the step that produced it is a run too.
    op.alter_column("emissions", "thinking_id", new_column_name="run_id")
    op.alter_column("emissions", "step_id", new_column_name="step_run_id")

    # A renamed column keeps the constraint it was created with, so all three
    # still point at `thinkings` — and that is what would refuse the drop below.
    for table, old_fk in (
        ("task_stream", "thought_stream_thinking_id_fkey"),
        ("task_prompts", "prompt_answers_thinking_id_fkey"),
        ("emissions", "emissions_thinking_id_fkey"),
    ):
        op.drop_constraint(old_fk, table, type_="foreignkey")
        op.create_foreign_key(f"{table}_run_id_fkey", table, "task_runs", ["run_id"], ["id"], ondelete="CASCADE")
    # The unique constraints carry the old nouns in their names too.
    op.execute("ALTER TABLE task_stream RENAME CONSTRAINT uq_thought_stream_seq TO uq_task_stream_seq")

    # An agent records the run it was spawned in, and that word moved too.
    op.alter_column("agents", "spawned_in_thinking_id", new_column_name="spawned_in_run_id")
    # Everything that pointed at a thinking now points at a run: a reply, the
    # load that opened one, the event, and the node inside it.
    op.alter_column("session_messages", "thinking_id", new_column_name="run_id")
    op.alter_column("import_jobs", "thinking_id", new_column_name="run_id")
    # An event names the run it belongs to, and the node inside it.
    op.alter_column("events", "thinking_id", new_column_name="run_id")
    op.alter_column("events", "thinking_step_id", new_column_name="node_run_id")
    # A Graph's concurrency ceiling counts runs, and an event's index names one.
    op.alter_column("graphs", "max_concurrent_thinkings", new_column_name="max_concurrent_runs")
    op.execute("ALTER INDEX ix_events_thinking_id_created_at RENAME TO ix_events_run_id_created_at")

    # ── 5 · the old tables go ───────────────────────────────────────────────
    op.drop_table("thinking_steps")
    op.drop_table("thinkings")
    op.drop_table("thoughts")


def downgrade() -> None:
    raise NotImplementedError(
        "M3 is a one-way door (task-model-migration.md §9): a step and a run are one "
        "record now, and splitting them again would have to invent which half each "
        "column belonged to."
    )
