"""``run_envelope()`` — the one place a task type is called.

Every executor ends here. The ``inline`` executor calls it in the API process
with the run's live objects; a distributed worker calls it after pulling an
envelope off its queue, with a context rebuilt from the envelope's ids. Same
function, same checks, so single-machine and distributed runs behave alike.

What it does, in order:

1. **Resolve** ``envelope.task`` (``key@version`` or a bare key) to a task type.
   A key this process has not loaded, or a version it does not carry, is a
   ``defect`` failure — a worker never guesses a neighbouring version.
2. **Open** the context through a :class:`Contexts` source. The source owns
   the DB session and everything else live; ``run_envelope`` never builds one.
3. **Stamp** the idempotency key on the context, so a write task type can tell
   a redelivery of an attempt it already wrote from a new attempt.
4. **Call** the task type, under its manifest's ``timeout_s`` when it declares
   one. An ``HTTPException`` from the graph layer becomes a ``blocked``
   failure with a diagnosis, never a crashed run.

Signals (``NeedsInput``, ``CannotAnswer``, ``Converse``) and ``TaskFailure``
propagate unchanged — deciding what they mean is the orchestrator's job, not
the worker's.

Usage::

    from invana.plugins.worker import run_envelope

    out = await run_envelope(envelope, contexts=source)   # registry resolves the task type
    out = await run_envelope(envelope, contexts=source, resolve=lambda env: TASKS.get(env.key))
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from contextlib import AbstractAsyncContextManager
from typing import Protocol

from fastapi import HTTPException

from invana.plugins import load_plugins
from invana.plugins.envelope import TaskEnvelope
from invana.plugins.sdk.context import Out, RunVars, TaskContext, http_failure
from invana.plugins.sdk.errors import TaskFailure

TaskFn = Callable[[TaskContext, RunVars], Awaitable[Out]]


class Contexts(Protocol):
    """Where a worker gets the live world an envelope's ids name."""

    def open(self, envelope: TaskEnvelope) -> AbstractAsyncContextManager[tuple[TaskContext, RunVars]]: ...


def _registered(envelope: TaskEnvelope) -> TaskFn | None:
    manifest = load_plugins().task(envelope.task)
    return manifest.run if manifest else None


def _timeout_s(envelope: TaskEnvelope) -> float | None:
    manifest = load_plugins().task(envelope.task)
    return float(manifest.timeout_s) if manifest and manifest.timeout_s else None


def _secrets(envelope: TaskEnvelope) -> tuple[str, ...]:
    """The secret names the task type's plugin declares — all ``ctx.secret`` will hand out."""
    registry = load_plugins()
    manifest = registry.task(envelope.task)
    plugin = registry.plugins.get(manifest.plugin) if manifest else None
    return plugin.manifest.secrets if plugin else ()


async def run_envelope(
    envelope: TaskEnvelope,
    *,
    contexts: Contexts,
    resolve: Callable[[TaskEnvelope], TaskFn | None] | None = None,
) -> Out:
    """Run one envelope's task type against the context ``contexts`` opens for it.

    ``resolve`` defaults to the frozen plugin registry; the inline executor
    passes the runtime's dispatch table instead, which is the seam tests
    substitute a step on.
    """
    run = (resolve or _registered)(envelope)
    if run is None:
        raise TaskFailure(
            cls="defect",
            cause="unknown_task_type",
            message=f"This worker does not carry the task type '{envelope.task}'.",
            short="unknown task type",
            evidence={"task": envelope.task, "plugin": envelope.plugin},
        )
    timeout_s = _timeout_s(envelope)
    async with contexts.open(envelope) as (ctx, v):
        ctx.idempotency_key = envelope.idempotency_key
        ctx.secrets = _secrets(envelope)
        limit = asyncio.timeout(timeout_s)
        try:
            async with limit:
                return await run(ctx, v)
        except HTTPException as exc:
            raise http_failure(exc) from exc
        except TimeoutError as exc:
            if not limit.expired():
                raise
            raise TaskFailure(
                cls="transient",
                cause="task_timeout",
                message=f"The step did not finish within its {timeout_s:g}s limit.",
                short="timed out",
                evidence={"timeout_s": timeout_s},
            ) from exc
