"""A step's id is its function with dots as underscores.

docs/for-developers/modules/workflows/spec.md (F20). Every step id written
under an old function key becomes that function's dotted name with dots as
underscores (``translate_thought`` → ``nl_translate``) — on a flow's tasks, on
the runs that executed them, in a frozen ``plan_snapshot``, in an agent's
``workflow_spec`` — and every ``${steps.<id>.…}`` binding follows. The map is
one-to-one, so no two siblings can collide.

On a database built from the baseline this finds nothing to rewrite.

Revision ID: 000000000084
Revises: 000000000083
Create Date: 2026-10-24
"""

from __future__ import annotations

import json
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000084"
down_revision: str | Sequence[str] | None = "000000000083"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

#: Old step id (the old function key) → the new one.
IDS = {
    "count_types": "graph_read_types_count",
    "execute_graph_query": "graph_read_query",
    "expand_neighbours": "graph_read_get_neighbors",
    "resolve_elements": "graph_read_resolve",
    "validate_query": "graph_read_validate",
    "preview_stitches": "graph_stitch_preview",
    "apply_stitches": "graph_stitch_declare",
    "commit_stitches": "graph_stitch_commit",
    "withdraw_stitch": "graph_stitch_withdraw",
    "stitch": "graph_stitch_run",
    "write_graph": "graph_write_records",
    "bulk_write": "graph_write_bulk",
    "apply_data_edits": "graph_write_edits",
    "check_bundle": "data_bundle_check",
    "validate_records": "data_records_validate",
    "snapshot_model": "data_snapshot",
    "propose_model": "model_propose",
    "understand_ask": "model_understand_ask",
    "validate_proposal": "model_validate_proposal",
    "migrate_model": "model_migrate",
    "understand_intent": "nl_understand",
    "translate_thought": "nl_translate",
    "draft_plan": "plan_draft",
    "plan_workflow": "plan_compose",
    "verify_result": "plan_verify",
    "spawn_agent": "work_spawn_agent",
    "delegate": "work_delegate",
    "create_task": "work_create_task",
    "await_delegations": "work_await",
    "shape_for_canvas": "answer_shape",
}


def _id(value: object) -> object:
    return IDS.get(value, value) if isinstance(value, str) else value


def _bindings(value: str) -> str:
    for old, new in IDS.items():
        value = value.replace("${steps." + old + ".", "${steps." + new + ".")
    return value


def _rewrite(node: object) -> object:
    """Step ids, the edges that name them, and the bindings that read them."""
    if isinstance(node, str):
        return _bindings(node)
    if isinstance(node, list):
        return [_rewrite(item) for item in node]
    if not isinstance(node, dict):
        return node
    out: dict = {}
    for key, value in node.items():
        if key in ("id", "entry", "step"):
            out[key] = _id(value)
        elif key == "depends_on" and isinstance(value, list):
            out[key] = [_id(item) if isinstance(item, str) else _rewrite(item) for item in value]
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
    for old, new in IDS.items():
        params = {"old": old, "new": new}
        bind.execute(sa.text("UPDATE tasks SET key = :new WHERE key = :old"), params)
        bind.execute(sa.text("UPDATE tasks SET source_step_key = :new WHERE source_step_key = :old"), params)
        bind.execute(sa.text("UPDATE task_runs SET step_key = :new WHERE step_key = :old"), params)
        bind.execute(sa.text("UPDATE run_touches SET step_key = :new WHERE step_key = :old"), params)
    for table, column in (
        ("tasks", "depends_on"),
        ("tasks", "args"),
        ("task_runs", "args"),
        ("task_runs", "plan_snapshot"),
        ("agents", "workflow_spec"),
    ):
        _rewrite_json(bind, table, column)


def downgrade() -> None:
    raise NotImplementedError("the rename is one way: no old name is kept")
