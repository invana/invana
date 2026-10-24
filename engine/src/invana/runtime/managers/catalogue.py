"""The catalogue, as a person reads it (docs/for-developers/modules/workflows/features/the-catalogue.md).

Band 3, because the declaration is the runtime's: the read is the registry
rendered, plus what only a Graph can answer — how many of its reusable plans
name each entry, and, on a function's page, which plans and skills name it and
how its calls went. Nothing here adds, edits or disables an entry.

The registry is in memory, so the list is narrowed here and paged by
:func:`page_of_rows` over the entry's key, which is unique::

    catalogue = CatalogueManager()
    entries, info = await catalogue.page(session, graph_id=graph.id, params=params)
    fn = await catalogue.function(session, graph_id=graph.id, key="graph.read.query")
    calls, info = await catalogue.calls(session, graph_id=graph.id, key="graph.read.query", params=params)

**A function's numbers are its steps', in this Graph.** *Calls* counts the run
steps naming the function queued in the last ``days`` UTC calendar days, eval
runs left out; *p95* is queued-to-finished over the settled ones; *failed* is
failed over settled. The prior window is the same length just before, and each
change is :mod:`invana.core.metrics`' reading of the two.
"""

from __future__ import annotations

from datetime import UTC, datetime, time, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.flows.querysets import FlowQuerySet
from invana.apps.work.models import Task as Todo
from invana.core.errors import NotFoundError
from invana.core.lists import ListParams, PageInfo, page_of_rows
from invana.core.metrics import change_of, points_change_of
from invana.core.utils import percentile
from invana.plugins import load_plugins
from invana.plugins.sdk.manifest import Bound, Entry
from invana.runtime.catalogue import CATALOGUE
from invana.runtime.managers.run_stats import run_title
from invana.runtime.models import RunStatus, span_ms
from invana.runtime.querysets.plugins import FunctionUsageQuerySet
from invana.runtime.schemas import (
    CatalogueArgRead,
    CatalogueEntryRead,
    CatalogueOutputRead,
    FunctionCallRead,
    FunctionCallsRead,
    FunctionPlanRef,
    FunctionRead,
    FunctionSkillRef,
)

_BOUND_ORDER = {bound.value: i for i, bound in enumerate(Bound)}
_SETTLED = frozenset({RunStatus.succeeded.value, RunStatus.failed.value})

#: The window a function's page counts its calls over, in UTC days.
CALLS_WINDOW_DAYS = 30


def _aware(at: datetime) -> datetime:
    return at if at.tzinfo else at.replace(tzinfo=UTC)


def _wall(queued_at: datetime, queue_ms: int | None, duration_ms: int | None, finished_at: datetime | None):
    """Queued to finished, from the stored columns — :func:`invana.runtime.models.wall_ms` over a row's facts."""
    if finished_at is None:
        return None
    if queue_ms is not None and duration_ms is not None:
        return queue_ms + duration_ms
    return span_ms(queued_at, finished_at)


class _Window:
    """The calls of one window: how many, and the settled ones' times and failures."""

    def __init__(self) -> None:
        self.calls = 0
        self.settled = 0
        self.failed = 0
        self.ms: list[float] = []

    def add(self, status: str, wall: int | None) -> None:
        self.calls += 1
        if status not in _SETTLED:
            return
        self.settled += 1
        self.failed += status == RunStatus.failed.value
        if wall is not None:
            self.ms.append(wall)

    @property
    def p95(self) -> float | None:
        return percentile(self.ms, 0.95)

    @property
    def failed_rate(self) -> float | None:
        return self.failed / self.settled if self.settled else None


def _entry_read(entry: Entry, used_by: int) -> CatalogueEntryRead:
    return CatalogueEntryRead(
        step_key=entry.key,
        bound=entry.bound.value,
        summary=entry.summary,
        args=[
            CatalogueArgRead(name=name, type=arg.type.value, required=arg.required, default=arg.default)
            for name, arg in entry.args.items()
        ],
        outputs=[
            CatalogueOutputRead(name=name, type=type_.value, rollup=type_.aggregation)
            for name, type_ in entry.outputs.items()
        ],
        requires=list(entry.requires),
        used_by=used_by,
        plugin=entry.plugin,
    )


class CatalogueManager:
    plans = FlowQuerySet()
    usage = FunctionUsageQuerySet()

    async def page(
        self, session: AsyncSession, *, graph_id: str, params: ListParams
    ) -> tuple[list[CatalogueEntryRead], PageInfo]:
        """One page of the catalogue, searched, filtered and sorted by ``params``.

        Sorting by ``bound`` groups the entries in the bound's declared order,
        then by key; ``key`` sorts by key alone.
        """
        entries = list(CATALOGUE.values())
        rows = entries
        if bounds := params.values("bound"):
            rows = [e for e in rows if e.bound.value in bounds]
        if plugins := params.values("plugin"):
            rows = [e for e in rows if e.plugin in plugins]
        if params.q:
            q = params.q.lower()
            rows = [e for e in rows if q in e.key.lower() or q in e.summary.lower()]
        page, info = page_of_rows(
            rows,
            params,
            unfiltered_total=len(entries),
            sorts={"bound": lambda e: _BOUND_ORDER[e.bound.value], "key": lambda e: e.key},
            id_of=lambda e: e.key,
        )
        used = await self.plans.step_key_usage(session, graph_id=graph_id) if page else {}
        return [_entry_read(entry, used.get(entry.key, 0)) for entry in page], info

    @staticmethod
    def _entry(key: str) -> Entry:
        entry = CATALOGUE.get(key)
        if entry is None:
            raise NotFoundError(f"No function named {key}.")
        return entry

    async def function(
        self, session: AsyncSession, *, graph_id: str, key: str, now: datetime | None = None
    ) -> FunctionRead:
        """One function's page: its entry and manifest, the plans and skills naming it, its calls.

        ``used_by`` is how many plan keys ``plans`` lists, the same count the
        list shows. 404 when no loaded plugin declares ``key``.
        """
        entry = self._entry(key)
        plugin = load_plugins().plugins[entry.plugin].manifest
        plans = await self.usage.plans_naming(session, graph_id=graph_id, key=key)
        skills = await self.usage.skills_needing(session, graph_id=graph_id, key=key)
        read = _entry_read(entry, len(plans))
        return FunctionRead(
            **read.model_dump(exclude={"plugin"}),
            plugin=f"{plugin.name}@{plugin.version}",
            version=entry.version,
            side_effect=entry.side_effect.value,
            resources=[r.value for r in entry.resources],
            timeout_s=entry.timeout_s,
            retries=entry.retries,
            plans=[FunctionPlanRef(id=p.id, key=p.key or "", name=p.name, origin=p.origin) for p in plans],
            needed_by=[FunctionSkillRef(skill_id=s.id, name=s.name, version=v) for s, v in skills],
            calls=await self._calls_read(session, graph_id=graph_id, key=key, now=now),
        )

    async def _calls_read(
        self, session: AsyncSession, *, graph_id: str, key: str, now: datetime | None
    ) -> FunctionCallsRead:
        """The window ending today against the one before it."""
        today = _aware(now or datetime.now(UTC)).astimezone(UTC).date()
        days = CALLS_WINDOW_DAYS
        since = datetime.combine(today - timedelta(days=days - 1), time.min, tzinfo=UTC)
        prior_since = since - timedelta(days=days)
        current, prior = _Window(), _Window()
        facts = await self.usage.call_facts_since(session, graph_id=graph_id, key=key, since=prior_since)
        for status, queued_at, queue_ms, duration_ms, finished_at in facts:
            window = current if _aware(queued_at) >= since else prior
            window.add(status, _wall(queued_at, queue_ms, duration_ms, finished_at))
        return FunctionCallsRead(
            days=days,
            since=since,
            calls=current.calls,
            calls_prior=prior.calls,
            calls_change=change_of(current.calls, prior.calls, higher_is_better=None),
            p95_ms=current.p95,
            p95_prior_ms=prior.p95,
            p95_change=change_of(current.p95, prior.p95, higher_is_better=False),
            failed=current.failed,
            failed_rate=current.failed_rate,
            failed_rate_prior=prior.failed_rate,
            failed_rate_change=points_change_of(current.failed_rate, prior.failed_rate, higher_is_better=False),
        )

    async def calls(
        self, session: AsyncSession, *, graph_id: str, key: str, params: ListParams
    ) -> tuple[list[FunctionCallRead], PageInfo]:
        """One page of the run steps that called ``key`` in this Graph, newest first.

        A row's title is its run's, as the journal names it. 404 for an unknown key.
        """
        self._entry(key)
        steps, info = await self.usage.page_calls(session, graph_id=graph_id, key=key, params=params)
        runs = await self.usage.runs_by_id(session, sorted({s.parent_run_id for s in steps if s.parent_run_id}))
        todos: dict[str, str | None] = {}
        for run in runs.values():
            if run.todo_id and run.todo_id not in todos:
                todo = await session.get(Todo, run.todo_id)
                todos[run.todo_id] = todo.title if todo is not None else None
        items = []
        for step in steps:
            run = runs.get(step.parent_run_id or "")
            title = run_title(run, todos.get(run.todo_id or "")) if run is not None else step.label
            items.append(
                FunctionCallRead(
                    id=step.id,
                    run_id=step.parent_run_id or step.id,
                    title=title,
                    status=step.status,
                    duration_ms=step.duration_ms,
                    tokens=step.tokens,
                    queued_at=_aware(step.queued_at),
                )
            )
        return items, info
