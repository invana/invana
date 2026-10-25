"""Seed the F05 boards' data into the dev database's admin/airways Graph.

The Runs, run page, Approvals and Ledger boards need runs no demo produces on
its own: a run tree of eight agents with escrow, a child that made no progress
and two pending asks; a run of 700 agents; a closed run; Route Auditor's
failed runs this month; the ledger rows for each; and five alert rules.

Runs once — a second run finds Route Auditor's seeded tree and stops, since
ledger rows are append-only and cannot be seeded twice. Run from the repo root:

    uv run --directory engine python ../scripts/agents-build/seed_f05.py

It prints the ids ``scripts/migration/screen_map.py`` routes the boards to.

The engine fails every running run when it starts, so after a restart, and
before shooting the boards, put the seeded live runs back::

    uv run --directory engine python ../scripts/agents-build/seed_f05.py --revive
"""

from __future__ import annotations

import asyncio
import random
import sys
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

# Every model the run tables reach by name, registered before the first query.
import invana.apps.annotations.models  # noqa: F401
import invana.apps.boards.models  # noqa: F401
import invana.apps.datasets.models  # noqa: F401
import invana.apps.flows.models  # noqa: F401
import invana.apps.llm_providers.models  # noqa: F401
import invana.apps.sessions.models  # noqa: F401
import invana.apps.skills.models  # noqa: F401
import invana.apps.standards.models  # noqa: F401
import invana.apps.work.models  # noqa: F401
from invana.activity.models import AlertRule, Approval
from invana.apps.agents.models import Agent
from invana.apps.govern.models import RunTouch
from invana.apps.graphs.models import Graph
from invana.core import ledger
from invana.core.auth.models import User
from invana.core.db import create_db_engine, create_session_factory
from invana.core.ledger.models import LedgerRow
from invana.runtime.models import Emission, TaskRun

MARK = {"seed": "f05"}
NOW = datetime.now(UTC)
rng = random.Random(5)


async def _agent(db, graph, owner, name, *, kind="authored", parent=None, policy=None, budget=None):
    found = (
        await db.execute(select(Agent).where(Agent.graph_id == graph.id, Agent.name == name))
    ).scalar_one_or_none()
    if found:
        return found
    agent = Agent(
        graph_id=graph.id,
        name=name,
        description=f"{name} — seeded for the run boards",
        kind=kind,
        status="active",
        lifetime="ephemeral" if kind == "spawned" else "persistent",
        parent_agent_id=parent.id if parent else None,
        created_by_kind="agent" if kind == "spawned" else "user",
        created_by_id=None if kind == "spawned" else owner.id,
        policy=policy or {},
        budget=budget or {},
    )
    db.add(agent)
    await db.flush()
    return agent


def _chain(owner, *agents):
    return [{"kind": "person", "id": owner.id, "name": owner.username}] + [
        {"kind": "agent", "id": a.id, "name": a.name} for a in agents
    ]


MODEL = "anthropic/claude-opus-5-5"


def _touched(task_key: str, chain) -> str:
    """The ledger's `layer/name` for what a seeded step touched."""
    if task_key.startswith("graph"):
        return "graph/Airport"
    if task_key.startswith("llm."):
        return f"llm/{MODEL}"
    if task_key.startswith("web."):
        return "web/fares.example.com/search"
    return f"agent/{chain[-1]['name']}"


class Seeder:
    def __init__(self, db, graph, owner):
        self.db, self.graph, self.owner = db, graph, owner

    async def root(self, agent, *, body, status, started, finished=None, exit_reason=None, budget=80_000, queued=None, **kw):
        run = TaskRun(
            graph_id=self.graph.id,
            ask_kind="nl",
            body=body,
            flow_key="nl-query",
            agent_id=agent.id,
            author_id=self.owner.id,
            on_behalf_of_user_id=self.owner.id,
            triggered_by=kw.pop("triggered_by", "user"),
            status=status,
            exit_reason=exit_reason,
            outcome="answered" if exit_reason == "served" else None,
            queued_at=queued or started,
            started_at=started,
            finished_at=finished,
            params={**MARK, "max_tokens_run": budget},
            **kw,
        )
        self.db.add(run)
        await self.db.flush()
        return run

    async def step(self, run, chain, *, seq, key, task_key, start, secs, tokens=0, status="succeeded", rows=None, number=None):
        step = TaskRun(
            graph_id=self.graph.id,
            parent_run_id=run.id,
            seq=seq,
            step_key=key,
            task_key=task_key,
            label=key,
            flow_key=run.flow_key,
            status=status,
            queued_at=start,
            started_at=start,
            finished_at=None if status == "running" else start + timedelta(seconds=secs),
            tokens_in=tokens // 2 or None,
            tokens_out=(tokens - tokens // 2) or None,
            tokens=tokens or None,
            output={"row_count": rows} if rows is not None else None,
            model_version=MODEL if task_key.startswith("llm.") else None,
        )
        self.db.add(step)
        await self.db.flush()
        layer = {"graph": "graph", "llm.": "llm", "work.": "agent", "web.": "web"}
        await ledger.record(
            self.db,
            graph_id=self.graph.id,
            actor_kind="agent",
            actor_chain=chain,
            actor_agent_id=chain[-1]["id"],
            act=task_key,
            layer=next((v for k, v in layer.items() if task_key.startswith(k)), "agent"),
            touched=_touched(task_key, chain),
            touched_line=f"{rows} rows" if rows is not None else (f"{tokens:,} tokens" if tokens else ""),
            verdict="allowed",
            run_id=run.id,
            step_run_id=step.id,
            run_number=number,
            where="in-process",
            at=start,
        )
        return step

    async def child(self, parent_step, agent, *, status, exit_reason, start, finished=None, escrow=None, returned=None):
        run = TaskRun(
            graph_id=self.graph.id,
            parent_run_id=parent_step.id,
            agent_id=agent.id,
            flow_key="nl-query",
            triggered_by="delegation",
            status=status,
            exit_reason=exit_reason,
            queued_at=start,
            started_at=start,
            finished_at=finished,
            escrow_tokens=escrow,
            escrow_returned=returned,
        )
        self.db.add(run)
        await self.db.flush()
        return run


async def ended_runs(s, auditor, c_root):
    """Route Auditor's closed run and its three failed runs this month.

    Each is queued now though it started days ago: the engine keeps the newest
    runs per Graph by when they were queued, so a back-dated queue time would
    be pruned by the next run anyone starts.
    """
    t1 = NOW - timedelta(days=2, hours=3)
    closed = await s.root(auditor, body="Which LHR routes lost the most seats last quarter?", status="succeeded", started=t1, queued=NOW, finished=t1 + timedelta(minutes=2), exit_reason="served")
    await s.step(closed, c_root, seq=0, key="graph_read_query", task_key="graph.read.query", start=t1, secs=2, rows=58, number=closed.number)
    await s.step(closed, c_root, seq=1, key="llm_answer", task_key="llm.answer", start=t1 + timedelta(seconds=3), secs=9, tokens=3_100, number=closed.number)
    failed = []
    for i, (reason, ago) in enumerate((("failed", 4), ("budget_declined", 9), ("time_limit", 17))):
        t = NOW - timedelta(days=ago)
        r = await s.root(auditor, body=f"Audit {('JFK', 'DXB', 'SIN')[i]} routes for fare gaps", status="failed", started=t, queued=NOW, finished=t + timedelta(minutes=5), exit_reason=reason)
        await s.step(r, c_root, seq=0, key="graph_read_query", task_key="graph.read.query", start=t, secs=2, rows=120, number=r.number)
        failed.append(r)
    return closed, failed


async def seed(db) -> None:
    owner = (await db.execute(select(User).where(User.username == "admin"))).scalar_one()
    graph = (
        await db.execute(select(Graph).where(Graph.created_by_id == owner.id, Graph.slug == "airways"))
    ).scalar_one()
    s = Seeder(db, graph, owner)

    auditor = await _agent(db, graph, owner, "Route Auditor", budget={"max_tokens_run": 80_000, "max_live": 4})
    seeded = (
        await db.execute(
            select(TaskRun.id).where(TaskRun.agent_id == auditor.id, TaskRun.parent_run_id.is_(None))
        )
    ).first()
    if seeded:
        print("already seeded — Route Auditor has runs; nothing written")
        return

    hub = await _agent(db, graph, owner, "Hub Checker")
    fares = await _agent(db, graph, owner, "Fare Scout")
    delays = await _agent(db, graph, owner, "Delay Analyst")
    weather = await _agent(db, graph, owner, "Weather Reader")
    auditor.policy = {"may_delegate": {hub.id: "always", fares.id: "always", delays.id: "always", weather.id: "ask"}}
    lhr = await _agent(db, graph, owner, "LHR checker", kind="spawned", parent=hub)
    jfk = await _agent(db, graph, owner, "JFK checker", kind="spawned", parent=hub)
    dxb = await _agent(db, graph, owner, "DXB checker", kind="spawned", parent=hub)

    # ── the tree: eight agents, escrow, no progress, two asks ────────────────
    t0 = NOW - timedelta(minutes=14)
    root = await s.root(auditor, body="Audit the routes out of LHR, JFK and DXB for delays and fare gaps", status="running", started=t0)
    n = root.number
    c_root = _chain(owner, auditor)
    await s.step(root, c_root, seq=0, key="graph_read_query", task_key="graph.read.query", start=t0, secs=2, rows=214, number=n)
    await s.step(root, c_root, seq=1, key="llm_reason", task_key="llm.reason", start=t0 + timedelta(seconds=3), secs=6, tokens=4_200, number=n)
    d_hub = await s.step(root, c_root, seq=2, key="work_delegate", task_key="work.delegate", start=t0 + timedelta(seconds=10), secs=420, tokens=0, number=n)
    d_fares = await s.step(root, c_root, seq=3, key="work_delegate_2", task_key="work.delegate", start=t0 + timedelta(seconds=11), secs=200, number=n)
    d_delays = await s.step(root, c_root, seq=4, key="work_delegate_3", task_key="work.delegate", start=t0 + timedelta(seconds=12), secs=0, status="running", number=n)

    hub_run = await s.child(d_hub, hub, status="succeeded", exit_reason="served", start=t0 + timedelta(seconds=12), finished=t0 + timedelta(minutes=7), escrow=24_000, returned=6_100)
    c_hub = _chain(owner, auditor, hub)
    await s.step(hub_run, c_hub, seq=0, key="graph_read_query", task_key="graph.read.query", start=t0 + timedelta(seconds=14), secs=3, rows=96, number=n)
    spawns = []
    for i, helper in enumerate((lhr, jfk, dxb)):
        spawn = await s.step(hub_run, c_hub, seq=1 + i, key=f"work_spawn_{i}", task_key="work.spawn", start=t0 + timedelta(seconds=20 + i), secs=200, number=n)
        spawns.append((spawn, helper))
    for i, (spawn, helper) in enumerate(spawns):
        h = await s.child(spawn, helper, status="succeeded", exit_reason="served", start=spawn.started_at, finished=spawn.started_at + timedelta(minutes=3 + i), escrow=4_000, returned=900 + 300 * i)
        await s.step(h, _chain(owner, auditor, hub, helper), seq=0, key="graph_read_query", task_key="graph.read.query", start=h.started_at, secs=2, rows=30 + 10 * i, number=n)
        await s.step(h, _chain(owner, auditor, hub, helper), seq=1, key="llm_summarize", task_key="llm.summarize", start=h.started_at + timedelta(seconds=3), secs=8, tokens=2_400 + 200 * i, number=n)
    await ledger.record(db, graph_id=graph.id, actor_kind="agent", actor_chain=c_hub, actor_agent_id=hub.id, act="escrow.return", layer="agent", touched=f"agent/{hub.name}", touched_line="6.1k returned · 17.9k spent", verdict="allowed", run_id=hub_run.id, run_number=n, where="control plane", at=t0 + timedelta(minutes=7))

    fares_run = await s.child(d_fares, fares, status="failed", exit_reason="no_progress", start=t0 + timedelta(seconds=13), finished=t0 + timedelta(minutes=3, seconds=20), escrow=16_000, returned=9_800)
    c_fares = _chain(owner, auditor, fares)
    for i in range(3):
        await s.step(fares_run, c_fares, seq=i, key=f"web_fetch_{i}", task_key="web.fetch", start=t0 + timedelta(seconds=15 + 40 * i), secs=30, tokens=1_800, number=n)

    delays_run = await s.child(d_delays, delays, status="awaiting_input", exit_reason=None, start=t0 + timedelta(seconds=14), escrow=20_000)
    c_delays = _chain(owner, auditor, delays)
    await s.step(delays_run, c_delays, seq=0, key="graph_read_query", task_key="graph.read.query", start=t0 + timedelta(seconds=16), secs=2, rows=1_284, number=n)
    await s.step(delays_run, c_delays, seq=1, key="llm_reason", task_key="llm.reason", start=t0 + timedelta(seconds=20), secs=40, tokens=18_600, number=n)
    ask_step = await s.step(delays_run, c_delays, seq=2, key="work_delegate", task_key="work.delegate", start=t0 + timedelta(minutes=9), secs=0, status="needs_input", number=n)

    db.add(
        Approval(
            graph_id=graph.id, subject_kind="budget", subject_id=delays_run.id, run_id=delays_run.id,
            step_run_id=ask_step.id, title="More tokens for Delay Analyst", kind="budget",
            asked_by=c_delays, wants="15k more tokens — 1,284 delayed flights left to read",
            routed_reason="started the run", payload={"tokens": 15_000},
            approver_ids=[owner.id], requested_by_id=owner.id, deadline_at=NOW + timedelta(hours=4),
        )
    )
    db.add(
        Approval(
            graph_id=graph.id, subject_kind="delegation", subject_id=delays_run.id, run_id=delays_run.id,
            step_run_id=ask_step.id, title="Delay Analyst wants to delegate to Weather Reader", kind="delegation",
            asked_by=c_delays, wants="delegate to Weather Reader — METARs for 3 airports",
            routed_reason="agent owner", payload={"target_agent_id": weather.id, "escrow": 6_000},
            approver_ids=[owner.id], requested_by_id=owner.id, deadline_at=NOW + timedelta(hours=4),
        )
    )
    await ledger.record(db, graph_id=graph.id, actor_kind="agent", actor_chain=c_delays, actor_agent_id=delays.id, act="work.delegate", layer="agent", touched=f"agent/{weather.name}", touched_line="asks — may delegate: ask", verdict="approval", run_id=delays_run.id, step_run_id=ask_step.id, run_number=n, where="control plane", at=t0 + timedelta(minutes=9))
    await ledger.record(db, graph_id=graph.id, actor_kind="agent", actor_chain=c_fares, actor_agent_id=fares.id, act="web.fetch", layer="web", touched="web/fares.example.com", touched_line="refused — domain not in its world", verdict="refused", refused_by="world", rule="world · web domains", run_id=fares_run.id, run_number=n, where="in-process", at=t0 + timedelta(minutes=2))

    db.add(RunTouch(run_id=root.id, graph_id=graph.id, seq=0, step_key="graph_read_query", address="graph_data/model/Airport", layer="graph_data", sublayer="model", participant="Airport", direction="in", volume={"rows": 214}))
    db.add(Emission(run_id=root.id, seq=0, kind="table", payload={"title": "Delayed routes by hub", "rows": [{"route": f"LHR-{i}"} for i in range(42)]}))

    # ── a closed run, and Route Auditor's failed runs this month ─────────────
    closed, failed = await ended_runs(s, auditor, c_root)

    # ── a run of 700 agents ──────────────────────────────────────────────────
    t2 = NOW - timedelta(minutes=38)
    sweep = await _agent(db, graph, owner, "Network Sweep", budget={"max_tokens_run": 2_000_000, "max_live": 120, "max_descendants": 800})
    many = await s.root(sweep, body="Check every route in the network for schedule conflicts", status="running", started=t2, budget=2_000_000)
    c_sweep = _chain(owner, sweep)
    fan = await s.step(many, c_sweep, seq=0, key="work_spawn", task_key="work.spawn", start=t2 + timedelta(seconds=5), secs=0, status="running", number=many.number)
    roles = [("Route checker", 420), ("Hub summarizer", 140), ("Fare checker", 90), ("Conflict reporter", 50)]
    role_agents = {name: await _agent(db, graph, owner, name, kind="spawned", parent=sweep) for name, _ in roles}
    for name, count in roles:
        for _ in range(count):
            start = t2 + timedelta(seconds=rng.randint(10, 1_800))
            pick = rng.random()
            if pick < 0.72:
                status, reason, finished = "succeeded", "served", start + timedelta(seconds=rng.randint(40, 300))
            elif pick < 0.8:
                status, reason, finished = "failed", rng.choice(["no_progress", "budget_declined", "failed"]), start + timedelta(seconds=rng.randint(40, 200))
            elif pick < 0.92:
                status, reason, finished = "running", None, None
            else:
                status, reason, finished = "queued", None, None
                start = None
            child = TaskRun(
                graph_id=graph.id, parent_run_id=fan.id, agent_id=role_agents[name].id, flow_key="nl-query",
                triggered_by="delegation", status=status, exit_reason=reason, queued_at=start or NOW,
                started_at=start, finished_at=finished, escrow_tokens=2_400, escrow_returned=rng.randint(0, 900) if finished else None,
                tokens=rng.randint(600, 2_200) if start else None,
            )
            db.add(child)
    await db.flush()

    # ── five alert rules, from the ledger head ───────────────────────────────
    head = (await db.execute(select(LedgerRow.seq).where(LedgerRow.graph_id == graph.id).order_by(LedgerRow.seq.desc()))).scalars().first() or 0
    rules = [
        ("Refusals by the world", {"verdict": ["refused"], "refused_by": ["world"]}),
        ("Any write to Airport", {"act": "graph.write*", "touched": "graph/Airport*"}),
        ("A delegation asks", {"act": "work.delegate", "verdict": ["approval"]}),
        ("Escrow returned", {"act": "escrow.return"}),
        ("Five refusals in ten minutes", {"verdict": ["refused"], "threshold": {"count": 5, "window_s": 600}}),
    ]
    for name, match in rules:
        exists = (await db.execute(select(AlertRule).where(AlertRule.graph_id == graph.id, AlertRule.name == name))).scalar_one_or_none()
        if not exists:
            db.add(AlertRule(graph_id=graph.id, name=name, enabled=name != "Escrow returned", match=match, notify_user_ids=[owner.id], last_seq=head, created_by_id=owner.id))
    await db.flush()

    print("tree run       ", root.id, f"#{root.number}")
    print("closed run     ", closed.id, f"#{closed.number}")
    print("700-agent run  ", many.id, f"#{many.number}")
    print("failed runs    ", ", ".join(r.id for r in failed))
    print("Route Auditor  ", auditor.id)
    print("Delay Analyst  ", delays_run.id, "(child, waiting)")


RESTARTED = "engine restarted"


async def revive(db) -> None:
    """Put the seeded live runs back to live after an engine restart.

    The engine fails every queued or running run it finds on startup, and an
    ended run closes its pending asks. The boards need the tree and the
    700-agent run still going, so every run under a seeded root that the
    restart failed is set back to running (queued if it never started), its
    escrow left unsettled, and the asks it held are pending again.
    """
    roots = (
        (await db.execute(select(TaskRun).where(TaskRun.parent_run_id.is_(None), TaskRun.status == "failed")))
        .scalars()
        .all()
    )
    frontier = [r for r in roots if (r.params or {}).get("seed") == "f05" and RESTARTED in str(r.error or "")]
    revived: list[str] = []
    while frontier:
        run = frontier.pop()
        if RESTARTED in str(run.error or "") or RESTARTED in str(run.detail or ""):
            run.status = "running" if run.started_at else "queued"
            run.exit_reason = run.outcome = run.error = run.finished_at = None
            run.detail = ""
            run.escrow_returned = None
            revived.append(run.id)
        frontier.extend((await db.execute(select(TaskRun).where(TaskRun.parent_run_id == run.id))).scalars().all())
    asks = (
        (await db.execute(select(Approval).where(Approval.status == "expired", Approval.payload.is_not(None))))
        .scalars()
        .all()
    )
    reopened = 0
    for ask in asks:
        if ask.title in {"More tokens for Delay Analyst", "Delay Analyst wants to delegate to Weather Reader"}:
            ask.status = "pending"
            ask.deadline_at = NOW + timedelta(hours=4)
            ask.decided_at = None
            reopened += 1
    print(f"revived {len(revived)} runs, reopened {reopened} asks")

    # A test that cleans up after itself may have taken Route Auditor's ended runs.
    owner = (await db.execute(select(User).where(User.username == "admin"))).scalar_one()
    graph = (
        await db.execute(select(Graph).where(Graph.created_by_id == owner.id, Graph.slug == "airways"))
    ).scalar_one()
    auditor = (
        await db.execute(select(Agent).where(Agent.graph_id == graph.id, Agent.name == "Route Auditor"))
    ).scalar_one_or_none()
    if auditor is None:
        return
    ended = (
        await db.execute(
            select(TaskRun.id).where(
                TaskRun.agent_id == auditor.id, TaskRun.parent_run_id.is_(None), TaskRun.status == "succeeded"
            )
        )
    ).first()
    if not ended:
        closed, failed = await ended_runs(Seeder(db, graph, owner), auditor, _chain(owner, auditor))
        print("closed run     ", closed.id, f"#{closed.number}")
        print("failed runs    ", ", ".join(r.id for r in failed))


async def main() -> None:
    engine = await create_db_engine()
    factory = create_session_factory(engine)
    async with factory() as db:
        await (revive(db) if "--revive" in sys.argv else seed(db))
        await db.commit()
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
