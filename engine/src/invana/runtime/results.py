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
from invana.runtime.models import RunStatus, TaskRun, span_ms, token_sum


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
    its own board.
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


def step_progress(nodes: list[TaskRun]) -> tuple[int, int]:
    """How far a run has got, as ``(done, total)``: the attempts that succeeded,
    and the plan's length as far as its nodes reach — the journal row's rule."""
    done = sum(1 for n in nodes if n.status == RunStatus.succeeded.value)
    total = max((n.seq + 1 for n in nodes), default=0)
    return done, total


def run_tokens(run: TaskRun, nodes: list[TaskRun]) -> tuple[int, int]:
    """A root's spend: its own tokens plus its direct nodes', as ``(in, out)``.

    A delegated run's spend is inside the node that delegated it, so only the
    direct nodes are added. The run list reads this while a run is still going;
    once it settles, the same numbers are stored on the root.
    """
    rows = [run, *nodes]
    return sum(r.tokens_in or 0 for r in rows), sum(r.tokens_out or 0 for r in rows)


def roll_up_run(run: TaskRun, nodes: list[TaskRun]) -> None:
    """Write how a settled run's time and tokens were spent onto the run itself.

    Called wherever a root run finishes, beside its cost, from the same node
    list. Its tokens (``run_tokens_in`` · ``run_tokens_out`` · ``run_tokens``,
    see :func:`run_tokens`), and three times, each over the run's direct nodes
    in plan order:

    - ``work_ms`` — what the nodes did. A node paused on a person
      (``needs_input``) is the wait, not work.
    - ``ask_ms`` — from each paused node's finish to the next node's start: the
      time a person took to answer.
    - ``wait_ms`` — the run's own span less its work: open, and no node working.

    A run that never started has none of them. Delegated runs are not counted
    twice — their time is inside the node that delegated them.
    """
    spent_in, spent_out = run_tokens(run, nodes)
    run.run_tokens_in, run.run_tokens_out = spent_in, spent_out
    run.run_tokens = token_sum(spent_in or None, spent_out or None)
    duration = span_ms(run.started_at, run.finished_at)
    if duration is None:
        run.work_ms = run.ask_ms = run.wait_ms = None
        return
    paused = RunStatus.needs_input.value
    work = sum(span_ms(n.started_at, n.finished_at) or 0 for n in nodes if n.status != paused)
    ask = 0
    for i, node in enumerate(nodes):
        if node.status != paused or node.finished_at is None:
            continue
        resumed = next((later for later in nodes[i + 1 :] if later.started_at is not None), None)
        if resumed is not None:
            ask += span_ms(node.finished_at, resumed.started_at) or 0
    run.work_ms = work
    run.ask_ms = ask
    run.wait_ms = max(0, duration - work)
