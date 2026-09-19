"""``result.json`` — the one document every task run and every run records
(docs/for-developers/modules/operate/features/see-what-ran.md SR17 · SR38 · SR39).

**A task never writes one.** A catalogue entry returns ``Out``; this module
turns the settled row into the document, so a new entry ships ``result.json``
by existing and none of them can ship a different shape (SR38).

``outputs`` is filtered to what the entry **declares**
(docs/for-developers/orchestration.md §0.6). That filter is what makes the
document a contract rather than a dump of internals: a key a step recorded
about itself — an LLM step's ``prompt`` and ``completion`` (SR42), a
``cannot_answer`` reason — stays on ``output``, where a reader can still see it
and a plan still cannot bind it.

Every key is **omitted when there is nothing to put in it** (SR34). A task that
listed no artifacts has no ``artifacts`` key, not an empty list.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from invana.runtime.catalogue import CATALOGUE
from invana.runtime.models import TaskRun


def _ms(start: datetime | None, end: datetime | None) -> int | None:
    if start is None or end is None:
        return None
    return int((end - start).total_seconds() * 1000)


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value is not None else None


def declared_outputs(task_key: str, output: dict | None) -> dict[str, Any]:
    """What this row produced, narrowed to what its entry promises.

    An entry the catalogue does not know — a row from a plan that predates it —
    contributes nothing rather than everything: the declaration is the contract,
    and a key nothing declares was never part of it.
    """
    entry = CATALOGUE.get(task_key)
    if entry is None or not output:
        return {}
    return {key: value for key, value in output.items() if key in entry.outputs}


def step_result(row: TaskRun, *, artifacts: list[dict] | None = None) -> dict[str, Any]:
    """``result.json`` for one task run, from the row as it settled (SR38)."""
    timing = {
        "started_at": _iso(row.started_at),
        "finished_at": _iso(row.finished_at),
        "duration_ms": _ms(row.started_at, row.finished_at),
    }
    result: dict[str, Any] = {
        "status": row.status,
        "task_key": row.task_key,
        "timing": {key: value for key, value in timing.items() if value is not None},
    }
    if row.step_key:
        result["step_key"] = row.step_key
    if row.attempt > 1:
        result["attempt"] = row.attempt
    outputs = declared_outputs(row.task_key, row.output)
    if outputs:
        result["outputs"] = outputs
    if artifacts:
        result["artifacts"] = list(artifacts)
    if row.tokens_in or row.tokens_out:
        result["tokens"] = {"in": row.tokens_in or 0, "out": row.tokens_out or 0}
    if row.cost_usd is not None:
        result["cost_usd"] = row.cost_usd
    if row.error:
        result["error"] = row.error
    return result


def run_result(run: TaskRun, steps: list[TaskRun]) -> dict[str, Any]:
    """The run's own — a roll-up of its tasks, never a copy of them (SR39).

    One line per task and its artifacts in the order they were produced. A
    task's full document is not merged up, because it is already addressable at
    its own dashboard.
    """
    timing = {
        "started_at": _iso(run.started_at),
        "finished_at": _iso(run.finished_at),
        "duration_ms": _ms(run.started_at, run.finished_at),
    }
    tasks: list[dict[str, Any]] = []
    artifacts: list[dict] = []
    for step in steps:
        line: dict[str, Any] = {
            "task_key": step.task_key,
            "status": step.status,
        }
        if step.step_key:
            line["step_key"] = step.step_key
        duration = _ms(step.started_at, step.finished_at)
        if duration is not None:
            line["duration_ms"] = duration
        outputs = (step.result or {}).get("outputs") or declared_outputs(step.task_key, step.output)
        if outputs:
            line["outputs"] = outputs
        tasks.append(line)
        artifacts.extend((step.result or {}).get("artifacts") or [])

    result: dict[str, Any] = {
        "status": run.status,
        "timing": {key: value for key, value in timing.items() if value is not None},
    }
    if run.outcome:
        result["outcome"] = run.outcome
    tokens_in = sum(step.tokens_in or 0 for step in steps)
    tokens_out = sum(step.tokens_out or 0 for step in steps)
    if tokens_in or tokens_out:
        result["tokens"] = {"in": tokens_in, "out": tokens_out}
    priced = [step.cost_usd for step in steps if step.cost_usd is not None]
    if priced:
        result["cost_usd"] = round(sum(priced), 6)
    if tasks:
        result["tasks"] = tasks
    if artifacts:
        result["artifacts"] = artifacts
    if run.error:
        result["error"] = run.error
    return result
