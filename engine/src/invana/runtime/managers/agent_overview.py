"""A live agent's Overview — its numbers, counted from its runs.

Band 3 rather than `apps/agents`, because every number here reads `task_runs`,
which an app may not import (migration-plan §18.1.1).

**What is counted.** The agent's **root** runs — the same rows ``GET …/runs?
f.agent_id=`` lists — with eval runs left out: they spend the Graph's eval
budget and replay the agent rather than serve anyone. A step carries no agent of
its own; it is counted through its root.

**The window** is ``days`` UTC calendar days ending today, so ``daily`` has one
row per day with no partial first day; the prior window is the same length just
before it. ``served`` is Verify's ``yes``; a rate is over the runs Verify gave a
verdict, and null when it gave none — *never reached Verify* is not *did not
serve*. Times are queued-to-finished over settled runs, as on the Agents
Performance page, so the two pages say one p95.

Usage::

    overview = await AgentOverviewManager().overview(session, agent=agent, days=30)
    overview.daily[-1]  # AgentOverviewDay(date=today, runs=..., tokens=...)
"""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import UTC, datetime, time, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.models import Agent
from invana.apps.agents.querysets import AgentQuerySet
from invana.apps.agents.schemas import (
    AgentOverview,
    AgentOverviewDay,
    AgentOverviewExit,
    AgentOverviewModel,
    AgentOverviewRun,
)
from invana.apps.work.models import Task as Todo
from invana.core.utils import percentile
from invana.runtime.managers.run_stats import run_title
from invana.runtime.models import RunStatus, TaskRun, wall_ms
from invana.runtime.querysets import TaskRunQuerySet

#: How many of the newest runs *Recent runs* lists.
RECENT = 10
#: ``nodes_of_many`` is asked in slices, so a long window never builds one
#: ``IN`` list longer than a driver accepts.
_NODE_BATCH = 1000
_SETTLED = frozenset({RunStatus.succeeded.value, RunStatus.failed.value})


def _aware(at: datetime) -> datetime:
    return at if at.tzinfo else at.replace(tzinfo=UTC)


def exit_of(run: TaskRun) -> str:
    """How a run ended: its ``outcome`` when it has one, else its ``status``."""
    return run.outcome or run.status


class _Measured:
    """One root with the facts its steps hold: Verify's verdict, the spend, the models."""

    def __init__(self, root: TaskRun, nodes: list[TaskRun]) -> None:
        self.root = root
        self.at = _aware(root.queued_at)
        verdicts = [(n.output or {}).get("served") for n in nodes if n.task_key == "plan.verify"]
        self.verdict: str | None = next((v for v in reversed(verdicts) if v), None)
        self.tokens = sum((r.tokens_in or 0) + (r.tokens_out or 0) for r in [root, *nodes])
        self.ms: float | None = wall_ms(root) if root.status in _SETTLED else None
        self.models = {m for m in [root.model_version, *(n.model_version for n in nodes)] if m}


def _served_rate(rows: list[_Measured]) -> float | None:
    judged = [r for r in rows if r.verdict is not None]
    return sum(r.verdict == "yes" for r in judged) / len(judged) if judged else None


def _p95(rows: list[_Measured]) -> float | None:
    return percentile([r.ms for r in rows if r.ms is not None], 0.95)


class AgentOverviewManager:
    runs_qs = TaskRunQuerySet()
    agents_qs = AgentQuerySet()

    async def overview(
        self, session: AsyncSession, *, agent: Agent, days: int, now: datetime | None = None
    ) -> AgentOverview:
        """The Overview over ``days`` days ending today, against the ``days`` before."""
        now = _aware(now or datetime.now(UTC)).astimezone(UTC)
        today = now.date()
        since = datetime.combine(today - timedelta(days=days - 1), time.min, tzinfo=UTC)
        prior_since = since - timedelta(days=days)
        month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        roots = await self.runs_qs.agent_roots_since(session, agent_id=agent.id, since=min(prior_since, month))
        measured = await self._measure(session, roots)
        current = [m for m in measured if m.at >= since]
        prior = [m for m in measured if prior_since <= m.at < since]

        by_day: dict = defaultdict(lambda: [0, 0])
        for m in current:
            by_day[m.at.date()][0] += 1
            by_day[m.at.date()][1] += m.tokens
        daily = [
            AgentOverviewDay(date=d, runs=by_day[d][0], tokens=by_day[d][1])
            for d in (today - timedelta(days=offset) for offset in range(days - 1, -1, -1))
        ]

        titles: dict[str, str] = {}
        exits = await self._exits(session, current, titles)
        recent = await self._recent(session, agent, titles)
        models = await self._models(session, agent, current)

        return AgentOverview(
            agent_id=agent.id,
            days=days,
            since=since,
            runs=len(current),
            runs_prior=len(prior),
            served=sum(m.verdict == "yes" for m in current),
            served_rate=_served_rate(current),
            served_rate_prior=_served_rate(prior),
            p95_ms=_p95(current),
            p95_prior_ms=_p95(prior),
            tokens_this_month=await self.runs_qs.tokens_for_agent(session, agent_id=agent.id, since=month),
            max_tokens_month=agent.effective_budget.get("max_tokens_month"),
            spawned=await self.agents_qs.spawned_since(session, parent_id=agent.id, since=since),
            daily=daily,
            exits=exits,
            recent=recent,
            models=models,
        )

    async def _measure(self, session: AsyncSession, roots: list[TaskRun]) -> list[_Measured]:
        ids = [r.id for r in roots]
        nodes: dict[str, list[TaskRun]] = defaultdict(list)
        for start in range(0, len(ids), _NODE_BATCH):
            for node in await self.runs_qs.nodes_of_many(session, run_ids=ids[start : start + _NODE_BATCH]):
                nodes[node.parent_run_id].append(node)
        return [_Measured(r, nodes.get(r.id, [])) for r in roots]

    async def _title(self, session: AsyncSession, run: TaskRun, titles: dict[str, str]) -> str:
        if run.id not in titles:
            todo = await session.get(Todo, run.todo_id) if run.todo_id else None
            titles[run.id] = run_title(run, todo.title if todo is not None else None)
        return titles[run.id]

    async def _exits(
        self, session: AsyncSession, current: list[_Measured], titles: dict[str, str]
    ) -> list[AgentOverviewExit]:
        counts: Counter[str] = Counter()
        last: dict[str, TaskRun] = {}
        for m in current:  # oldest first, so the last seen is the newest
            key = exit_of(m.root)
            counts[key] += 1
            last[key] = m.root
        return [
            AgentOverviewExit(
                exit=key, runs=n, last_run_id=last[key].id, last_title=await self._title(session, last[key], titles)
            )
            for key, n in counts.most_common()
        ]

    async def _recent(self, session: AsyncSession, agent: Agent, titles: dict[str, str]) -> list[AgentOverviewRun]:
        rows = await self.runs_qs.agent_recent_roots(session, agent_id=agent.id, limit=RECENT)
        measured = await self._measure(session, rows)
        delegated = await self.runs_qs.delegated_agents(session, run_ids=[r.id for r in rows])
        return [
            AgentOverviewRun(
                id=m.root.id,
                title=await self._title(session, m.root, titles),
                agents=1 + len(delegated.get(m.root.id, set()) - {agent.id}),
                tokens=m.tokens,
                duration_ms=m.root.duration_ms,
                exit=exit_of(m.root),
                finished_at=m.root.finished_at,
            )
            for m in measured
        ]

    async def _models(self, session: AsyncSession, agent: Agent, current: list[_Measured]) -> list[AgentOverviewModel]:
        groups: dict[str, list[_Measured]] = defaultdict(list)
        for m in current:
            for model in m.models:
                groups[model].append(m)
        if not groups:
            return []
        first = await self.runs_qs.agent_model_first_seen(session, agent_id=agent.id)
        rows = [
            AgentOverviewModel(
                model_version=model,
                first_at=_aware(first.get(model) or group[0].root.queued_at),
                runs=len(group),
                served_rate=_served_rate(group),
                p95_ms=_p95(group),
            )
            for model, group in groups.items()
        ]
        return sorted(rows, key=lambda r: r.first_at, reverse=True)
