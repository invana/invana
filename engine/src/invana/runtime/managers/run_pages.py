"""The run page — one root run read the same way at any size.

Every tab of *Run #N* under Agents, Runs is a reading of one tree: the root, its
steps, every child run an agent spawned or delegated, and their steps. This
manager loads the tree once per request and answers each tab from it —
**Overview** (head, tiles, agents over time, steps a minute, what waits on the
reader, and past fifty agents the large-run reading), **Agents** (who spawned
whom, pending delegation asks, roles), **Stages** (steps grouped by step key in
plan order), **Assets** (what the run produced) and **Data touched** (graph
types, web domains, models, secrets).

Every number on the page is computed here, from stored columns; Studio formats
it and never derives it. A child run is told apart from a step by carrying an
``agent_id``: steps carry none, the agent belongs to the run that opened them.

Pending asks are approvals, which live in a band above the runtime, so the
caller reads them and hands them in as :class:`PendingAsk` values; this module
keeps the ones raised inside the tree.

Usage::

    asks = [PendingAsk.of(a) for a in await pending_for(session, graph_id=graph.id)]
    overview = await RunPageManager().overview(session, run=run, reader_id=user.id, asks=asks)
    stages = await RunPageManager().stages(session, run=run)
"""

from __future__ import annotations

import math
from collections import Counter
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.models import Agent, AgentKind
from invana.apps.govern.addressing import Layer
from invana.apps.govern.models import RunTouch, TouchDirection
from invana.core.auth.querysets import UserQuerySet
from invana.runtime.catalogue import CATALOGUE
from invana.runtime.models import RunStatus, TaskRun, span_ms
from invana.runtime.querysets.run_pages import RunPageQuerySet
from invana.runtime.querysets.task_run import RUN_STATE_STATUSES
from invana.runtime.schemas import (
    AgentBar,
    DelegationAsk,
    MinuteCount,
    RoleCell,
    RoleGroup,
    RoleRow,
    RunAgentNode,
    RunAgents,
    RunAsset,
    RunAssets,
    RunHead,
    RunOverview,
    RunStage,
    RunStages,
    RunTiles,
    RunTouched,
    TouchedGraphRow,
    TouchedLlmRow,
    TouchedWebRow,
    WaitingAsk,
)
from invana.runtime.services import run_origin

#: Past this many agents a run reads as a large run.
LARGE_RUN = 50
#: The longest per-minute series served; a longer run keeps its latest minutes.
MAX_MINUTES = 720
#: The catalogue bounds that write — a graph touch in one of these is a write.
_WRITE_BOUNDS = frozenset({"graph_write", "schema_write", "ingest"})
_ENDED = frozenset(RUN_STATE_STATUSES["ended"])
_WAITING = frozenset(RUN_STATE_STATUSES["waiting"])
#: A stage's status is its worst step's, in this order (running wins outright).
_WORST = (
    RunStatus.failed.value,
    RunStatus.cancelled.value,
    RunStatus.stopped.value,
    RunStatus.needs_input.value,
    RunStatus.awaiting_input.value,
    RunStatus.queued.value,
    RunStatus.skipped.value,
    RunStatus.succeeded.value,
)
#: Keys a step's input or output records a count of rows or items under.
_COUNT_KEYS = ("row_count", "rows", "records", "record_count", "items", "count")


@dataclass(frozen=True, slots=True)
class PendingAsk:
    """One pending approval, as the run page reads it."""

    id: str
    kind: str
    run_id: str | None
    step_run_id: str | None
    wants: str
    title: str
    approver_ids: tuple[str, ...] = ()
    payload: dict = field(default_factory=dict)

    @classmethod
    def of(cls, row: Any) -> PendingAsk:
        """From an approvals row (or anything with its columns)."""
        return cls(
            id=row.id,
            kind=row.kind,
            run_id=row.run_id,
            step_run_id=row.step_run_id,
            wants=row.wants or "",
            title=row.title or "",
            approver_ids=tuple(row.approver_ids or ()),
            payload=dict(row.payload or {}),
        )

    @property
    def line(self) -> str:
        return self.wants or self.title


def compact(n: int | None) -> str:
    """``22k`` · ``1.2M`` — tokens as a line of copy says them."""
    n = int(n or 0)
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}".rstrip("0").rstrip(".") + "M"
    if n >= 1_000:
        return f"{round(n / 1000)}k"
    return str(n)


def _utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def _minute(value: datetime) -> datetime:
    return _utc(value).replace(second=0, microsecond=0)  # type: ignore[union-attr]


def _percentile(values: list[int], pct: float) -> int | None:
    """Nearest-rank percentile, or ``None`` over nothing."""
    if not values:
        return None
    ordered = sorted(values)
    return ordered[max(0, math.ceil(pct / 100 * len(ordered)) - 1)]


def _count_of(doc: Any) -> int | None:
    """The rows or items a step's input or output records, when it records one."""
    if not isinstance(doc, dict):
        return None
    for key in _COUNT_KEYS:
        value = doc.get(key)
        if isinstance(value, bool):
            continue
        if isinstance(value, int):
            return value
        if isinstance(value, list):
            return len(value)
    return None


def _out_count(step: TaskRun) -> int | None:
    found = _count_of(step.output)
    if found is None:
        found = _count_of((step.result or {}).get("outputs"))
    return found


def _bound(task_key: str) -> str | None:
    entry = CATALOGUE.get(task_key)
    return entry.bound.value if entry else None


@dataclass
class _Tree:
    """One run's rows, with the edges the tabs read."""

    root: TaskRun
    rows: list[TaskRun]
    by_id: dict[str, TaskRun]
    #: The root and every row with an agent, in breadth order.
    agent_runs: list[TaskRun]
    #: Rows that are steps — no agent of their own.
    steps: list[TaskRun]
    #: Agent run id → the agent run above it.
    parent_agent: dict[str, str | None]
    depth: dict[str, int]
    #: Agent run id → its direct steps.
    steps_of: dict[str, list[TaskRun]]
    agents: dict[str, Agent]
    usernames: dict[str, str]

    @property
    def ids(self) -> list[str]:
        return [self.root.id, *(r.id for r in self.rows)]

    def owner(self, step: TaskRun) -> TaskRun | None:
        return self.by_id.get(step.parent_run_id or "")

    def name(self, run: TaskRun) -> str:
        agent = self.agents.get(run.agent_id or "")
        return agent.name if agent else (run.flow_key or "run")

    def tokens(self, run: TaskRun) -> int:
        """An agent run's own spend and its direct steps' — its children apart."""
        return (run.tokens or 0) + sum(s.tokens or 0 for s in self.steps_of.get(run.id, []))

    def counted_agents(self) -> list[TaskRun]:
        """The agents a run's size counts: the root when it has one, and every child."""
        return [r for r in self.agent_runs if r.agent_id]


class RunPageManager:
    """Reads one root run for each tab of the run page."""

    def __init__(self) -> None:
        self.pages_qs = RunPageQuerySet()
        self.users_qs = UserQuerySet()

    # ── the tree ─────────────────────────────────────────────────────────────

    async def _tree(self, session: AsyncSession, run: TaskRun) -> _Tree:
        rows = await self.pages_qs.tree(session, run_id=run.id)
        by_id = {run.id: run, **{r.id: r for r in rows}}
        agent_runs = [run, *(r for r in rows if r.agent_id)]
        agent_ids = {r.id for r in agent_runs}
        steps = [r for r in rows if r.id not in agent_ids]

        parent_agent: dict[str, str | None] = {run.id: None}
        depth: dict[str, int] = {run.id: 0}
        for child in agent_runs[1:]:
            up = by_id.get(child.parent_run_id or "")
            while up is not None and up.id not in agent_ids:
                up = by_id.get(up.parent_run_id or "")
            parent_agent[child.id] = up.id if up is not None else run.id
            depth[child.id] = depth.get(parent_agent[child.id] or run.id, 0) + 1

        steps_of: dict[str, list[TaskRun]] = {}
        for step in steps:
            steps_of.setdefault(step.parent_run_id or "", []).append(step)

        agents = await self.pages_qs.agents_by_ids(session, ids=[r.agent_id for r in agent_runs if r.agent_id])
        people = {uid for r in agent_runs if (uid := r.on_behalf_of_user_id or r.author_id)}
        usernames = await self.users_qs.usernames_by_ids(session, list(people))
        return _Tree(run, rows, by_id, agent_runs, steps, parent_agent, depth, steps_of, agents, usernames)

    @staticmethod
    def _asks_in(tree: _Tree, asks: list[PendingAsk]) -> list[PendingAsk]:
        ids = set(tree.ids)
        return [a for a in asks if a.run_id in ids or a.step_run_id in ids]

    @staticmethod
    def _asking_run(tree: _Tree, ask: PendingAsk) -> str:
        """The agent run an ask came from — its step's run, else the run it names."""
        step = tree.by_id.get(ask.step_run_id or "")
        if step is not None:
            return step.parent_run_id if step.id not in tree.depth else step.id  # type: ignore[return-value]
        return ask.run_id or tree.root.id

    def _state_line(self, tree: _Tree, run: TaskRun, budget_asks: dict[str, PendingAsk]) -> str:
        """An agent's state in words — ``served · 22k``, ``asking for 15k``, ``parent ended``."""
        tokens = tree.tokens(run)
        ask = budget_asks.get(run.id)
        if ask is not None:
            wanted = ask.payload.get("tokens") or ask.payload.get("wants_tokens")
            return f"asking for {compact(wanted)}" if isinstance(wanted, int) else (ask.line or "asking for tokens")
        if run.status == RunStatus.running.value:
            return f"running · {compact(tokens)}"
        if run.status == RunStatus.queued.value:
            return "queued"
        if run.status in _WAITING:
            return "waiting"
        reason = run.exit_reason
        if reason is None:
            words = run.status.replace("_", " ")
        elif reason == "stopped":
            by = (run.error or {}).get("stopped_by") if isinstance(run.error, dict) else None
            return f"stopped by {by}" if by else "stopped"
        else:
            words = reason.replace("_", " ")
        return f"{words} · {compact(tokens)}" if tokens else words

    def _origin_line(self, tree: _Tree, session_title: str | None, todo_title: str | None) -> tuple[str, str]:
        run = tree.root
        origin = run_origin(run) or "API"
        who = tree.usernames.get(run.on_behalf_of_user_id or run.author_id or "")
        by = f" by {who}" if who else ""
        if origin == "Todo":
            return origin, f'Todo{by} · "{todo_title or run.body or ""}"'
        if origin == "Explorer":
            title = f' · session "{session_title}"' if session_title else ""
            return origin, f"asked in Explorer{by}{title}"
        return origin, f"{origin}{by}"

    # ── Overview ─────────────────────────────────────────────────────────────

    async def overview(
        self,
        session: AsyncSession,
        *,
        run: TaskRun,
        reader_id: str,
        asks: list[PendingAsk],
        now: datetime | None = None,
    ) -> RunOverview:
        """The head, the tiles, agents over time, steps a minute and what waits.

        Past :data:`LARGE_RUN` agents the large-run reading is filled as well:
        agents finished and live a minute, the live limit, the ETA (agents still
        to finish over the last ten minutes' finishing rate, absent when none
        finished in that window) and one row per role.
        """
        now = _utc(now) or datetime.now(UTC)
        tree = await self._tree(session, run)
        mine = self._asks_in(tree, asks)
        budget_asks = {self._asking_run(tree, a): a for a in mine if a.kind == "budget"}
        head = await self._head(session, tree)

        counted = tree.counted_agents()
        children = tree.agent_runs[1:]
        emissions = await self.pages_qs.emissions(session, run_ids=tree.ids)
        files, branches = self._files_and_branches(tree)
        todos = [s for s in tree.steps if s.task_key == "work.create_task" and (s.output or {}).get("task_id")]
        records, writes_refused = self._records(tree, await self.pages_qs.touches(session, run_ids=tree.ids))
        root_agent = tree.agents.get(run.agent_id or "")
        timeout_s = (run.params or {}).get("timeout_s")
        elapsed = run.duration_ms if run.duration_ms is not None else span_ms(run.started_at, now)
        tokens = head.tokens

        tiles = RunTiles(
            elapsed_ms=elapsed,
            time_limit_ms=int(timeout_s) * 1000 if isinstance(timeout_s, int) else None,
            tokens=tokens,
            max_tokens_run=head.max_tokens_run,
            agents=len(counted),
            depth=max(tree.depth.values(), default=0),
            steps=len(tree.steps),
            redelivered=sum(1 for s in tree.steps if s.attempt > 1),
            assets=len(emissions) + len(files) + len(branches) + len(todos),
            files=len(files),
            branches=len(branches),
            records_touched=records,
            writes_refused=writes_refused,
        )
        overview = RunOverview(
            head=head,
            tiles=tiles,
            large=len(counted) > LARGE_RUN,
            agents_over_time=sorted(
                (
                    AgentBar(
                        run_id=r.id,
                        agent_id=r.agent_id,
                        agent_name=tree.name(r),
                        depth=tree.depth.get(r.id, 0),
                        started_at=r.started_at,
                        finished_at=r.finished_at,
                        status=r.status,
                        exit_reason=r.exit_reason,
                        state_line=self._state_line(tree, r, budget_asks),
                        tokens=tree.tokens(r),
                    )
                    for r in tree.agent_runs
                ),
                key=lambda b: (b.started_at is None, _utc(b.started_at) or now),
            ),
            steps_per_minute=self._per_minute([s.started_at for s in tree.steps if s.started_at]),
            waiting=[
                WaitingAsk(approval_id=a.id, kind=a.kind, line=a.line, for_you=reader_id in a.approver_ids)
                for a in mine
            ],
        )
        if not overview.large:
            return overview

        finished = [_utc(r.finished_at) for r in children if r.finished_at is not None]
        overview.finished_per_minute = self._per_minute(finished)
        peak = max(overview.finished_per_minute, key=lambda m: m.count, default=None)
        last_ten = sum(1 for at in finished if at is not None and at > now - timedelta(minutes=10))
        remaining = sum(1 for r in children if r.status not in _ENDED)
        tiles.live = sum(1 for r in children if r.status == RunStatus.running.value)
        tiles.queued = sum(1 for r in children if r.status == RunStatus.queued.value)
        live_limit = root_agent.effective_budget.get("max_live") if root_agent is not None else None
        tiles.live_limit = int(live_limit) if isinstance(live_limit, int) else None
        tiles.finishing_per_minute = sum(1 for at in finished if at is not None and at > now - timedelta(minutes=1))
        tiles.peak_finishing = peak.count if peak else 0
        tiles.peak_finishing_at = peak.minute if peak else None
        tiles.tokens_per_minute = round(tokens / max(1.0, (elapsed or 0) / 60_000))
        tiles.served = sum(1 for r in children if r.exit_reason == "served")
        tiles.not_served = sum(1 for r in children if r.exit_reason is not None and r.exit_reason != "served")
        tiles.eta_s = round(remaining / (last_ten / 10) * 60) if remaining and last_ten else None
        overview.live_over_time = self._live_over_time(children, start=run.started_at, end=run.finished_at, now=now)
        overview.by_role = self._by_role(tree, children)
        return overview

    async def _head(self, session: AsyncSession, tree: _Tree) -> RunHead:
        run = tree.root
        titles = await self.pages_qs.session_titles(session, ids=[run.session_id] if run.session_id else [])
        todos = await self.pages_qs.todo_titles(session, ids=[run.todo_id] if run.todo_id else [])
        agent = tree.agents.get(run.agent_id or "")
        frozen = (run.params or {}).get("max_tokens_run")
        ceiling = frozen if frozen is not None else (agent.effective_budget.get("max_tokens_run") if agent else None)
        return RunHead(
            id=run.id,
            number=run.number,
            agent_id=run.agent_id,
            agent_name=agent.name if agent else None,
            status=run.status,
            exit_reason=run.exit_reason,
            origin=run_origin(run),
            started_by_name=tree.usernames.get(run.on_behalf_of_user_id or run.author_id or ""),
            body=run.body,
            session_id=run.session_id,
            session_title=titles.get(run.session_id or ""),
            task_id=run.todo_id,
            task_title=todos.get(run.todo_id or ""),
            tokens=(run.tokens or 0) + sum(r.tokens or 0 for r in tree.rows),
            max_tokens_run=int(ceiling) if ceiling is not None else None,
            started_at=run.started_at,
            finished_at=run.finished_at,
            duration_ms=run.duration_ms,
            can_stop=run.status not in _ENDED,
            can_rerun=run.status in _ENDED,
        )

    @staticmethod
    def _per_minute(times: list[datetime | None]) -> list[MinuteCount]:
        """Counts a minute from the first minute to the last, empty minutes kept."""
        stamps = [_minute(t) for t in times if t is not None]
        if not stamps:
            return []
        counts = Counter(stamps)
        first, last = min(stamps), max(stamps)
        first = max(first, last - timedelta(minutes=MAX_MINUTES - 1))
        out, at = [], first
        while at <= last:
            out.append(MinuteCount(minute=at, count=counts.get(at, 0)))
            at += timedelta(minutes=1)
        return out

    @staticmethod
    def _live_over_time(
        runs: list[TaskRun], *, start: datetime | None, end: datetime | None, now: datetime
    ) -> list[MinuteCount]:
        """How many agents were running at each minute of the run."""
        if start is None:
            return []
        last = _minute(end or now)
        first = max(_minute(start), last - timedelta(minutes=MAX_MINUTES - 1))
        spans = [(_utc(r.started_at), _utc(r.finished_at) or now) for r in runs if r.started_at is not None]
        out, at = [], first
        while at <= last:
            edge = at + timedelta(minutes=1)
            out.append(MinuteCount(minute=at, count=sum(1 for s, f in spans if s < edge and f >= at)))
            at = edge
        return out

    def _by_role(self, tree: _Tree, runs: list[TaskRun]) -> list[RoleRow]:
        groups: dict[str, list[TaskRun]] = {}
        for r in runs:
            groups.setdefault(tree.name(r), []).append(r)
        rows = []
        for role, members in groups.items():
            rows.append(
                RoleRow(
                    role=role,
                    depth=min(tree.depth.get(r.id, 0) for r in members),
                    agents=len(members),
                    served=sum(1 for r in members if r.exit_reason == "served"),
                    not_served=sum(1 for r in members if r.exit_reason is not None and r.exit_reason != "served"),
                    running=sum(1 for r in members if r.status in RUN_STATE_STATUSES["live"]),
                    waiting=sum(1 for r in members if r.status in _WAITING),
                    tokens_p50=_percentile([tree.tokens(r) for r in members], 50),
                    tokens_p95=_percentile([tree.tokens(r) for r in members], 95),
                    time_p95_ms=_percentile([r.duration_ms for r in members if r.duration_ms is not None], 95),
                )
            )
        return sorted(rows, key=lambda r: (r.depth, r.role))

    @staticmethod
    def _files_and_branches(tree: _Tree) -> tuple[list[tuple[TaskRun, dict]], list[tuple[TaskRun, Any]]]:
        """The files the tree's steps wrote and the branches they recorded."""
        files, branches = [], []
        for step in tree.steps:
            result = step.result or {}
            for artifact in result.get("artifacts") or []:
                if isinstance(artifact, dict) and artifact.get("direction") != "read":
                    files.append((step, artifact))
            for branch in result.get("branches") or []:
                branches.append((step, branch))
        return files, branches

    @staticmethod
    def _task_keys(tree: _Tree) -> dict[tuple[str, str], str]:
        """``(run id, step key) → task key`` — how a touch names the step it came from."""
        return {(s.parent_run_id or "", s.step_key): s.task_key for s in tree.steps if s.step_key}

    def _records(self, tree: _Tree, touches: list[RunTouch]) -> tuple[int, int]:
        """``(records touched, writes refused)`` over the tree's graph-data touches."""
        keys = self._task_keys(tree)
        records = refused = 0
        for t in touches:
            if t.layer != Layer.graph_data.value:
                continue
            if t.direction == TouchDirection.refused.value:
                if _bound(keys.get((t.run_id, t.step_key or ""), "")) in _WRITE_BOUNDS:
                    refused += 1
            elif t.direction != TouchDirection.skipped.value:
                records += int((t.volume or {}).get("rows") or 0)
        return records, refused

    # ── Agents ───────────────────────────────────────────────────────────────

    async def agents(self, session: AsyncSession, *, run: TaskRun, asks: list[PendingAsk]) -> RunAgents:
        """Who spawned whom: every agent run with its state, budget and how it came to be,
        the pending delegation asks drawn from the agent that asked, and one group per role."""
        tree = await self._tree(session, run)
        mine = self._asks_in(tree, asks)
        budget_asks = {self._asking_run(tree, a): a for a in mine if a.kind == "budget"}
        titles = await self.pages_qs.session_titles(session, ids=[run.session_id] if run.session_id else [])
        todos = await self.pages_qs.todo_titles(session, ids=[run.todo_id] if run.todo_id else [])
        label, line = self._origin_line(tree, titles.get(run.session_id or ""), todos.get(run.todo_id or ""))
        head_budget = (await self._head(session, tree)).max_tokens_run

        nodes = []
        for r in tree.agent_runs:
            agent = tree.agents.get(r.agent_id or "")
            if r.id == run.id:
                how, budget = "root", head_budget
            else:
                how = "spawned" if agent is not None and agent.kind == AgentKind.spawned.value else "delegated"
                budget = r.escrow_tokens if r.escrow_tokens is not None else head_budget
            nodes.append(
                RunAgentNode(
                    run_id=r.id,
                    parent_run_id=tree.parent_agent.get(r.id),
                    agent_id=r.agent_id,
                    agent_name=tree.name(r),
                    role=tree.name(r),
                    depth=tree.depth.get(r.id, 0),
                    status=r.status,
                    exit_reason=r.exit_reason,
                    state_line=self._state_line(tree, r, budget_asks),
                    tokens=tree.tokens(r),
                    budget=budget,
                    how=how,
                )
            )

        delegation = [
            DelegationAsk(
                approval_id=a.id,
                from_run_id=self._asking_run(tree, a),
                agent_id=a.payload.get("agent_id"),
                agent_name=str(a.payload.get("agent_name") or a.line or "an agent"),
                line=a.line,
            )
            for a in mine
            if a.kind == "delegation"
        ]
        return RunAgents(origin_label=label, origin_line=line, nodes=nodes, asks=delegation, roles=self._roles(tree))

    @staticmethod
    def _state_word(run: TaskRun) -> str:
        if run.status in RUN_STATE_STATUSES["live"]:
            return "running"
        if run.status in _WAITING:
            return "waiting"
        if run.exit_reason == "served":
            return "served"
        if run.exit_reason in ("stopped", "parent_ended"):
            return "stopped"
        return "not served"

    def _roles(self, tree: _Tree) -> list[RoleGroup]:
        groups: dict[str, list[TaskRun]] = {}
        for r in tree.agent_runs:
            groups.setdefault(tree.name(r), []).append(r)
        out = []
        for role, members in groups.items():
            by_state = Counter(self._state_word(r) for r in members)
            out.append(
                RoleGroup(
                    role=role,
                    depth=min(tree.depth.get(r.id, 0) for r in members),
                    agents=len(members),
                    by_state=dict(by_state),
                    line=" · ".join(f"{n} {word}" for word, n in by_state.most_common()),
                    cells=[RoleCell(run_id=r.id, status=r.status, exit_reason=r.exit_reason) for r in members],
                )
            )
        return sorted(out, key=lambda g: (g.depth, g.role))

    # ── Stages ───────────────────────────────────────────────────────────────

    async def stages(self, session: AsyncSession, *, run: TaskRun) -> RunStages:
        """The tree's steps, one stage per step key, in the order the plan first reached each."""
        tree = await self._tree(session, run)
        groups: dict[str, list[TaskRun]] = {}
        for step in tree.steps:
            groups.setdefault(step.step_key or step.task_key, []).append(step)
        stages = [self._stage(key, steps) for key, steps in groups.items()]
        return RunStages(stages=stages, pruned=not tree.steps and run.status in _ENDED)

    @staticmethod
    def _stage(key: str, steps: list[TaskRun]) -> RunStage:
        statuses = {s.status for s in steps}
        status = (
            RunStatus.running.value
            if RunStatus.running.value in statuses
            else next((s for s in _WORST if s in statuses), steps[0].status)
        )
        started = [_utc(s.started_at) for s in steps if s.started_at is not None]
        ended = [_utc(s.finished_at) for s in steps if s.finished_at is not None]
        ins = [n for s in steps if (n := _count_of(s.input)) is not None]
        outs = [n for s in steps if (n := _out_count(s)) is not None]
        in_count = sum(ins) if ins else None
        out_count = sum(outs) if outs else None
        if out_count is not None:
            line = f"{in_count} → {out_count} rows" if in_count is not None else f"→ {out_count} rows"
        else:
            line = ""
        words = Counter(
            "ok"
            if s.status == RunStatus.succeeded.value
            else "refused"
            if isinstance(s.error, dict) and s.error.get("cls") == "blocked"
            else s.status.replace("_", " ")
            for s in steps
        )
        return RunStage(
            step_key=key,
            function=steps[0].task_key,
            status=status,
            calls=len(steps),
            lanes=max(1, len({s.lane for s in steps if s.lane})),
            duration_ms=span_ms(min(started), max(ended)) if started and ended else None,
            p95_ms=_percentile([s.duration_ms for s in steps if s.duration_ms is not None], 95),
            tokens=sum(s.tokens or 0 for s in steps),
            in_count=in_count,
            out_count=out_count,
            line=line,
            summary=" · ".join(f"{n} {w}" for w, n in words.most_common()),
            step_ids=[s.id for s in steps],
        )

    # ── Assets ───────────────────────────────────────────────────────────────

    async def assets(self, session: AsyncSession, *, run: TaskRun) -> RunAssets:
        """Every emission, file, branch and Todo the tree produced, with who produced it."""
        tree = await self._tree(session, run)

        def produced_by(step: TaskRun | None, owner: TaskRun | None) -> str:
            agent = tree.name(owner) if owner is not None else tree.name(run)
            return f"{step.task_key} · {agent}" if step is not None else agent

        items: list[RunAsset] = []
        for e in await self.pages_qs.emissions(session, run_ids=tree.ids):
            step = tree.by_id.get(e.step_run_id or "")
            payload = e.payload or {}
            if e.kind == "subgraph":
                data = payload.get("data") or {}
                size = f"{len(data.get('nodes') or [])} nodes · {len(data.get('edges') or [])} edges"
            else:
                rows = (e.citation or {}).get("record_count")
                rows = rows if isinstance(rows, int) else len(payload.get("rows") or [])
                size = f"{rows} rows"
            items.append(
                RunAsset(
                    name=str(payload.get("title") or e.kind),
                    kind="emission",
                    produced_by=produced_by(step, tree.by_id.get(e.run_id)),
                    size_line=size,
                    where="opens on a board",
                    step_run_id=e.step_run_id,
                    emission_id=e.id,
                )
            )
        files, branches = self._files_and_branches(tree)
        for step, artifact in files:
            name = str(artifact.get("name") or "file")
            ext = name.rsplit(".", 1)[-1] if "." in name else "file"
            items.append(
                RunAsset(
                    name=name,
                    kind=f"file · {ext}",
                    produced_by=produced_by(step, tree.owner(step)),
                    size_line=str(artifact.get("summary") or "—"),
                    where="the run's files",
                    step_run_id=step.id,
                )
            )
        for step, branch in branches:
            items.append(
                RunAsset(
                    name=str(branch.get("name") if isinstance(branch, dict) else branch),
                    kind="branch",
                    produced_by=produced_by(step, tree.owner(step)),
                    where="the graph's branches",
                    step_run_id=step.id,
                )
            )
        made = [s for s in tree.steps if s.task_key == "work.create_task" and (s.output or {}).get("task_id")]
        titles = await self.pages_qs.todo_titles(session, ids=[s.output["task_id"] for s in made])
        for step in made:
            todo_id = step.output["task_id"]
            items.append(
                RunAsset(
                    name=titles.get(todo_id, "a Todo"),
                    kind="Todo for a person",
                    produced_by=produced_by(step, tree.owner(step)),
                    where="Todos",
                    step_run_id=step.id,
                    task_id=todo_id,
                )
            )
        return RunAssets(items=items)

    # ── Data touched ─────────────────────────────────────────────────────────

    async def touched(self, session: AsyncSession, *, run: TaskRun) -> RunTouched:
        """What the tree engaged: graph types read, written and refused; web domains;
        models called with their tokens; and secrets used (none are recorded yet)."""
        tree = await self._tree(session, run)
        touches = await self.pages_qs.touches(session, run_ids=tree.ids)
        keys = self._task_keys(tree)

        graph: dict[str, TouchedGraphRow] = {}
        web: dict[str, TouchedWebRow] = {}
        for t in touches:
            refused = t.direction == TouchDirection.refused.value
            if t.direction == TouchDirection.skipped.value:
                continue
            if t.layer == Layer.graph_data.value:
                row = graph.setdefault(t.participant, TouchedGraphRow(type=t.participant))
                if refused:
                    row.refused += 1
                    row.refused_line = row.refused_line or (t.why or "")
                elif _bound(keys.get((t.run_id, t.step_key or ""), "")) in _WRITE_BOUNDS:
                    row.written += int((t.volume or {}).get("rows") or 0)
                else:
                    row.read += int((t.volume or {}).get("rows") or 0)
            elif t.layer == Layer.third_party.value:
                domain = t.participant.split("/", 1)[0]
                row = web.setdefault(domain, TouchedWebRow(domain=domain))
                if refused:
                    row.refused += 1
                    row.refused_line = row.refused_line or (t.why or "")
                else:
                    row.pages += 1

        llm: dict[str, TouchedLlmRow] = {}
        for step in tree.steps:
            if step.tokens_in is None and step.tokens_out is None:
                continue
            owner = tree.owner(step)
            model = step.model_version or (owner.model_version if owner is not None else None) or "not recorded"
            row = llm.setdefault(model, TouchedLlmRow(model=model))
            row.calls += 1
            row.tokens_in += step.tokens_in or 0
            row.tokens_out += step.tokens_out or 0

        return RunTouched(
            graph=sorted(graph.values(), key=lambda r: r.type),
            web=sorted(web.values(), key=lambda r: r.domain),
            llm=sorted(llm.values(), key=lambda r: r.model),
            secrets=[],
            records_touched=sum(r.read + r.written for r in graph.values()),
        )
