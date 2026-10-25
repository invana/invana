"""The journal's tiles — counted over the runs, never over a page of them.

The Runs journal draws *In flight*, *Today*, *Tokens today* and *Slowest*; the
Imports page draws its counts, a median time and *Imports a day*. Every one of
those is a fact about **all** the root runs the journal would list in a window,
so they are counted here rather than in Studio over the fifty newest rows it
happened to load.

The window is the reader's days. Studio sends its IANA time zone; *today* is
from midnight there, and a day bucket is a calendar day there, so a run queued
at 23:30 in Lisbon lands on the day a person in Lisbon would say it ran.

Usage::

    stats = await RunStatsManager().stats(
        session, graph_ids=[graph.id], kinds=None, days=1, tz="Europe/Lisbon"
    )
    stats.slowest  # SlowestRun(run_id=..., title=..., duration_ms=...)
"""

from __future__ import annotations

import statistics
from collections import Counter
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.work.models import Task as Todo
from invana.core.errors import ValidationError
from invana.runtime.models import INTERACTIVE, ExitReason, RunStatus, TaskRun, span_ms
from invana.runtime.querysets import TaskRunQuerySet
from invana.runtime.querysets.task_run import RUN_STATE_STATUSES
from invana.runtime.schemas import RunDay, RunStats, SlowestRun

#: Standing statuses — counted now, whatever the window.
LIVE = [RunStatus.queued.value, RunStatus.running.value, RunStatus.awaiting_input.value]
#: The live runs that are waiting on a person rather than on the engine.
WAITING = [RunStatus.awaiting_input.value]
#: The longest window a reader may ask for.
MAX_DAYS = 90


def run_title(run: TaskRun, task_title: str | None = None) -> str:
    """What a run is called on a journal row: a load's dataset and target, else
    the words its opener wrote, else the task it carries out, else its plan."""
    if run.ask_kind in ("import", "bulk"):
        return run.body or "records removed"
    if run.body and run.body.strip():
        return run.body.strip()
    if task_title:
        return task_title
    origin = run.plan_origin or ""
    if origin.startswith("template:"):
        return origin.removeprefix("template:")
    if origin == "generated":
        return f"{run.flow_key} · planned"
    return run.flow_key


class RunStatsManager:
    """Counts the journal's tiles over every root run in a window."""

    def __init__(self) -> None:
        self.runs_qs = TaskRunQuerySet()

    async def stats(
        self,
        session: AsyncSession,
        *,
        graph_ids: list[str],
        kinds: list[str] | None,
        days: int,
        tz: str,
        now: datetime | None = None,
        waiting_approvals: int = 0,
    ) -> RunStats:
        """The tiles for the root runs in *graph_ids*, over the last *days* of *tz*.

        ``days=1`` is today. *Live* and *waiting* are counted now, whatever the
        window. A run's time is its stored ``duration_ms``; a run still going is
        timed to *now*, so a long run in flight can be the slowest — but a run
        waiting on a person is not timed at all. Tokens are a
        settled run's stored ``run_tokens``, or its own and its nodes' so far.
        *Served* and *not served* are counted over the window's ended runs by
        their recorded exit reason; a run that recorded none is in neither.
        ``waiting_approvals`` is the reader's pending asks, counted by the caller
        — approvals belong to a band above this one.
        Raises ``ValidationError`` for an unknown zone or a window out of range.
        """
        if not 1 <= days <= MAX_DAYS:
            raise ValidationError(f"days must be between 1 and {MAX_DAYS}.")
        try:
            zone = ZoneInfo(tz)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise ValidationError(f"Unknown time zone: {tz}.") from exc
        now = (now or datetime.now(UTC)).astimezone(zone)
        first_day = now.date() - timedelta(days=days - 1)
        since = datetime.combine(first_day, time.min, zone).astimezone(UTC)

        live = await self.runs_qs.journal_roots(
            session, graph_ids=graph_ids, kinds=kinds, exclude_triggers=INTERACTIVE, statuses=LIVE
        )
        window = await self.runs_qs.journal_roots(
            session, graph_ids=graph_ids, kinds=kinds, exclude_triggers=INTERACTIVE, since=since
        )

        unsettled = [r.id for r in window if r.run_tokens is None]
        so_far = await self.runs_qs.node_tokens(session, run_ids=unsettled)
        spent = {
            r.id: r.run_tokens if r.run_tokens is not None else (r.tokens or 0) + so_far.get(r.id, 0) for r in window
        }

        timed = {r.id: self._elapsed(r, now) for r in window}
        slowest_run = max((r for r in window if timed[r.id] is not None), key=lambda r: timed[r.id], default=None)
        finished = sorted(r.duration_ms for r in window if r.status not in LIVE and r.duration_ms is not None)

        reasons = Counter(
            r.exit_reason for r in window if r.status in RUN_STATE_STATUSES["ended"] and r.exit_reason is not None
        )
        served = reasons.pop(ExitReason.served.value, 0)

        by_day: dict[date, int] = {first_day + timedelta(days=i): 0 for i in range(days)}
        for run in window:
            queued = run.queued_at if run.queued_at.tzinfo else run.queued_at.replace(tzinfo=UTC)
            day = queued.astimezone(zone).date()
            if day in by_day:
                by_day[day] += 1

        return RunStats(
            days=days,
            since=since,
            live=len(live),
            waiting=sum(1 for r in live if r.status in WAITING),
            runs=len(window),
            succeeded=sum(1 for r in window if r.status == RunStatus.succeeded.value),
            failed=sum(1 for r in window if r.status == RunStatus.failed.value),
            cannot_answer=sum(1 for r in window if r.outcome == "cannot_answer"),
            tokens=sum(spent.values()),
            spending_runs=sum(1 for n in spent.values() if n > 0),
            median_ms=round(statistics.median(finished)) if finished else None,
            slowest=await self._slowest(session, slowest_run, timed),
            by_day=[RunDay(day=day, runs=n) for day, n in by_day.items()],
            served=served,
            not_served=sum(reasons.values()),
            not_served_by_reason=dict(reasons),
            waiting_approvals=waiting_approvals,
        )

    @staticmethod
    def _elapsed(run: TaskRun, now: datetime) -> int | None:
        """How long a run took, or has taken so far — never the time a person
        has left a question unanswered, which is not the run being slow."""
        if run.status in WAITING:
            return None
        if run.duration_ms is not None:
            return run.duration_ms
        if run.finished_at is None:
            return span_ms(run.started_at, now)
        return None

    @staticmethod
    async def _slowest(session: AsyncSession, run: TaskRun | None, timed: dict[str, int | None]) -> SlowestRun | None:
        if run is None:
            return None
        todo = await session.get(Todo, run.todo_id) if run.todo_id else None
        return SlowestRun(
            run_id=run.id,
            title=run_title(run, todo.title if todo is not None else None),
            duration_ms=timed[run.id] or 0,
        )
