"""The runtime's acts, as ledger rows (docs/for-developers/modules/operate/features/the-ledger.md).

:func:`invana.core.ledger.record` is the one writer; this module is what the
runtime hands it. Every helper resolves **who acted** the same way — the person
the run is on behalf of, then each agent from the root run down to the acting
one, by the names they carry now — and writes into the caller's session, so a
row commits or rolls back with the act it describes::

    from invana.runtime import ledger_acts

    await ledger_acts.step_settled(db, run=th, step=row, touch=touch, verdict="allowed")
    await ledger_acts.spawned(db, run=th, parent=agent, child=child, depth=1, escrow=40_000)
    await ledger_acts.escrow_returned(db, run=child_run, returned=12_000)

A later rename never rewrites a row: names are snapshotted into
``actor_chain`` and ``touched`` when the row is written.

| Helper | Row |
|---|---|
| :func:`step_settled` | a step the interpreter settled — ``act`` is its function |
| :func:`touch_refused` | a participant the frozen lens refused |
| :func:`spawned` · :func:`spawn_refused` | a helper agent created, or refused at a ceiling |
| :func:`escrow_returned` | a child's unspent escrow going back to its parent |
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.models import Agent
from invana.core import ledger
from invana.core.auth.models import User
from invana.core.events import actions
from invana.core.redaction import redact
from invana.runtime.models import TaskRun

#: The function's bound → the ledger's layer.
_LAYER_BY_BOUND = {
    "graph_read": "graph",
    "graph_write": "graph",
    "schema_write": "graph",
    "ingest": "graph",
    "llm": "llm",
    "network": "web",
    "web": "web",
    "work_write": "agent",
}

#: Where an in-process step ran.
IN_PROCESS = "in-process"
#: Where a spawn is decided: never on a worker.
CONTROL_PLANE = "control plane"

#: The largest argument document a row keeps whole; past it, only the keys.
_ARGS_MAX = 2048

#: The deepest a run tree is walked.
_MAX_DEPTH = 16


@dataclass(slots=True)
class Actor:
    """Who acted: the chain, the acting principal, and the root run's number."""

    chain: list[dict] = field(default_factory=list)
    kind: str = "system"
    user_id: str | None = None
    agent_id: str | None = None
    run_number: int | None = None


def layer_for(task_key: str) -> str:
    """The ledger layer of one function, read from its manifest's bound."""
    # Imported here: the plugin SDK imports the governor, which writes through this module.
    from invana.plugins import load_plugins  # noqa: PLC0415

    manifest = load_plugins().task(task_key)
    bound = str(getattr(manifest, "bound", "") or "") if manifest is not None else ""
    return _LAYER_BY_BOUND.get(bound, "run")


def volume_line(volume: dict | None) -> str:
    """``12 rows`` · ``1.4k tokens`` — the short line a touch's volume reads as."""
    volume = volume or {}
    if volume.get("rows") is not None:
        rows = int(volume["rows"])
        return f"{rows} row" if rows == 1 else f"{rows} rows"
    tokens = int(volume.get("tokens_in") or 0) + int(volume.get("tokens_out") or 0)
    if tokens:
        return f"{_short(tokens)} tokens"
    return ""


def _short(n: int) -> str:
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}M".replace(".0M", "M")
    if n >= 1000:
        return f"{n / 1000:.1f}k".replace(".0k", "k")
    return str(n)


def tokens_line(n: int | None) -> str:
    """``40k`` — a token count as a row says it."""
    return _short(int(n or 0))


def _args(args: dict | None) -> dict:
    """The step's arguments as the row keeps them: redacted, and bounded in size."""
    safe = redact(dict(args or {}))
    try:
        body = json.dumps(safe, default=str)
    except (TypeError, ValueError):
        return {"keys": sorted(safe)}
    if len(body) > _ARGS_MAX:
        return {"keys": sorted(safe), "truncated": True}
    return json.loads(body)


async def root_of(db: AsyncSession, run: TaskRun) -> TaskRun:
    """The run with no parent above ``run`` — the one a person or a schedule opened."""
    node, depth = run, 0
    while node.parent_run_id and depth < _MAX_DEPTH:
        parent = await db.get(TaskRun, node.parent_run_id)
        if parent is None:
            break
        node, depth = parent, depth + 1
    return node


async def agents_in_chain(db: AsyncSession, run: TaskRun) -> list[str]:
    """The agent ids from the root run down to ``run``, each once, in order."""
    ids: list[str] = []
    node: TaskRun | None = run
    depth = 0
    while node is not None and depth < _MAX_DEPTH:
        if node.agent_id and (not ids or ids[-1] != node.agent_id):
            ids.append(node.agent_id)
        node = await db.get(TaskRun, node.parent_run_id) if node.parent_run_id else None
        depth += 1
    return list(reversed(ids))


async def actor_of(db: AsyncSession, run: TaskRun) -> Actor:
    """Resolve the chain that acted in ``run``: the person, then each agent to the acting one."""
    root = await root_of(db, run)
    chain: list[dict] = []
    user_id = run.on_behalf_of_user_id or root.on_behalf_of_user_id or root.author_id
    if user_id:
        user = await db.get(User, user_id)
        chain.append({"kind": "person", "id": user_id, "name": user.username if user else ""})
    agent_ids = await agents_in_chain(db, run)
    for agent_id in agent_ids:
        agent = await db.get(Agent, agent_id)
        chain.append({"kind": "agent", "id": agent_id, "name": agent.name if agent else ""})
    acting = agent_ids[-1] if agent_ids else None
    return Actor(
        chain=chain,
        kind="agent" if acting else ("person" if user_id else "system"),
        user_id=user_id,
        agent_id=acting,
        run_number=root.number,
    )


async def _record(db: AsyncSession, *, run: TaskRun, actor: Actor | None = None, **row: Any) -> None:
    actor = actor or await actor_of(db, run)
    await ledger.record(
        db,
        graph_id=run.graph_id,
        actor_kind=actor.kind,
        actor_chain=actor.chain,
        actor_user_id=actor.user_id,
        actor_agent_id=actor.agent_id,
        run_id=run.id,
        run_number=actor.run_number,
        **row,
    )


async def step_settled(
    db: AsyncSession,
    *,
    run: TaskRun,
    step: TaskRun,
    touched: str = "",
    touched_line: str = "",
    verdict: str = "allowed",
    refused_by: str | None = None,
    rule: str = "",
    where: str = IN_PROCESS,
) -> None:
    """One row for a step the interpreter settled, whichever way it went."""
    await _record(
        db,
        run=run,
        act=step.task_key or "run",
        layer=layer_for(step.task_key),
        touched=touched,
        touched_line=touched_line,
        verdict=verdict,
        refused_by=refused_by,
        rule=rule,
        step_run_id=step.id,
        where=where,
        args=_args(step.args),
    )


async def touch_refused(
    db: AsyncSession,
    *,
    run_id: str,
    address: str,
    act: str,
    rule: str = "",
    refused_by: str = "lens",
    step_run_id: str | None = None,
) -> None:
    """One row for a participant the run's frozen lens refused."""
    run = await db.get(TaskRun, run_id)
    if run is None:
        return
    await _record(
        db,
        run=run,
        act=act or "touch",
        layer=_layer_of_address(address),
        touched=address,
        verdict="refused",
        refused_by=refused_by,
        rule=rule,
        step_run_id=step_run_id,
        where=IN_PROCESS,
    )


def _layer_of_address(address: str) -> str:
    head = address.split("/", 1)[0]
    if head.startswith("graph"):
        return "graph"
    return {"llm": "llm", "web": "web", "secret": "secret", "secrets": "secret"}.get(head, "run")


async def spawned(
    db: AsyncSession,
    *,
    run: TaskRun,
    child: Agent,
    depth: int,
    escrow: int | None,
    step_run_id: str | None = None,
) -> None:
    """One row for a helper agent created under a run."""
    line = f"depth {depth}" + (f" · escrow {tokens_line(escrow)}" if escrow else "")
    await _record(
        db,
        run=run,
        act="work.spawn_agent",
        layer="agent",
        touched=f"agent/{child.name}",
        touched_line=line,
        verdict="allowed",
        step_run_id=step_run_id,
        where=CONTROL_PLANE,
    )


async def spawn_refused(
    db: AsyncSession,
    *,
    run: TaskRun,
    name: str,
    refused_by: str,
    rule: str,
    step_run_id: str | None = None,
) -> None:
    """One row for a spawn refused before dispatch, naming the bound."""
    await _record(
        db,
        run=run,
        act="work.spawn_agent",
        layer="agent",
        touched=f"agent/{name}",
        verdict="refused",
        refused_by=refused_by,
        rule=rule,
        step_run_id=step_run_id,
        where=CONTROL_PLANE,
    )


async def run_ended(db: AsyncSession, *, run: TaskRun, reason: str) -> None:
    """One row for a run ended by something other than its own work — its parent ending."""
    agent = await db.get(Agent, run.agent_id) if run.agent_id else None
    await _record(
        db,
        run=run,
        act="run.end",
        layer="run",
        touched=f"agent/{agent.name}" if agent else f"run/{run.id}",
        touched_line=reason.replace("_", " "),
        verdict="allowed",
        where=CONTROL_PLANE,
    )


async def escrow_returned(db: AsyncSession, *, run: TaskRun, returned: int, spent: int) -> None:
    """One row for a child run's unspent escrow going back to its parent."""
    agent = await db.get(Agent, run.agent_id) if run.agent_id else None
    await _record(
        db,
        run=run,
        act=actions.ESCROW_RETURN,
        layer="agent",
        touched=f"agent/{agent.name if agent else run.agent_id or 'run'}",
        touched_line=f"{tokens_line(returned)} returned · {tokens_line(spent)} spent",
        verdict="allowed",
        where=CONTROL_PLANE,
    )
