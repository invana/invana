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

Everything here goes through ``invana.core.telemetry.spans``, so without the
``telemetry`` extra each helper is a no-op and a run behaves exactly the same.
"""

from __future__ import annotations

import asyncio
from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from invana.core.telemetry.spans import mark_error, span
from invana.runtime.catalogue import CannotAnswer, Converse, NeedsInput, TaskFailure
from invana.runtime.models import TaskRun

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


@contextmanager
def run_span(th: TaskRun, *, links: tuple[Any, ...] = ()) -> Iterator[Any]:
    """Open the ``invana.run`` span for *th* and make it current.

    The loop sets the normal outcome itself (``set_current`` in the body). This
    only decides the two endings the body never sees: a cancellation
    (``cancelled``, not an error) and an exception escaping the run
    (``error``, recorded on the span). Both are re-raised — the runtime's own
    handlers still settle the row.
    """
    with span("invana.run", run_attributes(th), links=links, record_errors=False) as s:
        try:
            yield s
        except asyncio.CancelledError:
            _set_outcome(s, "cancelled")
            raise
        except Exception as exc:
            _set_outcome(s, "error")
            mark_error(s, exc)
            raise


@contextmanager
def step_span(row: TaskRun, attempt: int) -> Iterator[Any]:
    """Open an ``invana.run.step`` span around one attempt of *row*'s task.

    Sets ``invana.outcome`` from how the dispatch ended — ``ok``, one of the
    control-flow outcomes (``cannot_answer`` · ``conversed`` · ``needs_input``,
    never errors), ``failed`` for a ``TaskFailure``, ``error`` for anything
    else, ``cancelled`` on stop — and always re-raises, so the loop's own
    ``except`` clauses settle the row exactly as before.
    """
    attributes = {
        "invana.run_id": row.parent_run_id,
        "invana.run.step_id": row.id,
        "invana.task_key": row.task_key,
        "invana.step_key": row.step_key,
        "invana.run.attempt": attempt,
    }
    with span("invana.run.step", attributes, record_errors=False) as s:
        try:
            yield s
        except asyncio.CancelledError:
            _set_outcome(s, "cancelled")
            raise
        except Exception as exc:
            outcome = next((label for cls, label in _STEP_OUTCOMES if isinstance(exc, cls)), None)
            if outcome is None:
                outcome = "failed" if isinstance(exc, TaskFailure) else "error"
                mark_error(s, exc)
            _set_outcome(s, outcome)
            raise
        _set_outcome(s, "ok")


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
