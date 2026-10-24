"""The catalogue — the **closed** set of task types a plan may name
(docs/for-developers/orchestration.md §0.6).

Task types are declared in plugins (:mod:`invana.plugins`), one folder each, and
this package is the runtime's view of them: ``CATALOGUE`` is every loaded task
type by key, ``TASKS`` the dispatch table derived from it. The set is closed
**per process** — the plugin registry is built once at start-up and frozen —
which is what makes a plan checkable before it runs.

``TASKS`` is a plain dict so a test may substitute one step; ``CATALOGUE`` is a
copy of the frozen registry's mapping, never authored beside it.

The keys are the plan vocabulary, ``namespace.verb``, and are **not** module
paths: they are stored in ``task_runs.task_key`` and read by Studio, so they do
not change when a task type moves between plugins.
"""

from __future__ import annotations

from invana.plugins import load_plugins
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


def sync() -> None:
    """Re-derive ``CATALOGUE`` and ``TASKS`` in place from the registry as it now stands.

    Called once at start-up, after :func:`invana.plugins.install_mcp` has added
    the MCP plugins — the two dicts are imported by name everywhere, so they
    are updated rather than rebound.
    """
    tasks = load_plugins().tasks
    for key in [k for k in CATALOGUE if k not in tasks]:
        del CATALOGUE[key]
        TASKS.pop(key, None)
    for key, entry in tasks.items():
        if CATALOGUE.get(key) is not entry:
            CATALOGUE[key] = entry
            TASKS[key] = entry.run


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
    "cited_rule_version_ids",
    "context_turns",
    "http_failure",
    "labels_in",
    "load_global_model",
    "load_grounding",
    "offered_rule_version_ids",
    "offered_skill_version_ids",
    "query_language_for",
    "sync",
]
