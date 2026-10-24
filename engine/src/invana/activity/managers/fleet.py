"""The fleet, read across every agent of a Graph — the Agents Overview and
Performance, and who pins each model (fleet-performance.md).

Everything is computed at read from ``task_runs`` roots, the way the plan
page's numbers are: no counter and no rollup table, so a number can never
disagree with the runs it counts. Percentiles are computed in Python, because
SQLite has none and dev and prod must agree.

The words every read shares:

* **a run** is a root (``parent_run_id`` null); steps never count as runs, and
  eval runs are left out, as the agent meters leave them out;
* **run time** is queued → finished, what a person waits for, measured on
  settled roots only — a run still going, paused or cancelled has none;
* **success** is succeeded over settled (succeeded + failed);
* **a change** against the window before — or a version against the one before
  it — is ``invana.core.metrics``' reading: a ratio, in points for success, with
  its direction and whether it is good news, so no client divides;
* **tokens** of a root are its own and its direct steps', in and out. Tokens,
  never currency: ``cost_usd`` is not read;
* **subjects** are agents (``agent_id``), skills (each skill version a root or
  its steps applied), plans (the root's library plan, by ``ref``) and models
  (``model_version`` on the root or a step). A run with none of one is absent
  from that table, never filed under *unknown*;
* **failing** counts a subject's latest settled runs that failed, back to the
  first that did not; two or more is a signal;
* **degraded** is a subject whose last 3 settled runs each took more than 1.5 times
  the p95 of its runs in the 7 days before the first of them, with at least 5
  runs in that baseline. The change it names is the newest agent or skill
  version published after that baseline began and before the first slow run —
  the agent's own and its bound skills' for an agent, the skill's own for a
  skill. A change older than the baseline ran under it, so it explains nothing.

Usage::

    fleet = FleetManager()
    overview = await fleet.overview(session, graph_id=graph.id)
    performance = await fleet.performance(session, graph_id=graph.id, window=30)
    pins = await fleet.pins(session, graph_id=graph.id)

Band 4: it reads ``task_runs`` (runtime), every app's version rows, approvals
and the change log — which no lower band may join.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.managers.changes import ChangeLogManager
from invana.activity.models import ApprovalStatus
from invana.activity.querysets import ApprovalQuerySet
from invana.activity.querysets.fleet import FleetQuerySet
from invana.activity.schemas import (
    AttentionItem,
    DayCount,
    Degradation,
    FleetMeasure,
    FleetOverview,
    FleetPerformance,
    FleetTiles,
    FleetWindow,
    ModelPin,
    ModelPins,
    OverviewTiles,
    PerformanceRow,
    PerformanceTrend,
    PinnedAgent,
    PinnedJudge,
    PinnedSkill,
    RecentChange,
    RecordHistory,
    TrendMark,
    TrendPoint,
)
from invana.apps.agents.models import Agent, AgentLifetime, AgentStatus
from invana.apps.agents.querysets import AgentQuerySet
from invana.apps.flows.models import Flow
from invana.apps.flows.querysets import FlowQuerySet
from invana.apps.skills.models import Skill, SkillVersion
from invana.apps.skills.querysets.skill import SkillQuerySet
from invana.apps.skills.querysets.skill_binding import SkillBindingQuerySet
from invana.core.errors import NotFoundError
from invana.core.events import actions
from invana.core.events.querysets import EventQuerySet
from invana.core.metrics import change_of, points_change_of
from invana.core.utils import percentile
from invana.runtime.models import RunStatus, TaskRun, wall_ms
from invana.runtime.querysets import EvalQuerySet, TaskRunQuerySet

#: How far Overview reads back: the 30 days of *Runs a day*, the 7 + 7 of the
#: tiles and a degradation's baseline all fit inside it.
_OVERVIEW_DAYS = 90
#: A degradation's baseline: the 7 days before the first slow run.
_BASELINE = timedelta(days=7)
_BASELINE_MIN_RUNS = 5
_SLOW_RUNS = 3
_SLOW_FACTOR = 1.5
#: Failed runs in a row that make a signal.
_FAILING_SIGNAL = 2
#: Fewer runs than this on either side of a version and its p95 change is not said.
_CHANGE_MIN_RUNS = 3
_RECENT_CHANGES = 5
_DAILY_DAYS = 30
#: ``nodes_of_many`` is asked in slices, so a 90-day window never builds one
#: ``IN`` list longer than a driver accepts.
_NODE_BATCH = 1000

_SETTLED = frozenset({RunStatus.succeeded.value, RunStatus.failed.value})
_PAUSED = frozenset({RunStatus.needs_input.value, RunStatus.awaiting_input.value})


def _aware(at: datetime) -> datetime:
    return at if at.tzinfo else at.replace(tzinfo=UTC)


def _mean(values: list[float]) -> float | None:
    return sum(values) / len(values) if values else None


def _seconds(ms: float) -> str:
    return f"{ms / 1000:.1f}s"


def _day(at: datetime) -> str:
    return f"{at:%b} {at.day}"


class _Root:
    """One root and its direct steps, with the numbers every read shares."""

    def __init__(self, root: TaskRun, nodes: list[TaskRun], versions: dict[str, SkillVersion]) -> None:
        self.root = root
        self.nodes = nodes
        self.at = _aware(root.queued_at)
        self.settled = root.status in _SETTLED
        self.failed = root.status == RunStatus.failed.value
        self.succeeded = root.status == RunStatus.succeeded.value
        # Run time is only said of a settled run: queued → finished.
        self.ms: float | None = wall_ms(root) if self.settled else None
        self.tokens = sum((r.tokens_in or 0) + (r.tokens_out or 0) for r in [root, *nodes])
        # The model reports what it applied on the step that called it; the
        # root carries the union in some paths. Both are read. Each entry is a
        # skill version id; one that resolves to nothing is dropped.
        self.skills: dict[str, SkillVersion] = {}
        for version_id in [*(root.skills_applied or []), *(s for n in nodes for s in n.skills_applied or [])]:
            version = versions.get(str(version_id))
            if version is None:
                continue
            held = self.skills.get(version.skill_id)
            if held is None or version.version > held.version:
                self.skills[version.skill_id] = version
        self.models = {m for m in [root.model_version, *(n.model_version for n in nodes)] if m}

    def failed_step(self) -> TaskRun | None:
        """The step whose last attempt failed — a retry that recovered is not a failure."""
        attempts: dict[str, list[TaskRun]] = defaultdict(list)
        for node in self.nodes:
            if node.step_key and node.started_at is not None:
                attempts[node.step_key].append(node)
        for rows in attempts.values():
            rows.sort(key=lambda r: (r.iteration, r.attempt))
            if rows[-1].status == RunStatus.failed.value:
                return rows[-1]
        return None

    def failure(self) -> str:
        """``<step_key> · <cause> · <message>`` — whichever parts were recorded."""
        step = self.failed_step()
        error = (step.error if step is not None else self.root.error) or {}
        parts = [
            step.step_key if step is not None else "",
            str(error.get("cause") or ""),
            str(error.get("message") or ""),
        ]
        return " · ".join(p for p in parts if p) or "failed"


# ── the numbers over a list of roots ─────────────────────────────────────────


def _times(roots: Iterable[_Root]) -> list[float]:
    return [r.ms for r in roots if r.ms is not None]


def _pct(roots: Iterable[_Root], q: float) -> float | None:
    return percentile(_times(roots), q)


def _success(roots: list[_Root]) -> float | None:
    settled = [r for r in roots if r.settled]
    return sum(r.succeeded for r in settled) / len(settled) if settled else None


def _tokens_per_run(roots: list[_Root]) -> float | None:
    return _mean([float(r.tokens) for r in roots])


def _slower(value: float | None, prior: float | None) -> FleetMeasure:
    """A run time or a token count, where up is the warning."""
    return FleetMeasure(value=value, prior=prior, change=change_of(value, prior, higher_is_better=False))


def _success_measure(value: float | None, prior: float | None) -> FleetMeasure:
    """A success rate, read in points, where up is good news."""
    return FleetMeasure(value=value, prior=prior, change=points_change_of(value, prior, higher_is_better=True))


def _failing(roots: list[_Root]) -> int:
    """Latest settled runs that failed, counted back to the first that did not.
    ``roots`` is oldest first."""
    count = 0
    for r in reversed(roots):
        if not r.settled:
            continue
        if not r.failed:
            break
        count += 1
    return count


@dataclass
class _Slow:
    p95_ms: float
    baseline_p95_ms: float
    since: datetime

    @property
    def ratio(self) -> float:
        return self.p95_ms / self.baseline_p95_ms if self.baseline_p95_ms else float("inf")


def _degraded(roots: list[_Root]) -> _Slow | None:
    """The last 3 timed runs each above 1.5 times the p95 of the 7 days before the
    first of them, over at least 5 baseline runs. ``roots`` is oldest first."""
    timed = [r for r in roots if r.ms is not None]
    if len(timed) < _SLOW_RUNS:
        return None
    last = timed[-_SLOW_RUNS:]
    first = last[0].at
    baseline = [r.ms for r in timed if first - _BASELINE <= r.at < first and r.ms is not None]
    if len(baseline) < _BASELINE_MIN_RUNS:
        return None
    base = percentile(baseline, 0.95) or 0.0
    if not all((r.ms or 0) > _SLOW_FACTOR * base for r in last):
        return None
    return _Slow(p95_ms=percentile(_times(last), 0.95) or 0.0, baseline_p95_ms=base, since=first)


@dataclass
class _Mint:
    """One agent or skill version, wherever it was read from."""

    kind: Literal["agent", "skill"]
    record_id: str
    name: str
    version: int
    at: datetime


@dataclass
class _Fleet:
    """Everything one read loaded, indexed the ways the tables need it."""

    roots: list[_Root]
    agents: dict[str, Agent]
    skills: dict[str, Skill]
    versions: list[SkillVersion]
    plans: dict[str, Flow]
    plan_of: dict[str, str]
    mints: list[_Mint]

    def by_agent(self) -> dict[str, list[_Root]]:
        out: dict[str, list[_Root]] = defaultdict(list)
        for r in self.roots:
            if r.root.agent_id:
                out[r.root.agent_id].append(r)
        return out

    def by_skill(self) -> dict[str, list[_Root]]:
        out: dict[str, list[_Root]] = defaultdict(list)
        for r in self.roots:
            for skill_id in r.skills:
                out[skill_id].append(r)
        return out

    def by_plan(self) -> dict[str, list[_Root]]:
        out: dict[str, list[_Root]] = defaultdict(list)
        for r in self.roots:
            ref = self.plan_of.get(r.root.id)
            if ref:
                out[ref].append(r)
        return out

    def by_model(self) -> dict[str, list[_Root]]:
        out: dict[str, list[_Root]] = defaultdict(list)
        for r in self.roots:
            for model in r.models:
                out[model].append(r)
        return out

    def agent_name(self, agent_id: str | None) -> str:
        agent = self.agents.get(agent_id or "")
        return agent.name if agent is not None else (agent_id or "an agent")

    def plan_name(self, ref: str) -> str:
        plan = self.plans.get(ref)
        return (plan.name or plan.key or ref) if plan is not None else ref

    def subject_name(self, r: _Root) -> str:
        """A root's plan when it ran one, else its agent."""
        ref = self.plan_of.get(r.root.id)
        return self.plan_name(ref) if ref else self.agent_name(r.root.agent_id)


class FleetManager:
    """The Agents Overview, Performance and the model pins. Stateless; the
    session is the first argument of every method, and nothing is written."""

    fleet_qs = FleetQuerySet()
    runs_qs = TaskRunQuerySet()
    agents_qs = AgentQuerySet()
    skills_qs = SkillQuerySet()
    bindings_qs = SkillBindingQuerySet()
    plans_qs = FlowQuerySet()
    approvals_qs = ApprovalQuerySet()
    events_qs = EventQuerySet()
    evals_qs = EvalQuerySet()
    changes = ChangeLogManager()

    # ── Overview ─────────────────────────────────────────────────────────────

    async def overview(self, session: AsyncSession, *, graph_id: str, now: datetime | None = None) -> FleetOverview:
        """What broke, what waits on a person, what slowed and what changed.

        Tiles compare today with the same day last week, and the last 7 days
        with the 7 before. *Waiting* is pending approvals plus roots paused on
        a question. The month budget is the sum of the live agents' effective
        ``max_tokens_month`` — each agent's own, else the Graph's default, the
        ceiling a run reads — so it agrees with every row's *of N*; null when
        no agent is live. *Needs attention*
        lists failing plans and agents, pending approvals and degraded agents;
        *Changed recently* the newest five agent and skill versions.
        """
        now = _aware(now or datetime.now(UTC)).astimezone(UTC)
        fleet = await self._load(session, graph_id=graph_id, since=now - timedelta(days=_OVERVIEW_DAYS))
        roots = fleet.roots
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_ago = today - timedelta(days=7)
        last7 = [r for r in roots if r.at >= now - timedelta(days=7)]
        prior7 = [r for r in roots if now - timedelta(days=14) <= r.at < now - timedelta(days=7)]
        todays = [r for r in roots if r.at >= today]
        failed_today = [r for r in todays if r.failed]
        month = today.replace(day=1)

        pending = await self.approvals_qs.list_for_graph(
            session, graph_id=graph_id, status=ApprovalStatus.pending.value, limit=200
        )
        paused = [r for r in roots if r.root.status in _PAUSED]
        if pending:
            waiting_latest: str | None = pending[0].title
        elif paused:
            waiting_latest = paused[-1].root.body or fleet.subject_name(paused[-1])
        else:
            waiting_latest = None

        listed = [
            a
            for a in fleet.agents.values()
            if a.lifetime == AgentLifetime.persistent.value and a.status != AgentStatus.retired.value
        ]
        budgets = [
            int(b)
            for a in listed
            if a.status != AgentStatus.draft.value
            and isinstance(b := a.effective_budget.get("max_tokens_month"), int | float)
        ]

        runs_week_ago = sum(week_ago <= r.at < week_ago + timedelta(days=1) for r in roots)
        tiles = OverviewTiles(
            runs_today=len(todays),
            runs_week_ago=runs_week_ago,
            runs_change=change_of(len(todays), runs_week_ago, higher_is_better=None),
            failed_today=len(failed_today),
            failed_latest=fleet.subject_name(failed_today[-1]) if failed_today else None,
            waiting=len(pending) + len(paused),
            waiting_latest=waiting_latest,
            p95_ms=_slower(_pct(last7, 0.95), _pct(prior7, 0.95)),
            tokens_this_month=sum(r.tokens for r in roots if r.at >= month),
            max_tokens_month=sum(budgets) if budgets else None,
            success=_success_measure(_success(last7), _success(prior7)),
        )

        attention: list[AttentionItem] = []
        seen: set[str] = set()
        # A plan names a failure more exactly than the agent that ran it, so
        # plans go first and an agent repeating the same latest failure is skipped.
        for group, name in ((fleet.by_plan(), fleet.plan_name), (fleet.by_agent(), fleet.agent_name)):
            for key, subject_roots in group.items():
                n = _failing(subject_roots)
                if n < _FAILING_SIGNAL:
                    continue
                latest = next(r for r in reversed(subject_roots) if r.failed)
                if latest.root.id in seen:
                    continue
                seen.add(latest.root.id)
                attention.append(
                    AttentionItem(
                        kind="failing",
                        title=f"{name(key)} failed {n} runs running",
                        detail=latest.failure(),
                        run_id=latest.root.id,
                        agent_id=latest.root.agent_id,
                        at=latest.at,
                    )
                )
        for approval in pending:
            attention.append(
                AttentionItem(
                    kind="waiting",
                    title=f"{approval.title} waits on a person",
                    detail=f"decide by {_day(_aware(approval.deadline_at))}, {_aware(approval.deadline_at):%H:%M}",
                    approval_id=approval.id,
                    run_id=approval.run_id,
                    at=_aware(approval.created_at),
                )
            )
        histories: dict[tuple[str, str], RecordHistory | None] = {}
        for agent_id, subject_roots in fleet.by_agent().items():
            slow = _degraded(subject_roots)
            if slow is None:
                continue
            change = await self._change_before(session, graph_id, fleet, histories, agent_id=agent_id, slow=slow)
            detail = f"p95 {_seconds(slow.p95_ms)}, up from {_seconds(slow.baseline_p95_ms)}"
            if change is not None:
                detail += f" since {change.name} v{change.version} · {_day(change.at or slow.since)}"
            attention.append(
                AttentionItem(
                    kind="degraded",
                    title=f"{fleet.agent_name(agent_id)} got {round((slow.ratio - 1) * 100)}% slower",
                    detail=detail,
                    agent_id=agent_id,
                    at=slow.since,
                )
            )

        daily = []
        for offset in range(_DAILY_DAYS - 1, -1, -1):
            start = today - timedelta(days=offset)
            day = [r for r in roots if start <= r.at < start + timedelta(days=1)]
            daily.append(
                DayCount(
                    date=start.date().isoformat(),
                    succeeded=sum(r.succeeded for r in day),
                    failed=sum(r.failed for r in day),
                )
            )

        newest = sorted(fleet.mints, key=lambda m: m.at, reverse=True)[:_RECENT_CHANGES]
        changes = [await self._recent(session, graph_id, fleet, histories, m) for m in newest]

        return FleetOverview(
            agents=len(listed),
            skills=len(fleet.skills),
            tiles=tiles,
            attention=attention,
            daily=daily,
            changes=changes,
        )

    # ── Performance ──────────────────────────────────────────────────────────

    async def performance(
        self, session: AsyncSession, *, graph_id: str, window: FleetWindow, now: datetime | None = None
    ) -> FleetPerformance:
        """Speed, success and tokens per agent, skill, plan and model over the window.

        Every number is set against the same-length window before it, except a
        skill's: its prior is its previous version over this window — the
        skill's measures are then read off its current version's runs — and
        falls back to the window before when the previous version ran nothing
        in this one. Failing and degraded read the subject's latest runs,
        whenever they fell. The tiles' *degraded* and *failing* count agents.
        """
        now = _aware(now or datetime.now(UTC)).astimezone(UTC)
        since = now - timedelta(days=window)
        prior_since = since - timedelta(days=window)
        fleet = await self._load(session, graph_id=graph_id, since=prior_since - _BASELINE)
        current = [r for r in fleet.roots if r.at >= since]
        prior = [r for r in fleet.roots if prior_since <= r.at < since]

        def split(roots: list[_Root]) -> tuple[list[_Root], list[_Root]]:
            return [r for r in roots if r.at >= since], [r for r in roots if prior_since <= r.at < since]

        histories: dict[tuple[str, str], RecordHistory | None] = {}

        async def rows(
            groups: dict[str, list[_Root]],
            name: Callable[[str], str],
            version: Callable[[str], str | None],
            kind: Literal["agent", "skill", "plan", "model"],
        ) -> list[PerformanceRow]:
            out = []
            for key, subject_roots in groups.items():
                now_roots, before = split(subject_roots)
                if not now_roots:
                    continue
                measured, prior_version = now_roots, None
                if kind == "skill":
                    measured, before, prior_version = self._skill_prior(fleet, key, now_roots, before)
                slow = _degraded(subject_roots)
                failing = _failing(subject_roots)
                change = None
                if slow is not None and kind in ("agent", "skill"):
                    change = await self._change_before(
                        session,
                        graph_id,
                        fleet,
                        histories,
                        agent_id=key if kind == "agent" else None,
                        skill_id=key if kind == "skill" else None,
                        slow=slow,
                    )
                out.append(
                    PerformanceRow(
                        id=key,
                        name=name(key),
                        version=version(key),
                        runs=len(now_roots),
                        success=_success(measured),
                        p50_ms=_pct(measured, 0.5),
                        p95_ms=_pct(measured, 0.95),
                        p95_prior_ms=_pct(before, 0.95),
                        p95_change=change_of(_pct(measured, 0.95), _pct(before, 0.95), higher_is_better=False),
                        prior_version=prior_version,
                        tokens_per_run=_tokens_per_run(measured),
                        tokens_per_run_prior=_tokens_per_run(before),
                        failing=failing,
                        signal="failing" if failing >= _FAILING_SIGNAL else ("degraded" if slow else None),
                        degradation=Degradation(
                            p95_ms=slow.p95_ms, baseline_p95_ms=slow.baseline_p95_ms, since=slow.since, change=change
                        )
                        if slow is not None
                        else None,
                    )
                )
            return sorted(out, key=lambda row: (-row.runs, row.name))

        current_version = {v.skill_id: v for v in fleet.versions}
        for skill in fleet.skills.values():
            head = next((v for v in fleet.versions if v.id == skill.current_version_id), None)
            if head is not None:
                current_version[skill.id] = head

        agents = await rows(fleet.by_agent(), fleet.agent_name, lambda _k: None, "agent")
        skills = await rows(
            fleet.by_skill(),
            lambda k: fleet.skills[k].name if k in fleet.skills else k,
            lambda k: str(current_version[k].version) if k in current_version else None,
            "skill",
        )
        plans = await rows(
            fleet.by_plan(),
            fleet.plan_name,
            lambda k: str(fleet.plans[k].version) if k in fleet.plans else None,
            "plan",
        )
        models = await rows(fleet.by_model(), lambda k: k, lambda _k: None, "model")

        return FleetPerformance(
            window_days=window,
            tiles=FleetTiles(
                success=_success_measure(_success(current), _success(prior)),
                p50_ms=_slower(_pct(current, 0.5), _pct(prior, 0.5)),
                p95_ms=_slower(_pct(current, 0.95), _pct(prior, 0.95)),
                runs=FleetMeasure(
                    value=len(current),
                    prior=len(prior),
                    change=change_of(len(current), len(prior), higher_is_better=None),
                ),
                tokens_per_run=_slower(_tokens_per_run(current), _tokens_per_run(prior)),
                degraded=sum(r.degradation is not None for r in agents),
                failing=sum(r.failing >= _FAILING_SIGNAL for r in agents),
            ),
            agents=agents,
            skills=skills,
            plans=plans,
            models=models,
            trend=await self._trend(session, fleet, agents, since=since, now=now, window=window),
        )

    @staticmethod
    def _skill_prior(
        fleet: _Fleet, skill_id: str, now_roots: list[_Root], before: list[_Root]
    ) -> tuple[list[_Root], list[_Root], str | None]:
        """``(measured, prior, prior_version)`` for a skill: its current
        version's runs against its previous version's, both over this window,
        with that version's label — or every run in the window against the
        window before, and no label, when either version ran none."""
        published = sorted((v for v in fleet.versions if v.skill_id == skill_id), key=lambda v: v.version)
        skill = fleet.skills.get(skill_id)
        head = next((v for v in published if skill is not None and v.id == skill.current_version_id), None)
        head = head or (published[-1] if published else None)
        if head is None:
            return now_roots, before, None
        older = [v for v in published if v.version < head.version]
        if not older:
            return now_roots, before, None
        previous = older[-1]
        on_previous = [r for r in now_roots if r.skills[skill_id].id == previous.id]
        on_head = [r for r in now_roots if r.skills[skill_id].id == head.id]
        if not on_previous or not on_head:
            return now_roots, before, None
        return on_head, on_previous, str(previous.version)

    async def _trend(
        self,
        session: AsyncSession,
        fleet: _Fleet,
        agents: list[PerformanceRow],
        *,
        since: datetime,
        now: datetime,
        window: int,
    ) -> PerformanceTrend | None:
        """p95 a day for the most degraded agent, else the busiest, with the
        agent's and its bound skills' publishes in the window marked."""
        if not agents:
            return None
        degraded = [r for r in agents if r.degradation is not None]
        if degraded:
            row = max(degraded, key=lambda r: r.degradation.p95_ms / (r.degradation.baseline_p95_ms or 1))
            baseline = row.degradation.baseline_p95_ms
        else:
            row = max(agents, key=lambda r: r.runs)
            baseline = row.p95_prior_ms
        roots = fleet.by_agent().get(row.id, [])
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        points = []
        for offset in range(window - 1, -1, -1):
            start = today - timedelta(days=offset)
            points.append(
                TrendPoint(
                    date=start.date().isoformat(),
                    p95_ms=_pct((r for r in roots if start <= r.at < start + timedelta(days=1)), 0.95),
                )
            )
        bound = set(await self.bindings_qs.skill_ids_for_agent(session, agent_id=row.id))
        marks = [
            TrendMark(date=m.at.date().isoformat(), label=f"{m.name} v{m.version}")
            for m in fleet.mints
            if m.at >= since
            and ((m.kind == "agent" and m.record_id == row.id) or (m.kind == "skill" and m.record_id in bound))
        ]
        return PerformanceTrend(
            subject_kind="agent",
            subject_id=row.id,
            name=row.name,
            baseline_p95_ms=baseline,
            points=points,
            marks=sorted(marks, key=lambda m: m.date),
        )

    # ── pins ─────────────────────────────────────────────────────────────────

    async def pins(self, session: AsyncSession, *, graph_id: str) -> ModelPins:
        """Every model address something pins, with who pins it.

        Read where each pin lives — an agent's ``model_pin``, the current
        published skill version's, an eval set's judge — and grouped by
        address. An address the Graph no longer offers is still listed: it is
        the one that refuses runs.
        """
        agents = await self.agents_qs.list_for_graph(session, graph_id, include_ephemeral=True)
        skills = {s.id: s for s in await self.skills_qs.list_for_graph(session, graph_id)}
        versions = await self.fleet_qs.published_skill_versions(session, graph_id=graph_id)
        sets = await self.evals_qs.sets_for_graph(session, graph_id=graph_id)

        by_address: dict[str, ModelPin] = {}

        def pin(address: str) -> ModelPin:
            return by_address.setdefault(address, ModelPin(address=address, agents=[], skills=[], judges=[]))

        for agent in agents:
            if agent.model_pin:
                pin(agent.model_pin).agents.append(PinnedAgent(id=agent.id, name=agent.name))
        for version in versions:
            skill = skills.get(version.skill_id)
            if skill is not None and version.id == skill.current_version_id and version.model_pin:
                pin(version.model_pin).skills.append(PinnedSkill(id=skill.id, name=skill.name, version=version.version))
        names = {a.id: a.name for a in agents} | {s.id: s.name for s in skills.values()}
        for eval_set in sets:
            if eval_set.judge_model_pin:
                pin(eval_set.judge_model_pin).judges.append(
                    PinnedJudge(
                        subject_kind=eval_set.subject_kind,
                        subject_id=eval_set.subject_id,
                        name=names.get(eval_set.subject_id, eval_set.subject_id),
                    )
                )
        return ModelPins(items=[by_address[a] for a in sorted(by_address)])

    # ── loading ──────────────────────────────────────────────────────────────

    async def _load(self, session: AsyncSession, *, graph_id: str, since: datetime) -> _Fleet:
        runs = await self.fleet_qs.roots_since(session, graph_id=graph_id, since=since)
        ids = [r.id for r in runs]
        by_root: dict[str, list[TaskRun]] = defaultdict(list)
        for start in range(0, len(ids), _NODE_BATCH):
            for node in await self.runs_qs.nodes_of_many(session, run_ids=ids[start : start + _NODE_BATCH]):
                by_root[node.parent_run_id].append(node)

        versions = await self.fleet_qs.published_skill_versions(session, graph_id=graph_id)
        version_by_id = {v.id: v for v in versions}
        roots = [_Root(r, by_root.get(r.id, []), version_by_id) for r in runs]

        agents = {
            a.id: a
            for a in await self.agents_qs.list_for_graph(
                session, graph_id, include_ephemeral=True, include_retired=True
            )
        }
        skills = {s.id: s for s in await self.skills_qs.list_for_graph(session, graph_id)}
        plans, plan_of = await self._plans(session, graph_id, runs)
        mints = await self._mints(session, graph_id, agents, skills, versions)
        return _Fleet(
            roots=roots,
            agents=agents,
            skills=skills,
            versions=versions,
            plans=plans,
            plan_of=plan_of,
            mints=mints,
        )

    async def _plans(
        self, session: AsyncSession, graph_id: str, runs: list[TaskRun]
    ) -> tuple[dict[str, Flow], dict[str, str]]:
        """``({ref: plan}, {run_id: ref})`` — a root's library plan, by the plan
        it ran, else by the ``template:<ref>`` it was run from. A generated
        one-off plan has no ref and is no plan here."""
        plans: dict[str, Flow] = {}
        by_id: dict[str, Flow | None] = {}
        plan_of: dict[str, str] = {}
        for run in runs:
            plan = None
            if run.flow_id:
                if run.flow_id not in by_id:
                    found = await self.plans_qs.get(session, run.flow_id)
                    by_id[run.flow_id] = found if found is not None and found.key else None
                plan = by_id[run.flow_id]
            if plan is None and (run.plan_origin or "").startswith("template:"):
                ref = run.plan_origin.removeprefix("template:")
                if ref not in plans:
                    key, _, version = ref.rpartition("@")
                    found = (
                        await self.plans_qs.find_by_key(session, graph_id=graph_id, key=key, version=int(version))
                        if key and version.isdigit()
                        else None
                    )
                    if found is None:
                        continue
                    plans[ref] = found
                plan = plans[ref]
            if plan is not None:
                plans.setdefault(plan.ref, plan)
                plan_of[run.id] = plan.ref
        return plans, plan_of

    async def _mints(
        self,
        session: AsyncSession,
        graph_id: str,
        agents: dict[str, Agent],
        skills: dict[str, Skill],
        versions: list[SkillVersion],
    ) -> list[_Mint]:
        """Every agent and skill version, oldest first.

        A skill's are its published rows. An agent keeps no version rows: its
        create is v1, and each update names the version it bumped to — the
        same reading the change log makes.
        """
        mints = [
            _Mint("skill", v.skill_id, skills[v.skill_id].name, v.version, _aware(v.published_at))
            for v in versions
            if v.skill_id in skills and v.published_at is not None
        ]
        events = await self.events_qs.for_targets(
            session,
            graph_id=graph_id,
            target_kind=actions.TARGET_AGENT,
            target_ids=sorted(agents),
            actions=actions.CHANGE_ACTIONS_BY_TARGET[actions.TARGET_AGENT],
        )
        seen: dict[tuple[str, int], _Mint] = {}
        for agent in agents.values():
            seen[(agent.id, 1)] = _Mint("agent", agent.id, agent.name, 1, _aware(agent.created_at))
        for event in events:
            details = event.details or {}
            label = 1 if event.action == actions.AGENT_CREATE else details.get("version")
            if not isinstance(label, int) and not (isinstance(label, str) and label.isdigit()):
                continue
            agent = agents.get(event.target_id or "")
            if agent is None:
                continue
            # v1 is the agent row's own birth; a later version is its earliest event.
            key = (agent.id, int(label))
            at = _aware(event.created_at)
            if key not in seen or (key[1] != 1 and at < seen[key].at):
                seen[key] = _Mint("agent", agent.id, agent.name, key[1], at)
        mints += seen.values()
        return sorted(mints, key=lambda m: m.at)

    # ── changes ──────────────────────────────────────────────────────────────

    async def _change_before(
        self,
        session: AsyncSession,
        graph_id: str,
        fleet: _Fleet,
        histories: dict[tuple[str, str], RecordHistory | None],
        *,
        slow: _Slow,
        agent_id: str | None = None,
        skill_id: str | None = None,
    ) -> RecentChange | None:
        """The newest version published inside the baseline and before the
        first slow run — the agent's own or a bound skill's, or the skill's."""
        if agent_id is not None:
            skill_ids = set(await self.bindings_qs.skill_ids_for_agent(session, agent_id=agent_id))
            mine = [
                m
                for m in fleet.mints
                if (m.kind == "agent" and m.record_id == agent_id) or (m.kind == "skill" and m.record_id in skill_ids)
            ]
        else:
            mine = [m for m in fleet.mints if m.kind == "skill" and m.record_id == skill_id]
        before = [m for m in mine if slow.since - _BASELINE < m.at <= slow.since]
        if not before:
            return None
        return await self._recent(session, graph_id, fleet, histories, max(before, key=lambda m: m.at))

    async def _recent(
        self,
        session: AsyncSession,
        graph_id: str,
        fleet: _Fleet,
        histories: dict[tuple[str, str], RecordHistory | None],
        mint: _Mint,
    ) -> RecentChange:
        """One version as *Changed recently* shows it: who, when and what it
        changed from the change log, and the p95 of the runs on it against the
        runs on the version before, when each side has at least 3."""
        key = (mint.kind, mint.record_id)
        if key not in histories:
            try:
                histories[key] = await self.changes.history(
                    session, graph_id=graph_id, record_kind=mint.kind, record_id=mint.record_id
                )
            except NotFoundError:
                histories[key] = None
        history = histories[key]
        items = history.items if history is not None else []
        index = next((i for i, item in enumerate(items) if item.version == str(mint.version)), None)
        entry = items[index] if index is not None else None
        previous = items[index + 1].version if index is not None and index + 1 < len(items) else None

        def on(version: str | None) -> list[float]:
            if version is None or not version.isdigit():
                return []
            v = int(version)
            if mint.kind == "agent":
                picked = (r for r in fleet.roots if r.root.agent_id == mint.record_id and r.root.agent_version == v)
            else:
                picked = (
                    r for r in fleet.roots if mint.record_id in r.skills and r.skills[mint.record_id].version == v
                )
            return _times(picked)

        after, prior = on(str(mint.version)), on(previous)
        change = None
        if len(after) >= _CHANGE_MIN_RUNS and len(prior) >= _CHANGE_MIN_RUNS:
            change = change_of(percentile(after, 0.95), percentile(prior, 0.95), higher_is_better=False)
        return RecentChange(
            record_kind=mint.kind,
            record_id=mint.record_id,
            name=mint.name,
            version=str(mint.version),
            previous=previous,
            at=entry.at if entry is not None and entry.at is not None else mint.at,
            actor_name=entry.actor_name if entry is not None else None,
            summary=entry.summary if entry is not None else "",
            runs=entry.effect.runs if entry is not None else len(after),
            failed=entry.effect.failed if entry is not None else 0,
            p95_change=change,
        )
