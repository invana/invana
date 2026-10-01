"""The spans a run leaves in the trace of the action that started it.

A run is worked on an ``asyncio`` task the request spawns, and that task copies
the request's context, so a span opened inside the run is a child of the
request's span with no plumbing. The run may outlive the request; its span
simply ends later than its parent.

What a run produces
-------------------
``invana.run``
    One per run, opened by ``TaskRuntime._run_inner`` around the whole body.
    Parent: the span current when the run was submitted (normally the request's
    SERVER span). Attributes name the run and who it acts for — ``invana.run_id``,
    ``invana.agent_id``, ``invana.run.role``, ``invana.run.kind``,
    ``invana.run.triggered_by``, ``invana.graph_id``, ``invana.principal`` and
    ``invana.on_behalf_of``. The queue wait is two events on it, ``run.queued``
    and ``run.admitted``, rather than a span of its own.

``invana.run.step``
    One per attempt of each step, opened around the task's dispatch. Parent: the
    run's span. A retried step is two spans, one per attempt, told apart by
    ``invana.run.attempt``.

Outcomes are not errors
-----------------------
Both spans carry ``invana.outcome``. A step that cannot answer, converses or
asks back ended the way the product means it to, so its span is **not** marked
an error — only a ``TaskFailure`` (outcome ``failed``) or an unexpected
exception (outcome ``error``) is. Cancellation is ``cancelled`` and not an
error: someone pressed stop. The run's own outcome is set by the loop once it
knows it (``ok`` · ``clarify`` · ``cannot_answer`` · ``conversed`` · ``error``).

Delegation
----------
A delegated child run is submitted from inside the delegating step, so its
``invana.run`` span is already a child of that step's span. It also carries a
**Link** to its parent run's span, so a trace viewer can jump from the child to
the run that asked for it even when the two are drawn far apart. The link needs
the parent run's span context, which the runtime keeps in a dict keyed by run id
while each run span is open (see ``delegation_links``).

Records
-------
The run row stores ``trace_id`` and ``root_span_id`` so the run page can open
its trace. ``trace_id`` is the column default — the trace current when the row
was inserted — and ``root_span_id`` is stamped once the ``invana.run`` span
opens, which also fills ``trace_id`` for a run queued outside any span (a
schedule). The first run span wins: a resumed run's second span overwrites
neither.

Logs
----
A run writes its lifecycle to the ``invana.runtime.interpreter.tracing`` logger,
always from inside its ``invana.run`` span, so each line carries the run's trace
id and the principal · origin · Graph the span bound:

=============================  ========  ==========================================
Line                           Level     When
=============================  ========  ==========================================
``run started``                info      the row is marked running
``run finished``               info      outcome ``ok`` · ``conversed`` · ``cannot_answer``
``run paused for a person``    info      outcome ``clarify`` — it waits on an answer
``run cancelled``              info      someone pressed stop
``run failed``                 error     outcome ``error``, or an exception escaped
=============================  ========  ==========================================

Each pass writes exactly one ending line. Every line names the run in bounded
``extra=`` fields — ``run_id``, ``run_kind``, ``run_role``,
``run_triggered_by`` and, on an ending, ``run_outcome`` and ``run_duration_s``;
a failure adds ``failure_kind`` as ``<cls>·<cause>``. Nothing the run read or
wrote — records, prompts, answers — goes into a log line. An exception escaping
the run is logged once, with its traceback, by ``run_span`` (``failure_kind``
``defect·internal``); the loop then writes no ending line for that pass.

Everything here goes through ``invana.core.telemetry.spans``, so without the
``telemetry`` extra each helper is a no-op and a run behaves exactly the same.
The log lines are written either way.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from invana.core.telemetry.recorders import record_run_step
from invana.core.telemetry.spans import mark_error, span
from invana.runtime.catalogue import CannotAnswer, Converse, NeedsInput, TaskFailure
from invana.runtime.models import TaskRun

log = logging.getLogger(__name__)

# How a pass ended → the line it writes and that line's level.
_ENDINGS: dict[str, tuple[int, str]] = {
    "clarify": (logging.INFO, "run paused for a person"),
    "cancelled": (logging.INFO, "run cancelled"),
    "error": (logging.ERROR, "run failed"),
}

# A step that raised one of these ended as the product intends — not an error.
_STEP_OUTCOMES: tuple[tuple[type[BaseException], str], ...] = (
    (CannotAnswer, "cannot_answer"),
    (Converse, "conversed"),
    (NeedsInput, "needs_input"),
)


def _set_outcome(target: Any, outcome: str) -> None:
    if target is not None:
        target.set_attribute("invana.outcome", outcome)


def run_attributes(th: TaskRun) -> dict[str, Any]:
    """The attributes an ``invana.run`` span opens with, read off the run row."""
    return {
        "invana.run_id": th.id,
        "invana.agent_id": th.agent_id,
        "invana.run.role": th.role,
        "invana.run.kind": th.ask_kind or "todo",
        "invana.run.triggered_by": th.triggered_by,
        "invana.graph_id": th.graph_id,
        "invana.principal": "agent" if th.agent_id else "user",
        "invana.on_behalf_of": th.on_behalf_of_user_id,
    }


def _run_fields(th: TaskRun) -> dict[str, Any]:
    return {
        "run_id": th.id,
        "run_kind": th.ask_kind or "todo",
        "run_role": th.role,
        "run_triggered_by": th.triggered_by,
    }


def _failure_kind(th: TaskRun) -> str:
    error = th.error or {}
    return f"{error.get('cls') or 'defect'}·{error.get('cause') or 'internal'}"


def log_run_started(th: TaskRun) -> None:
    """Write ``run started`` for *th*, once its row is marked running.

    Called from inside the ``invana.run`` span, so the line carries the run's
    trace id. A resumed run writes it again: each pass is started and ended.
    """
    log.info("run started", extra=_run_fields(th))


def log_run_ended(th: TaskRun, outcome: str, duration_s: float) -> None:
    """Write the one ending line of a pass of *th* that ended with *outcome*.

    ``clarify`` is ``run paused for a person``, ``cancelled`` is
    ``run cancelled`` and ``error`` is ``run failed`` at ERROR with
    ``failure_kind`` read from ``th.error`` (``<cls>·<cause>``); every other
    outcome is ``run finished``. *duration_s* is the pass's working time, rounded
    to milliseconds. Not for an exception escaping the run — ``run_span`` logs
    that one with its traceback.
    """
    level, message = _ENDINGS.get(outcome, (logging.INFO, "run finished"))
    extra = {**_run_fields(th), "run_outcome": outcome, "run_duration_s": round(duration_s, 3)}
    if outcome == "error":
        extra["failure_kind"] = _failure_kind(th)
    log.log(level, message, extra=extra)


# Set on an exception once ``log_run_crashed`` has written it.
_CRASH_LOGGED = "_invana_crash_logged"


def log_run_crashed(th: TaskRun, exc: BaseException, duration_s: float) -> None:
    """Write ``run failed`` at ERROR, with *exc*'s traceback, for a run that crashed.

    An exception escaped the run body, so nothing settled the row yet; the kind is
    always ``defect·internal``, which is what the runtime's crash handler then
    writes on the row.
    """
    extra = {
        **_run_fields(th),
        "run_outcome": "error",
        "run_duration_s": round(duration_s, 3),
        "failure_kind": "defect·internal",
    }
    log.error("run failed", extra=extra, exc_info=exc)
    setattr(exc, _CRASH_LOGGED, True)


def crash_logged(exc: BaseException) -> bool:
    """Whether *exc* was already logged by ``log_run_crashed``.

    A crash raised before the run span opened — loading the row, resolving the
    caller — never reaches ``log_run_crashed``; the runtime's crash handler asks
    this to log that one itself, so every crash is one line and never two.
    """
    return getattr(exc, _CRASH_LOGGED, False)


@contextmanager
def run_span(th: TaskRun, *, links: tuple[Any, ...] = ()) -> Iterator[Any]:
    """Open the ``invana.run`` span for *th* and make it current.

    The loop sets the normal outcome itself (``set_current`` in the body). This
    only decides the two endings the body never sees: a cancellation
    (``cancelled``, not an error) and an exception escaping the run
    (``error``, recorded on the span). Both are re-raised — the runtime's own
    handlers still settle the row.

    The escaping exception is also the one place a crash is logged: one
    ``run failed`` line with its traceback, written while the span is still
    current so it carries the run's trace id (see ``log_run_crashed``).
    """
    started = time.perf_counter()
    with span("invana.run", run_attributes(th), links=links, record_errors=False) as s:
        try:
            yield s
        except asyncio.CancelledError:
            _set_outcome(s, "cancelled")
            raise
        except Exception as exc:
            _set_outcome(s, "error")
            mark_error(s, exc)
            log_run_crashed(th, exc, time.perf_counter() - started)
            raise


@contextmanager
def step_span(row: TaskRun, attempt: int) -> Iterator[Any]:
    """Open an ``invana.run.step`` span around one attempt of *row*'s task.

    Sets ``invana.outcome`` from how the dispatch ended — ``ok``, one of the
    control-flow outcomes (``cannot_answer`` · ``conversed`` · ``needs_input``,
    never errors), ``failed`` for a ``TaskFailure``, ``error`` for anything
    else, ``cancelled`` on stop — and always re-raises, so the loop's own
    ``except`` clauses settle the row exactly as before.

    The same attempt is one point on ``invana.runs.step.duration`` with that
    outcome. Its ``step_key`` label is the row's catalogue ``task_key``: a
    plan's own step ids are written by the planner and would not stay bounded.
    """
    attributes = {
        "invana.run_id": row.parent_run_id,
        "invana.run.step_id": row.id,
        "invana.task_key": row.task_key,
        "invana.step_key": row.step_key,
        "invana.run.attempt": attempt,
    }
    outcome = "ok"
    started = time.perf_counter()
    with span("invana.run.step", attributes, record_errors=False) as s:
        try:
            yield s
        except asyncio.CancelledError:
            outcome = "cancelled"
            raise
        except Exception as exc:
            outcome = next((label for cls, label in _STEP_OUTCOMES if isinstance(exc, cls)), None)
            if outcome is None:
                outcome = "failed" if isinstance(exc, TaskFailure) else "error"
                mark_error(s, exc)
            raise
        finally:
            _set_outcome(s, outcome)
            record_run_step(step_key=row.task_key, outcome=outcome, duration_s=time.perf_counter() - started)


async def delegation_links(db: AsyncSession, th: TaskRun, open_runs: Mapping[str, Any]) -> tuple[Any, ...]:
    """The Link a delegated run's span carries to its parent run's span.

    A delegated child names the delegating **step** as its ``parent_run_id``;
    that step's own ``parent_run_id`` is the parent run. *open_runs* maps the id
    of every run whose span is open in this process to its span context. A root
    run, a parent that is not open here (another worker, or already settled), or
    no telemetry at all each give no link — the child span is still a child of
    the step that submitted it.
    """
    if not th.parent_run_id or not open_runs:
        return ()
    parent = await db.get(TaskRun, th.parent_run_id)
    if parent is None:
        return ()
    for candidate in (parent.parent_run_id, parent.id):
        ctx = open_runs.get(candidate) if candidate else None
        if ctx is not None:
            return (ctx,)
    return ()
