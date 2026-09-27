"""How one library plan has behaved over a window — the plan page's two reads.

``performance`` answers the Overview, Layers and Flow tabs; ``runs`` answers
Activity ([LB33 · LB34 · LB36](docs/for-developers/modules/workflows/features/the-library.md)).

Every number is computed here from the roots' step rows rather than in SQL:
SQLite has no ``percentile_cont``, and a p95 that differs between dev and prod
is two numbers.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.querysets import AgentQuerySet
from invana.apps.sessions.querysets import SessionQuerySet
from invana.apps.skills.querysets import SkillVersionQuerySet
from invana.apps.task_plans.models import Task, TaskPlan
from invana.apps.task_plans.querysets import TaskPlanQuerySet
from invana.apps.task_plans.schemas import (
    AgentChip,
    BoundUse,
    CalledBy,
    DailyRow,
    FailedAt,
    FailureRow,
    LiveTiles,
    Measure,
    PerformanceTiles,
    PlanPerformance,
    PlanRunRow,
    PlanRunsPage,
    PublishMark,
    SlowRun,
    StepPerformance,
)
from invana.apps.work.querysets import TaskQuerySet as TodoQuerySet
from invana.core.auth.querysets import UserQuerySet
from invana.runtime.layers import layer_for
from invana.runtime.models import RunStatus, TaskRun
from invana.runtime.querysets import TaskRunQuerySet
from invana.runtime.workflows import retry_limit

WINDOWS = (7, 30, 90)

#: A root's status, in the run page's words (LB34). A pause on a person —
#: an approval or a question — reads `at a gate`.
_STATUS_WORD = {
    RunStatus.queued.value: "running",
    RunStatus.running.value: "running",
    RunStatus.awaiting_input.value: "at a gate",
    RunStatus.needs_input.value: "at a gate",
    RunStatus.succeeded.value: "succeeded",
    RunStatus.failed.value: "failed",
    RunStatus.stopped.value: "cancelled",
    RunStatus.cancelled.value: "cancelled",
    RunStatus.skipped.value: "cancelled",
}


def _ms(start: datetime | None, end: datetime | None) -> float | None:
    if start is None or end is None:
        return None
    return (end - start).total_seconds() * 1000


def _pct(values: list[float], q: float) -> float | None:
    """Linear-interpolated percentile; ``None`` over nothing."""
    if not values:
        return None
    ordered = sorted(values)
    at = (len(ordered) - 1) * q
    lo = int(at)
    hi = min(lo + 1, len(ordered) - 1)
    return ordered[lo] + (ordered[hi] - ordered[lo]) * (at - lo)


def _mean(values: list[float]) -> float | None:
    return sum(values) / len(values) if values else None


def _aware(at: datetime) -> datetime:
    return at if at.tzinfo else at.replace(tzinfo=UTC)


class _Root:
    """One root and its step rows, with the numbers every read shares."""

    def __init__(self, root: TaskRun, nodes: list[TaskRun]) -> None:
        self.root = root
        self.at = _aware(root.queued_at)
        # Attempts of one step, in order — a *reach* is a step the run got to.
        self.reaches: dict[str, list[TaskRun]] = defaultdict(list)
        # A row that never started was not reached: when a step fails, the
        # runtime closes the steps after it as failed without running them.
        for node in nodes:
            if node.step_key and node.started_at is not None:
                self.reaches[node.step_key].append(node)
        for rows in self.reaches.values():
            rows.sort(key=lambda r: (r.iteration, r.attempt))

    @property
    def failed(self) -> bool:
        return self.root.status == RunStatus.failed.value

    @property
    def verdict(self) -> str | None:
        for row in self.reaches.get("verify_result", []):
            served = (row.output or {}).get("served")
            if isinstance(served, str):
                return served
        return None

    @property
    def elapsed_ms(self) -> float | None:
        return _ms(self.root.queued_at, self.root.finished_at)

    def step_work(self, key: str) -> float:
        return sum(_ms(r.started_at, r.finished_at) or 0 for r in self.reaches.get(key, []))

    @property
    def work_ms(self) -> float | None:
        if not self.reaches:
            return None
        return sum(self.step_work(k) for k in self.reaches)

    def step_cost(self, key: str) -> float | None:
        """Σ cost; ``None`` when a row that spent tokens has no price (OB4)."""
        total = 0.0
        for row in self.reaches.get(key, []):
            if row.cost_usd is not None:
                total += row.cost_usd
            elif row.tokens_in or row.tokens_out:
                return None
        return total

    @property
    def cost(self) -> float | None:
        parts = [self.step_cost(k) for k in self.reaches]
        return None if any(p is None for p in parts) else sum(p or 0 for p in parts)

    def failed_step(self) -> TaskRun | None:
        """The step whose **last** attempt failed — a retry that recovered is not a failure."""
        for rows in self.reaches.values():
            if rows and rows[-1].status == RunStatus.failed.value:
                return rows[-1]
        return None


class PlanPerformanceManager:
    plans_qs = TaskPlanQuerySet()
    runs_qs = TaskRunQuerySet()

    async def _roots(self, session: AsyncSession, *, plan: TaskPlan, since: datetime) -> tuple[list[_Root], set[str]]:
        inlining = await self.plans_qs.plans_inlining(session, graph_id=plan.graph_id, ref=plan.ref)
        roots = await self.runs_qs.roots_for_plan(
            session, graph_id=plan.graph_id, origin=f"template:{plan.ref}", plan_ids=inlining, since=since
        )
        nodes = await self.runs_qs.nodes_of_many(session, run_ids=[r.id for r in roots])
        by_root: dict[str, list[TaskRun]] = defaultdict(list)
        for node in nodes:
            by_root[node.parent_run_id].append(node)
        return [_Root(r, by_root.get(r.id, [])) for r in roots], set(inlining)

    # ── Overview · Layers · Flow ──────────────────────────────────────────────

    async def performance(
        self, session: AsyncSession, *, plan: TaskPlan, window: int, now: datetime | None = None
    ) -> PlanPerformance:
        now = now or datetime.now(UTC)
        since = now - timedelta(days=window)
        roots, inlining = await self._roots(session, plan=plan, since=now - timedelta(days=2 * window))
        current = [r for r in roots if r.at >= since]
        prior = [r for r in roots if r.at < since]
        tasks = await self.plans_qs.tasks_for(session, plan_id=plan.id)
        # A skill's copied rows carry a key of their own, so only runs of the
        # plan by name join the per-step table (LB36).
        direct = [r for r in current if r.root.task_plan_id not in inlining]

        return PlanPerformance(
            window_days=window,
            version=plan.version,
            tiles=PerformanceTiles(
                runs=Measure(value=len(current), prior=len(prior)),
                served=Measure(value=_served(current), prior=_served(prior)),
                elapsed_p50_ms=Measure(
                    value=_pct([v for r in current if (v := r.elapsed_ms) is not None], 0.5),
                    prior=_pct([v for r in prior if (v := r.elapsed_ms) is not None], 0.5),
                ),
                work_p50_ms=Measure(
                    value=_pct([v for r in current if (v := r.work_ms) is not None], 0.5),
                    prior=_pct([v for r in prior if (v := r.work_ms) is not None], 0.5),
                ),
                cost_per_run=Measure(
                    value=_mean([v for r in current if (v := r.cost) is not None]),
                    prior=_mean([v for r in prior if (v := r.cost) is not None]),
                ),
                failed=Measure(value=sum(r.failed for r in current), prior=sum(r.failed for r in prior)),
            ),
            daily=_daily(current, since=since, now=now),
            publishes=[
                PublishMark(version=v.version, published_at=_aware(v.created_at).isoformat())
                for v in await self.plans_qs.versions_of(session, graph_id=plan.graph_id, key=plan.key or "")
                if _aware(v.created_at) >= since
            ],
            steps=_steps(tasks, direct),
            failures=_failures(current),
            bounds=_bounds(tasks, direct),
            slowest={t.key: _slowest(t.key, direct) for t in tasks},
        )

    # ── Activity ──────────────────────────────────────────────────────────────

    async def runs(
        self,
        session: AsyncSession,
        *,
        plan: TaskPlan,
        window: int,
        status: str | None = None,
        called_by: str | None = None,
        agent_id: str | None = None,
        cursor: str | None = None,
        limit: int = 50,
        now: datetime | None = None,
    ) -> PlanRunsPage:
        now = now or datetime.now(UTC)
        roots, inlining = await self._roots(session, plan=plan, since=now - timedelta(days=window))
        callers = await self._callers(session, plan=plan, roots=roots, inlining=inlining)

        agent_ids = sorted({r.root.agent_id for r in roots if r.root.agent_id})
        agents = {
            a.id: AgentChip(id=a.id, name=a.name, status=a.status)
            for a in await AgentQuerySet().by_ids(session, graph_id=plan.graph_id, ids=agent_ids)
        }
        live = LiveTiles(
            running=sum(_STATUS_WORD.get(r.root.status) == "running" for r in roots),
            at_gate=sum(_STATUS_WORD.get(r.root.status) == "at a gate" for r in roots),
            called_by=len({(c.kind, c.name) for c in callers.values()}),
            agents=len(agent_ids),
        )

        picked = [
            r
            for r in roots
            if (status is None or _STATUS_WORD.get(r.root.status) == status)
            and (called_by is None or callers[r.root.id].kind == called_by)
            and (agent_id is None or r.root.agent_id == agent_id)
        ]
        start = int(cursor) if cursor and cursor.isdigit() else 0
        page = picked[start : start + limit]
        todos = {
            t.id: t.title
            for t in await TodoQuerySet().by_ids(session, [r.root.todo_id for r in page if r.root.todo_id])
        }

        items = []
        for r in page:
            failed = r.failed_step() if r.failed else None
            error = (failed.error or {}) if failed is not None else {}
            items.append(
                PlanRunRow(
                    run_id=r.root.id,
                    status=_STATUS_WORD.get(r.root.status, r.root.status),
                    when=r.at.isoformat(),
                    asked=todos.get(r.root.todo_id or "") or r.root.body or "",
                    called_by=callers[r.root.id],
                    agent=agents.get(r.root.agent_id or ""),
                    version=plan.version,
                    elapsed_ms=r.elapsed_ms,
                    cost=r.cost,
                    failed_at=FailedAt(
                        step_key=failed.step_key or "",
                        cause=str(error.get("cause") or "unknown"),
                        message=str(error.get("message") or ""),
                    )
                    if failed is not None
                    else None,
                )
            )
        more = start + limit < len(picked)
        return PlanRunsPage(items=items, next_cursor=str(start + limit) if more else None, live=live)

    async def _callers(
        self, session: AsyncSession, *, plan: TaskPlan, roots: list[_Root], inlining: set[str]
    ) -> dict[str, CalledBy]:
        """Who called each root: the skill that inlined the plan, else the
        session it was asked in, else what opened it (LB34)."""
        owners = await SkillVersionQuerySet().owners_for_plans(session, sorted(inlining))
        titles = await SessionQuerySet().titles_by_ids(
            session, sorted({r.root.session_id for r in roots if r.root.session_id})
        )
        people = await UserQuerySet().usernames_by_ids(
            session,
            sorted({p for r in roots if (p := r.root.author_id or r.root.on_behalf_of_user_id)}),
        )
        out: dict[str, CalledBy] = {}
        for r in roots:
            run = r.root
            person = people.get(run.author_id or run.on_behalf_of_user_id or "")
            if run.task_plan_id in inlining and run.task_plan_id in owners:
                out[run.id] = CalledBy(kind="skill", name=owners[run.task_plan_id][1], person=person)
            elif run.session_id:
                out[run.id] = CalledBy(kind="session", name=titles.get(run.session_id) or "a session", person=person)
            else:
                out[run.id] = CalledBy(kind=run.triggered_by, name=run.triggered_by, person=person)
        return out


def _served(roots: list[_Root]) -> float | None:
    """Of verified runs, never of all runs: *never asked* is not *asked and failed*."""
    verdicts = [v for r in roots if (v := r.verdict) is not None]
    return sum(v == "yes" for v in verdicts) / len(verdicts) if verdicts else None


def _daily(roots: list[_Root], *, since: datetime, now: datetime) -> list[DailyRow]:
    by_day: dict[str, list[_Root]] = defaultdict(list)
    for r in roots:
        by_day[r.at.date().isoformat()].append(r)
    out = []
    day = since.date()
    while day <= now.date():
        rows = by_day.get(day.isoformat(), [])
        out.append(
            DailyRow(
                date=day.isoformat(),
                served=sum(r.verdict == "yes" for r in rows),
                failed=sum(r.failed for r in rows),
                work_p50_ms=_pct([v for r in rows if (v := r.work_ms) is not None], 0.5),
            )
        )
        day += timedelta(days=1)
    return out


def _steps(tasks: list[Task], roots: list[_Root]) -> list[StepPerformance]:
    total_work = sum(r.step_work(t.key) for t in tasks for r in roots)
    out = []
    for t in tasks:
        reached = [r for r in roots if t.key in r.reaches]
        costs = [c for r in reached if (c := r.step_cost(t.key)) is not None]
        work = [r.step_work(t.key) for r in reached]
        out.append(
            StepPerformance(
                step_key=t.key,
                layer=layer_for(form=t.form, step_key=t.step_key),
                ran_in=len(reached) / len(roots) if roots else None,
                p50_ms=_pct(work, 0.5),
                p95_ms=_pct(work, 0.95),
                failed=sum(r.reaches[t.key][-1].status == RunStatus.failed.value for r in reached),
                retried=(sum(len(r.reaches[t.key]) > 1 for r in reached) / len(reached)) if reached else None,
                cost_per_run=_mean(costs) if len(costs) == len(reached) else None,
                share_of_work=(sum(work) / total_work) if total_work else None,
            )
        )
    return out


def _failures(roots: list[_Root]) -> list[FailureRow]:
    groups: dict[tuple[str, str], list[_Root]] = defaultdict(list)
    for r in roots:
        row = r.failed_step()
        if row is not None:
            groups[(row.step_key or "", str((row.error or {}).get("cause") or "unknown"))].append(r)
    out = [
        FailureRow(step_key=step, cause=cause, count=len(rs), last_run_id=max(rs, key=lambda r: r.at).root.id)
        for (step, cause), rs in groups.items()
    ]
    return sorted(out, key=lambda f: -f.count)


def _bounds(tasks: list[Task], roots: list[_Root]) -> list[BoundUse]:
    """The bounds a step's rows record: today, retry — the one the runtime honours per step."""
    out = []
    for t in tasks:
        limit = retry_limit(t.step_key or t.key, t.retry)
        if limit <= 1:
            continue
        reached = [r.reaches[t.key] for r in roots if t.key in r.reaches]
        out.append(
            BoundUse(
                step_key=t.key,
                bound="retry",
                limit=limit,
                used=sum(len(rows) > 1 for rows in reached),
                exhausted=sum(rows[-1].attempt >= limit for rows in reached),
            )
        )
    return out


def _slowest(key: str, roots: list[_Root]) -> list[SlowRun]:
    reached = sorted((r for r in roots if key in r.reaches), key=lambda r: -r.step_work(key))
    return [SlowRun(run_id=r.root.id, ms=r.step_work(key), when=r.at.isoformat()) for r in reached[:3]]
