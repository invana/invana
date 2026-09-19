"""How the interpreter renders a step row and a message for the reader
(docs/for-developers/modules/platform/features/runtime.md §15).

Shaping only: no decisions, no IO. Kept beside the loop rather than inside it
so the loop module is the control flow and nothing else.
"""

from __future__ import annotations

import dataclasses
import logging
from datetime import UTC, datetime

from invana.apps.sessions.models import SessionMessage
from invana.runtime.models import TaskRun
from invana.runtime.workflows import Retry

log = logging.getLogger(__name__)


_HISTORY_TURNS = 6


def _now() -> datetime:
    return datetime.now(UTC)


def _ms(start: datetime | None, end: datetime | None) -> int | None:
    if start is None or end is None:
        return None
    return round((end - start).total_seconds() * 1000)


# **The spec declares, the runtime executes** (docs/for-developers/modules/ask/features/when-it-cannot-answer.md). A
# static
# workflow declares retry on its own step, and that still wins. A *planned*
# step has no static definition, so the fallback is keyed by what the task is —
# which is the same policy expressed one level up.
_TRANSIENT_RETRY = Retry(max_attempts=3, on=frozenset({"transient"}))
_RETRY_BY_TASK: dict[str, Retry] = {"execute_graph_query": _TRANSIENT_RETRY}


def _retry_from_plan(plan: dict | None, row: TaskRun) -> Retry | None:
    """The retry policy the plan node declares, read out of the frozen plan.

    Shaping, not IO: the snapshot is already in memory on the run, and it is
    what a replay reads — so a node's policy is read from the same document that
    records what ran. ``tasks.retry`` has existed since M2 and nothing honoured
    it (task-model-migration § 6.5).
    """
    for step in (plan or {}).get("steps") or ():
        if isinstance(step, dict) and step.get("id") == row.step_key:
            declared = step.get("retry")
            if not isinstance(declared, dict) or not declared:
                return None
            fields = {f.name for f in dataclasses.fields(Retry)}
            kwargs = {k: v for k, v in declared.items() if k in fields}
            if "on" in kwargs:
                kwargs["on"] = frozenset(kwargs["on"] or ())
            try:
                return Retry(**kwargs)
            except TypeError:
                # A policy the grammar does not describe is not a reason to
                # refuse the step — it falls through to the default below.
                log.warning("run %s: unreadable retry policy on step %s", row.parent_run_id, row.step_key)
                return None
    return None


def _retry_for(wf, row: TaskRun, plan: dict | None = None) -> Retry:
    """**The plan declares, the runtime executes.**

    Three sources, most specific first: the plan node's own policy, the static
    workflow's declaration for this task, then the per-task default. A planned
    step used to have no way to state one, which is why the fallback existed.
    """
    from_plan = _retry_from_plan(plan, row)
    if from_plan is not None:
        return from_plan
    declared = next((s for s in getattr(wf, "steps", ()) if s.task_key == row.task_key), None)
    if declared is not None:
        return declared.retry
    return _RETRY_BY_TASK.get(row.task_key, Retry())


def _awaiting_detail(options: list[str]) -> str:
    """What a paused step says. Not the question — the reply bubble right above
    the step row already carries it verbatim, options and all
    (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md)."""
    n = len(options)
    return f"{n} option{'' if n == 1 else 's'} offered" if n else "waiting on your answer"


def _step_payload(row: TaskRun) -> dict:
    return {
        "step_id": row.id,
        "message_id": row.message_id,
        "seq": row.seq,
        "plan_step_id": row.step_key,
        "task_key": row.task_key,
        "skills_offered": list(row.skills_offered or []),
        "skills_applied": list(row.skills_applied or []),
        "label": row.label,
        "attempt": row.attempt,
        "status": row.status,
        "detail": row.detail,
        "started_at": row.started_at,
        "finished_at": row.finished_at,
        "duration_ms": _ms(row.started_at, row.finished_at),
        "input": row.input,
        "output": row.output,
        "error": row.error,
        "tokens_in": row.tokens_in,
        "tokens_out": row.tokens_out,
    }


def message_payload(m: SessionMessage) -> dict:
    """The finalized assistant row, as the stream carries it (mirrors SessionMessageRead)."""
    return {
        "id": m.id,
        "session_id": m.session_id,
        "seq": m.seq,
        "role": m.role.value,
        "content": m.content,
        "status": m.status.value if m.status else None,
        "operation": m.operation,
        "mode": m.mode,
        "via": m.via,
        "query_language": m.query_language,
        "source_query": m.source_query,
        "clarification_options": m.clarification_options,
        "feedback": m.feedback,
        "row_count": m.row_count,
        "execution_time_ms": m.execution_time_ms,
        "llm_time_ms": m.llm_time_ms,
        "timeout_s": m.timeout_s,
        "node_count": m.node_count,
        "edge_count": m.edge_count,
        "run_id": m.run_id,
        "created_at": m.created_at,
    }


# What a run *ended as*, said the way a reader would say it
# (docs/for-developers/modules/ask/features/when-it-cannot-answer.md CA1). Only
# `cannot_answer` is not derivable from the status, so it is passed explicitly.
_OUTCOME_BY_STATUS = {
    "succeeded": "answered",
    "failed": "failed",
    "cancelled": "cancelled",
}
