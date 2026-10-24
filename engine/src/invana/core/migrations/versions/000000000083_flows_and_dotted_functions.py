"""A plan is a Flow, and a function is named ``namespace.verb``.

docs/for-developers/modules/workflows/spec.md (F19 · F20) and
docs/for-developers/modules/workflows/features/the-catalogue.md (CA8).

``task_plans`` becomes ``flows``; ``tasks.task_plan_id`` and
``task_runs.task_plan_id`` become ``flow_id``; ``task_runs.workflow_key``
becomes ``flow_key``. Every recorded function key is rewritten to its dotted
name — a Task's ``step_key``, a run's ``task_key``, the functions a frozen
``plan_snapshot`` and an agent's ``workflow_spec`` name — and the promote event
becomes ``flow.promote`` on a ``flow``. Step ids (``tasks.key``,
``task_runs.step_key``) are data and keep the names they were written with.

On a database built from the baseline this finds nothing to rename and
nothing to rewrite.

Revision ID: 000000000083
Revises: 000000000082
Create Date: 2026-10-24
"""

from __future__ import annotations

import json
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000083"
down_revision: str | Sequence[str] | None = "000000000082"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

#: Every function whose key changed, old → new.
KEYS = {
    "count_types": "graph.read.types_count",
    "execute_graph_query": "graph.read.query",
    "expand_neighbours": "graph.read.get_neighbors",
    "resolve_elements": "graph.read.resolve",
    "validate_query": "graph.read.validate",
    "preview_stitches": "graph.stitch.preview",
    "apply_stitches": "graph.stitch.declare",
    "commit_stitches": "graph.stitch.commit",
    "withdraw_stitch": "graph.stitch.withdraw",
    "stitch": "graph.stitch.run",
    "write_graph": "graph.write.records",
    "bulk_write": "graph.write.bulk",
    "apply_data_edits": "graph.write.edits",
    "check_bundle": "data.bundle.check",
    "validate_records": "data.records.validate",
    "snapshot_model": "data.snapshot",
    "propose_model": "model.propose",
    "understand_ask": "model.understand_ask",
    "validate_proposal": "model.validate_proposal",
    "migrate_model": "model.migrate",
    "understand_intent": "nl.understand",
    "translate_thought": "nl.translate",
    "draft_plan": "plan.draft",
    "plan_workflow": "plan.compose",
    "verify_result": "plan.verify",
    "spawn_agent": "work.spawn_agent",
    "delegate": "work.delegate",
    "create_task": "work.create_task",
    "await_delegations": "work.await",
    "shape_for_canvas": "answer.shape",
    "web.fetch": "web.read_url",
    "web.download_and_extract": "web.download_file",
    "pubmed.search": "science.pubmed.search",
    "uniprot.get": "science.uniprot.get",
    "pubchem.get": "science.pubchem.get",
}

#: ``(old name, new name)`` for every index and constraint the renames reach.
_INDEXES = [
    ("ix_task_plans_graph_id", "ix_flows_graph_id"),
    ("ix_task_plans_kind", "ix_flows_kind"),
    ("ix_task_plans_origin", "ix_flows_origin"),
    ("ix_task_plans_reusable", "ix_flows_reusable"),
    ("ix_task_plans_todo_id", "ix_flows_todo_id"),
    ("ix_tasks_task_plan_id", "ix_tasks_flow_id"),
    ("ix_task_runs_task_plan_id", "ix_task_runs_flow_id"),
]
_CONSTRAINTS = [
    ("flows", "task_plans_pkey", "flows_pkey"),
    ("flows", "task_plans_graph_id_fkey", "flows_graph_id_fkey"),
    ("flows", "task_plans_todo_id_fkey", "flows_todo_id_fkey"),
    ("flows", "uq_task_plan_graph_key_version", "uq_flow_graph_key_version"),
    ("tasks", "tasks_task_plan_id_fkey", "tasks_flow_id_fkey"),
    ("tasks", "uq_task_plan_sibling_key", "uq_flow_sibling_key"),
    ("task_runs", "task_runs_task_plan_id_fkey", "task_runs_flow_id_fkey"),
]


def _named(value: object) -> object:
    return KEYS.get(value, value) if isinstance(value, str) else value


def _rewrite(node: object) -> object:
    """The functions a plan snapshot or an envelope names, rewritten; step ids untouched."""
    if isinstance(node, list):
        return [_rewrite(item) for item in node]
    if not isinstance(node, dict):
        return node
    out: dict = {}
    for key, value in node.items():
        if key == "task":
            out[key] = _named(value)
        elif key == "allow" and isinstance(value, list):
            out[key] = [_named(item) for item in value]
        elif key == "pins" and isinstance(value, dict):
            out[key] = {_named(k): v for k, v in value.items()}
        else:
            out[key] = _rewrite(value)
    return out


def _rewrite_json(bind: sa.Connection, table: str, column: str) -> None:
    rows = bind.execute(sa.text(f"SELECT id, {column} FROM {table} WHERE {column} IS NOT NULL")).all()
    for row_id, raw in rows:
        value = json.loads(raw) if isinstance(raw, str) else raw
        new = _rewrite(value)
        if new != value:
            bind.execute(
                sa.text(f"UPDATE {table} SET {column} = CAST(:v AS JSON) WHERE id = :id"),
                {"v": json.dumps(new), "id": row_id},
            )


def upgrade() -> None:
    bind = op.get_bind()
    tables = set(sa.inspect(bind).get_table_names())
    if "task_plans" in tables:
        op.rename_table("task_plans", "flows")
        op.alter_column("tasks", "task_plan_id", new_column_name="flow_id")
        op.alter_column("task_runs", "task_plan_id", new_column_name="flow_id")
        op.alter_column("task_runs", "workflow_key", new_column_name="flow_key")
        for old, new in _INDEXES:
            op.execute(f"ALTER INDEX {old} RENAME TO {new}")
        for table, old, new in _CONSTRAINTS:
            op.execute(f"ALTER TABLE {table} RENAME CONSTRAINT {old} TO {new}")

    for old, new in KEYS.items():
        params = {"old": old, "new": new}
        bind.execute(sa.text("UPDATE tasks SET step_key = :new WHERE step_key = :old"), params)
        bind.execute(sa.text("UPDATE task_runs SET task_key = :new WHERE task_key = :old"), params)
    _rewrite_json(bind, "task_runs", "plan_snapshot")
    _rewrite_json(bind, "agents", "workflow_spec")
    bind.execute(sa.text("UPDATE events SET action = 'flow.promote' WHERE action = 'workflow.promote'"))
    bind.execute(sa.text("UPDATE events SET target_kind = 'flow' WHERE target_kind = 'workflow'"))


def downgrade() -> None:
    raise NotImplementedError("the rename is one way: no old name is kept")
