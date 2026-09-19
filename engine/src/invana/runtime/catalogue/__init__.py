"""The catalogue — the **closed** set of steps a plan may name
(docs/for-developers/orchestration.md §0.6).

``CATALOGUE`` is the declaration: every entry carries the bound it spends, the
args it parses, the outputs it promises and what must run before it. ``TASKS``
is the dispatch table derived from it. Nothing outside this package adds an
entry, which is what makes the set closed and a plan checkable before it runs —
an app that could register one would close an import cycle *and* make the
envelope advisory (building-engine/the-runtime-package.md §1).

**One module per bound**, because the group is what the envelope ceilings:

| Module | Bound | Entries |
|---|---|---|
| `contract` | — | what a step is handed and may raise; declares no entry |
| `registry` | — | the shape of a declaration |
| `pure` | *none* | `validate_query` · `shape_for_canvas` · `verify_result` · `await_delegations` |
| `graph_read` | `graph_read` | `execute_graph_query` |
| `ingest` | `ingest` | `check_bundle` · `validate_records` · `snapshot_model` |
| `graph_write` | `graph_write` | `write_graph` · `stitch` · `apply_stitches` · `commit_stitches` |
| `schema_write` | `schema_write` | `understand_ask` · `validate_proposal` |
| `llm` | `llm` | `understand_intent` · `plan_workflow` · `translate_thought` · `propose_model` |
| `work_write` | `work_write` | `spawn_agent` · `delegate` · `create_task` |

Three modules in here declare no entry and are **bodies**: `bundle` (the
manifest's only parser), `records` (validating and writing records) and
`stitching` (the rules between models). Loading owns no records of its own, so
there is no app for those entries to be thin against — § 4a of
building-engine/the-runtime-package.md says where a body goes.

The keys are the plan vocabulary and are **not** module paths: they are stored
in `run_nodes.task_key` and read by Studio, so they do not change when a
step moves between modules here.
"""

from __future__ import annotations

from invana.runtime.catalogue import graph_read, graph_write, ingest, llm, pure, schema_write, work_write
from invana.runtime.catalogue.contract import (
    CannotAnswer,
    LoadVars,
    NeedsInput,
    Out,
    RunVars,
    TaskContext,
    TaskFailure,
    assemble_history,
    http_failure,
    labels_in,
    load_grounding,
    offered_skill_ids,
    query_language_for,
)
from invana.runtime.catalogue.graph_read import execute_graph_query
from invana.runtime.catalogue.graph_write import (
    apply_stitches,
    commit_stitches,
    stitch,
    write_graph,
)
from invana.runtime.catalogue.ingest import check_bundle, snapshot_model, validate_records
from invana.runtime.catalogue.llm import (
    plan_workflow,
    propose_model_task,
    translate_thought,
    understand_intent,
)
from invana.runtime.catalogue.pure import (
    await_delegations,
    shape_for_canvas,
    validate_query,
    verify_result,
)
from invana.runtime.catalogue.registry import Arg, Bound, Entry, Type, build
from invana.runtime.catalogue.schema_write import understand_ask, validate_proposal_task
from invana.runtime.catalogue.work_write import create_task, delegate, spawn_agent

#: Every declared entry, by key. The closed set.
CATALOGUE: dict[str, Entry] = build(
    *pure.ENTRIES.values(),
    *graph_read.ENTRIES.values(),
    *ingest.ENTRIES.values(),
    *graph_write.ENTRIES.values(),
    *schema_write.ENTRIES.values(),
    *llm.ENTRIES.values(),
    *work_write.ENTRIES.values(),
)

#: What the interpreter dispatches — derived, never authored beside CATALOGUE.
TASKS = {key: entry.run for key, entry in CATALOGUE.items()}

__all__ = [
    "CATALOGUE",
    "TASKS",
    "Arg",
    "Bound",
    "CannotAnswer",
    "Entry",
    "LoadVars",
    "NeedsInput",
    "Out",
    "RunVars",
    "TaskContext",
    "TaskFailure",
    "Type",
    "apply_stitches",
    "assemble_history",
    "await_delegations",
    "check_bundle",
    "commit_stitches",
    "create_task",
    "delegate",
    "execute_graph_query",
    "http_failure",
    "labels_in",
    "load_grounding",
    "offered_skill_ids",
    "plan_workflow",
    "propose_model_task",
    "query_language_for",
    "shape_for_canvas",
    "snapshot_model",
    "spawn_agent",
    "stitch",
    "translate_thought",
    "understand_ask",
    "understand_intent",
    "validate_proposal_task",
    "validate_query",
    "validate_records",
    "verify_result",
    "write_graph",
]
