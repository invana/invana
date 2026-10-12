"""The catalogue — the **closed** set of task types a plan may name
(docs/for-developers/orchestration.md §0.6).

Task types are declared in plugins (:mod:`invana.plugins`), one folder each, and
this package is the runtime's view of them: ``CATALOGUE`` is every loaded task
type by key, ``TASKS`` the dispatch table derived from it. The set is closed
**per process** — the plugin registry is built once at start-up and frozen —
which is what makes a plan checkable before it runs.

``TASKS`` is a plain dict so a test may substitute one step; ``CATALOGUE`` is a
copy of the frozen registry's mapping, never authored beside it.

The keys are the plan vocabulary and are **not** module paths: they are stored
in `run_nodes.task_key` and read by Studio, so they do not change when a task
type moves between plugins.
"""

from __future__ import annotations

from invana.plugins import load_plugins
from invana.plugins.core.graph_read.tasks.execute_graph_query.run import execute_graph_query
from invana.plugins.core.graph_write.tasks.apply_stitches.run import apply_stitches
from invana.plugins.core.graph_write.tasks.commit_stitches.run import commit_stitches
from invana.plugins.core.graph_write.tasks.stitch.run import stitch
from invana.plugins.core.graph_write.tasks.write_graph.run import write_graph
from invana.plugins.core.ingest.tasks.check_bundle.run import check_bundle
from invana.plugins.core.ingest.tasks.snapshot_model.run import snapshot_model
from invana.plugins.core.ingest.tasks.validate_records.run import validate_records
from invana.plugins.core.llm.tasks.plan_workflow.run import plan_workflow
from invana.plugins.core.llm.tasks.propose_model.run import propose_model_task
from invana.plugins.core.llm.tasks.translate_thought.run import translate_thought
from invana.plugins.core.llm.tasks.understand_intent.run import understand_intent
from invana.plugins.core.pure.tasks.await_delegations.run import await_delegations
from invana.plugins.core.pure.tasks.shape_for_canvas.run import shape_for_canvas
from invana.plugins.core.pure.tasks.validate_query.run import validate_query
from invana.plugins.core.pure.tasks.verify_result.run import verify_result
from invana.plugins.core.schema_write.tasks.understand_ask.run import understand_ask
from invana.plugins.core.schema_write.tasks.validate_proposal.run import validate_proposal_task
from invana.plugins.core.work_write.tasks.create_task.run import create_task
from invana.plugins.core.work_write.tasks.delegate.run import delegate
from invana.plugins.core.work_write.tasks.spawn_agent.run import spawn_agent
from invana.plugins.sdk.context import (
    LoadVars,
    Out,
    RunVars,
    TaskContext,
    cited_rule_version_ids,
    context_turns,
    http_failure,
    labels_in,
    load_global_model,
    load_grounding,
    offered_rule_version_ids,
    offered_skill_version_ids,
    query_language_for,
)
from invana.plugins.sdk.errors import CannotAnswer, Converse, NeedsInput, TaskFailure
from invana.plugins.sdk.manifest import Arg, Bound, Entry, Type

#: Every loaded task type, by key. The closed set.
CATALOGUE: dict[str, Entry] = dict(load_plugins().tasks)

#: What the interpreter dispatches — derived, never authored beside CATALOGUE.
TASKS = {key: entry.run for key, entry in CATALOGUE.items()}

__all__ = [
    "CATALOGUE",
    "TASKS",
    "Arg",
    "Bound",
    "CannotAnswer",
    "Converse",
    "Entry",
    "LoadVars",
    "NeedsInput",
    "Out",
    "RunVars",
    "TaskContext",
    "TaskFailure",
    "Type",
    "apply_stitches",
    "await_delegations",
    "check_bundle",
    "cited_rule_version_ids",
    "commit_stitches",
    "context_turns",
    "create_task",
    "delegate",
    "execute_graph_query",
    "http_failure",
    "labels_in",
    "load_global_model",
    "load_grounding",
    "offered_rule_version_ids",
    "offered_skill_version_ids",
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
