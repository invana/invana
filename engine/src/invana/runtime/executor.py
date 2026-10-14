"""The executor — *where* a step runs
(docs/for-developers/modules/platform/features/runtime.md §2,
docs/for-developers/modules/platform/features/distributed-execution.md).

Every step leaves the interpreter as a :class:`~invana.plugins.envelope.TaskEnvelope`
and is called by :func:`~invana.plugins.worker.run_envelope`, whichever
executor carries it. Two context sources feed that one call:

| Source | Used by | The live world comes from |
|---|---|---|
| :class:`InlineContexts` | every step run in the API process | the running pass, handed over as is |
| :class:`RebuiltContexts` | ``invana worker``, a queued tool step | the envelope's ids → :meth:`TaskRuntime.run_vars` |

:func:`_dispatch` decides where one step runs, in this order
(docs/for-developers/modules/platform/features/tool-plugins.md):

| Step | Runs |
|---|---|
| A **tool** or **MCP** plugin's, not enabled | ``blocked · plugin_disabled``, naming ``invana plugins enable`` |
| A tool or MCP plugin's, under ``procrastinate`` | on the ``tools`` queue; the pass polls the outcome row |
| Any other — every core step, every step under ``inline`` | ``run_envelope`` in this process |

Only tool steps go to the queue: core steps hand state to each other on
``RunVars``, which does not cross a process. The ``send`` approval gate is the
interpreter's, before ``_dispatch`` is reached.

Inline dispatch resolves the task type through ``TASKS`` — the seam tests
substitute a step on — so routing through the envelope changes nothing a run
can observe, apart from a manifest's ``timeout_s`` now being applied.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import TYPE_CHECKING

from sqlalchemy.ext.asyncio import AsyncSession

from invana.core.settings import settings
from invana.plugins import load_plugins, queue
from invana.plugins.envelope import TaskEnvelope
from invana.plugins.sdk.manifest import TaskManifest
from invana.plugins.worker import run_envelope
from invana.runtime.catalogue import TASKS, RunVars, TaskContext, TaskFailure
from invana.runtime.managers.plugins import SWITCHABLE, PluginManager
from invana.runtime.models import TaskRun
from invana.runtime.querysets.task_run import TaskRunQuerySet
from invana.runtime.stream import Emitter

if TYPE_CHECKING:
    from invana.runtime.interpreter.loop import TaskRuntime


def envelope_for(row: TaskRun, v: RunVars) -> TaskEnvelope:
    """The envelope for one step row of a run: its ids, its args, its task type."""
    manifest = load_plugins().task(row.task_key)
    plugin = load_plugins().plugins.get(manifest.plugin) if manifest else None
    return TaskEnvelope(
        run_id=row.parent_run_id or row.id,
        node_id=row.id,
        attempt=row.attempt,
        plugin=f"{plugin.manifest.name}@{plugin.manifest.version}" if plugin else "",
        task=f"{manifest.key}@{manifest.version}" if manifest else row.task_key,
        args=dict(row.args or {}),
        graph_id=v.graph.id if v.graph else None,
        lens_id=v.run.lens_id if v.run else None,
        actor_id=v.actor_id or None,
    )


class InlineContexts:
    """Hands ``run_envelope`` the pass's own context — nothing is rebuilt."""

    __slots__ = ("_ctx", "_v")

    def __init__(self, ctx: TaskContext, v: RunVars) -> None:
        self._ctx = ctx
        self._v = v

    @asynccontextmanager
    async def open(self, envelope: TaskEnvelope) -> AsyncIterator[tuple[TaskContext, RunVars]]:
        yield self._ctx, self._v


class RebuiltContexts:
    """Rebuilds a step's context from an envelope's ids, in a fresh session.

    What a worker uses: the run row gives the run's vars through
    :meth:`TaskRuntime.run_vars`, the step row is the envelope's ``node_id``, and
    the emitter appends to the run's stream by id. The session commits when
    the task type returns and rolls back when it raises — the worker owns its
    transaction the way a request does.

    State a step leaves on ``RunVars`` for a later step (``v.query``,
    ``v.result``) does not survive the trip: a later step in another process
    reads only what earlier steps wrote to their outputs.
    """

    __slots__ = ("_runtime",)

    def __init__(self, runtime: TaskRuntime) -> None:
        self._runtime = runtime

    @asynccontextmanager
    async def open(self, envelope: TaskEnvelope) -> AsyncIterator[tuple[TaskContext, RunVars]]:
        runtime = self._runtime
        async with runtime._factory() as db:
            th = await TaskRunQuerySet().get(db, envelope.run_id)
            row = await TaskRunQuerySet().get(db, envelope.node_id)
            if th is None or row is None:
                raise LookupError(f"envelope {envelope.idempotency_key} names a run or step that does not exist")
            v, _ = await runtime.run_vars(db, th)
            row.args = dict(envelope.args)
            emitter = Emitter(runtime._factory, envelope.run_id)
            ctx = TaskContext(db=db, manager=runtime._manager, emitter=emitter, step=row, runtime=runtime)
            try:
                yield ctx, v
            except BaseException:
                await db.rollback()
                raise
            await db.commit()


#: A tool step's own limit when its manifest declares none.
TOOL_TIMEOUT_S = 300
#: How long a queued tool step may wait for a worker on top of its own limit:
#: one reaper cycle (60 s) plus the stall window (10 s), with room to spare,
#: so a job retried off a dead worker still lands inside it.
QUEUE_WAIT_S = 120


def tool_manifest(task_key: str) -> TaskManifest | None:
    """The manifest of ``task_key`` when a **tool** or **MCP** plugin declares it, else None.

    Those are the switchable kinds, and their steps are the ones that run in a worker.
    """
    registry = load_plugins()
    manifest = registry.task(task_key)
    plugin = registry.plugins.get(manifest.plugin) if manifest else None
    return manifest if plugin is not None and plugin.manifest.kind in SWITCHABLE else None


async def refuse_disabled(db: AsyncSession, manifest: TaskManifest) -> None:
    """Raise ``blocked · plugin_disabled`` unless the manifest's plugin is enabled on this install."""
    if await PluginManager().is_enabled(db, manifest.plugin):
        return
    raise TaskFailure(
        cls="blocked",
        cause="plugin_disabled",
        message=(
            f"The plugin {manifest.plugin} is not enabled on this install. "
            f"An install Admin enables it: invana plugins enable {manifest.plugin}"
        ),
        short="plugin disabled",
        evidence={"plugin": manifest.plugin, "task": manifest.key},
    )


async def _dispatch(task_key: str, ctx: TaskContext, v: RunVars):
    """Run one step — on the ``tools`` queue for a tool step under ``procrastinate``, else in-process.

    A tool step whose plugin is not enabled fails before any context opens.
    Queued, the pass commits first, because the worker reads the run and the
    step from their committed rows; the outcome a worker records is raised or
    returned here exactly as the inline call would have.

    Any task that reaches for the graph can raise ``HTTPException`` — a graph
    with no connection, or one that isn't active. ``run_envelope`` turns those
    into a diagnosis with a "Check the connection" route rather than a crashed
    run reading "something went wrong inside the engine".
    """
    manifest = tool_manifest(task_key)
    if manifest is not None:
        await refuse_disabled(ctx.db, manifest)
    envelope = envelope_for(ctx.step, v)
    if manifest is not None and settings.executor == "procrastinate":
        await ctx.db.commit()
        await queue.defer(envelope)
        return await queue.await_outcome(
            envelope,
            session_factory=ctx.runtime._factory,
            timeout_s=(manifest.timeout_s or TOOL_TIMEOUT_S) + QUEUE_WAIT_S,
        )
    return await run_envelope(envelope, contexts=InlineContexts(ctx, v), resolve=lambda _env: TASKS.get(task_key))


# Prior turns replayed as NL context (docs/for-developers/modules/ask/spec.md) — same window as the old path.
