"""The query log's writer — off the query's path (the-model-page.md MP35 · MP36 · MP37 · MP38).

The connector hands every finished query that has a caller to ``submit``,
which only queues it. ``run`` drains the queue in batches, works out each
query's shape and what it touched, and inserts the rows in its own session. A
full queue drops the row; a failed batch is logged. Neither reaches the query.

Each batch written is its own trace: a ``system.query_log`` root span (origin
``daemon``) with ``invana.query_log.batch`` the batch size, linked to the span
each query was asked in — the queue carries that context on the query, so a
row's write is reachable from the request or run that caused it without the
write joining that trace. A prune is a ``system.query_log.prune`` root span.
Each write and each prune is also one iteration on the loop metrics
(``query_log`` · ``query_log.prune``), a failure when it raised.

A shape is explained once — the first time this process sees it, with that
call's own parameters (MP38) — and the plan is kept for later calls of it.
The explained row carries the plan's lines so the shape card can read them.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import time
from collections import OrderedDict
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING

from invana.apps.modeller.models import GraphQueryLog
from invana.apps.modeller.query_shapes import shape_of
from invana.apps.modeller.querysets.graph_query_log import GraphQueryLogQuerySet
from invana.core.telemetry.recorders import record_loop
from invana.core.telemetry.spans import mark_error, root_span

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    from invana.core.querylog import ObservedQuery
    from invana.graph.connectors.base.connector import BaseConnector
    from invana.graph.types.plan import ExplainedPlan

logger = logging.getLogger(__name__)

#: Rows older than this are pruned (MP15).
RETENTION = timedelta(days=90)
_BATCH = 200
_PLANS_KEPT = 2000
#: OpenTelemetry's default cap on links per span; more are dropped by the SDK.
_LINKS_KEPT = 128

ConnectorFor = Callable[[str], Awaitable["BaseConnector | None"]]


def _distinct_links(batch: list[ObservedQuery]) -> list:
    """The batch's producer span contexts, one per span, at most ``_LINKS_KEPT``.

    A span context is not hashable (its trace state is a mapping), so it is
    told apart by its trace and span ids.
    """
    seen: dict[tuple[int, int], object] = {}
    for q in batch:
        ctx = q.span_context
        if ctx is not None and len(seen) < _LINKS_KEPT:
            seen.setdefault((ctx.trace_id, ctx.span_id), ctx)
    return list(seen.values())


class QueryLogWriter:
    """Queues finished queries and writes them to the query log in batches.

    Usage
    -----
        writer = QueryLogWriter(session_factory, connector_for)
        set_query_observer(writer.submit)        # the connector hands queries over
        task = asyncio.create_task(writer.run())  # drains forever
        ...
        await writer.drain()                      # a test or caller reading rows back

    ``submit`` never blocks or raises; ``write`` and ``prune`` log a failure and
    carry on. Each write and prune opens its own root span, because the task
    that runs them is started once and would otherwise attach every batch to
    whatever trace was current at that moment.
    """

    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        connector_for: ConnectorFor,
        *,
        maxsize: int = 10_000,
    ) -> None:
        self._factory = session_factory
        self._connector_for = connector_for
        self._queue: asyncio.Queue[ObservedQuery] = asyncio.Queue(maxsize=maxsize)
        self._plans: OrderedDict[tuple[str, str], ExplainedPlan | None] = OrderedDict()
        self._log = GraphQueryLogQuerySet()
        self.dropped = 0

    def submit(self, query: ObservedQuery) -> None:
        """Queue one finished query. Never blocks, never raises."""
        try:
            self._queue.put_nowait(query)
        except asyncio.QueueFull:
            self.dropped += 1

    async def run(self) -> None:
        """Drain forever: batches as they come, a prune a day."""
        await self.prune()
        pruned_at = datetime.now(UTC)
        while True:
            batch = [await self._queue.get()]
            while len(batch) < _BATCH and not self._queue.empty():
                batch.append(self._queue.get_nowait())
            await self.write(batch)
            if datetime.now(UTC) - pruned_at > timedelta(days=1):
                await self.prune()
                pruned_at = datetime.now(UTC)

    async def drain(self) -> None:
        """Write everything queued now — for a caller that must read it back."""
        batch = []
        while not self._queue.empty():
            batch.append(self._queue.get_nowait())
        if batch:
            await self.write(batch)

    async def write(self, batch: list[ObservedQuery]) -> None:
        """Insert one batch of rows in its own session, inside its own trace.

        The ``system.query_log`` root span links to the span each query was
        asked in — the first ``_LINKS_KEPT`` distinct ones, the SDK's cap — so
        the write can be found from the query without joining its trace. A
        failure is logged, marks the span failed, and is not raised.
        """
        links = _distinct_links(batch)
        with root_span(
            "system.query_log",
            origin="daemon",
            attributes={"invana.query_log.batch": len(batch)},
            links=links,
        ) as s:
            started, failed = time.perf_counter(), False
            try:
                rows = [await self._row(q) for q in batch]
                async with self._factory() as session:
                    await self._log.add_many(session, rows)
                    await session.commit()
            except Exception as exc:
                failed = True
                mark_error(s, exc)
                logger.warning("%d graph queries were not logged", len(batch), exc_info=True)
            record_loop(loop="query_log", duration_s=time.perf_counter() - started, failed=failed)

    async def prune(self) -> None:
        """Delete rows older than ``RETENTION``, inside its own trace.

        A failure is logged, marks the ``system.query_log.prune`` span failed,
        and is not raised.
        """
        with root_span("system.query_log.prune", origin="daemon") as s:
            started, failed = time.perf_counter(), False
            try:
                async with self._factory() as session:
                    await self._log.prune(session, datetime.now(UTC) - RETENTION)
                    await session.commit()
            except Exception as exc:
                failed = True
                mark_error(s, exc)
                logger.warning("The query log was not pruned", exc_info=True)
            record_loop(loop="query_log.prune", duration_s=time.perf_counter() - started, failed=failed)

    async def _row(self, q: ObservedQuery) -> GraphQueryLog:
        shape_hash, shape_text = shape_of(q.query)
        plan, first = await self._plan(q, shape_hash)
        if plan is not None:
            types = {"nodes": sorted(plan.node_labels), "edges": sorted(plan.edge_labels)}
            touched: dict | None = {
                "filtered": sorted(plan.filtered),
                "returned": sorted(plan.returned),
                "ordered": sorted(plan.ordered),
                "scanned": sorted(plan.scanned),
            }
            if first:
                touched["plan"] = plan.lines
        else:
            types = {"nodes": sorted(q.node_labels), "edges": sorted(q.edge_labels)}
            touched = None
        return GraphQueryLog(
            graph_id=q.caller.graph_id,
            at=q.at,
            shape_hash=shape_hash,
            shape_text=shape_text,
            language=q.language,
            caller_kind=q.caller.kind,
            caller_id=q.caller.caller_id,
            task_run_id=q.caller.task_run_id,
            duration_ms=round(q.duration_ms, 3),
            rows=q.rows,
            ok=q.ok,
            types_touched=types,
            properties_touched=touched,
            touched_from="plan" if plan is not None else "results",
        )

    async def _plan(self, q: ObservedQuery, shape_hash: str) -> tuple[ExplainedPlan | None, bool]:
        """The shape's plan, explained the first time it is seen (MP38); ``(plan, first)``."""
        key = (q.caller.graph_id, shape_hash)
        if key in self._plans:
            self._plans.move_to_end(key)
            return self._plans[key], False
        plan = None
        # A failed query has no plan worth reading; it is asked again on its next call.
        if q.ok:
            with contextlib.suppress(Exception):
                connector = await self._connector_for(q.caller.graph_id)
                if connector is not None:
                    plan = await connector.explain(q.query, q.parameters)
            self._plans[key] = plan
            if len(self._plans) > _PLANS_KEPT:
                self._plans.popitem(last=False)
        return plan, plan is not None
