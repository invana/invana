"""Delegation — agents that create agents (docs/for-developers/modules/work/spec.md).

**No new mechanism.** These are four ordinary task functions that a plan may
contain only if the agent's envelope names them, and the plan is validated
against the envelope before anything runs. Seeded agents do not allow them.

The bounds are enforced **here, in the interpreter** — never by the model and
never by the prompt:

| Bound | Where |
|---|---|
| depth | ``budget.max_depth`` (default 2), against the ``parent_agent_id`` chain |
| fan-out | ``budget.max_children`` (default 3) per agent per run |
| the whole tree | ``budget.max_descendants`` (default 12) helpers under the root run |
| at once | ``budget.max_live`` (default 4) child runs live; past it a child waits ``queued`` |
| budget | a child run's budget is its **escrow**, moved out of the parent's remaining |
| may delegate to | ``policy.may_delegate`` — ``always`` runs, ``never`` is refused, ``ask`` asks the owner |
| no loops | a delegation into an agent already in the run's chain is refused |
| inheritance narrows | a child's allow-list, skills, budget and LLM are ⊆ its parent's |
| the human at the root | ``on_behalf_of_user_id`` is copied down, never re-derived |
| policies | a held policy's depth, descendants, live agents and tokens a run clamp the agent's own |

**Escrow.** A parent's *remaining* is its run budget less its own tokens less
every live child's escrow less what each ended child spent, so a parent never
promises the same tokens twice. When a child ends, :func:`settle_escrow` writes
``escrow_returned`` and a ledger row says so.

Every spawn, refused spawn and escrow return is a ledger row
(:mod:`invana.runtime.ledger_acts`).

A child is a **full run** — its own plan, its own stream, its own trace
(R3) — and the parent's ``delegate`` step tails its emissions (R2). That is
this feature's other job: it is the first real use of the chain-of-runs
seam, which is how we find out whether the seam works before building a
composition language on top of it.
"""

from __future__ import annotations

import asyncio
import copy
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.models import DEFAULT_BUDGET, Agent, AgentKind, AgentLifetime, AgentStatus
from invana.apps.graphs.models import Graph
from invana.apps.skills.managers import SkillBindingManager
from invana.apps.skills.querysets import SkillQuerySet
from invana.core.events import actions
from invana.core.events.models import ActorKind
from invana.core.events.services import emit_event
from invana.runtime import access, ledger_acts
from invana.runtime.models import ExitReason, RunStatus, TaskRun, TaskStream
from invana.runtime.querysets import TaskRunQuerySet
from invana.runtime.results import run_tokens

_skills_qs = SkillQuerySet()
_bindings = SkillBindingManager()

# How long a parent waits on one child before failing its own `delegate` step.
DEFAULT_CHILD_TIMEOUT_S = 300.0
# How often the parent looks; the child's own stream is the record either way.
_POLL_S = 0.5


#: The statuses a child run holds escrow in.
_LIVE = (RunStatus.queued.value, RunStatus.running.value, RunStatus.awaiting_input.value)

#: ``may_delegate`` values.
ALWAYS, ASK, NEVER = "always", "ask", "never"


class BoundExceeded(Exception):
    """A spawn or delegate step asked for more than the envelope allows.

    ``refused_by`` is the ledger's reason (``ceiling`` · ``policy``), ``cause``
    the step's failure code, and ``ceiling`` / ``count`` name the bound and
    how far the run already is against it.
    """

    def __init__(
        self,
        message: str,
        *,
        refused_by: str = "ceiling",
        cause: str = "bound_exceeded",
        ceiling: str | None = None,
        count: int | None = None,
    ) -> None:
        super().__init__(message)
        self.refused_by = refused_by
        self.cause = cause
        self.ceiling = ceiling
        self.count = count

    @property
    def evidence(self) -> dict:
        """What a step failure carries about the refusal."""
        return {"refused_by": self.refused_by, "ceiling": self.ceiling, "count": self.count}


def ceiling(agent: Agent, key: str) -> int:
    """One of the agent's delegation ceilings, its default where unset."""
    try:
        return int(agent.effective_budget.get(key, DEFAULT_BUDGET.get(key, 0)))
    except (TypeError, ValueError):
        return int(DEFAULT_BUDGET.get(key, 0))


async def bound_of(db: AsyncSession, agent: Agent, key: str, *, run: TaskRun | None) -> tuple[int, str | None]:
    """A ceiling as it binds at run time: the smaller of the agent's and its policies'.

    Returns the value and the policy that set it, or ``None`` when the
    agent's own setting is the tighter one.
    """
    own = ceiling(agent, key)
    capped = (await access.AccessGate().limits(db, agent=agent, run=run)).get(key)
    if capped is not None and capped[0] < own:
        return capped
    return own, None


def _named(policy: str | None) -> str:
    return f" by policy {policy}" if policy else ""


@dataclass(slots=True)
class ChildOutcome:
    run_id: str
    status: str
    emitted: list[dict]


def narrow(parent: Agent, *, requested: dict) -> dict:
    """Compute a child's bindings as the intersection with its parent's.

    Inheritance **narrows**, always. This is checked at ``work.spawn_agent`` and
    again when the child's own plan is validated, so a child cannot widen its
    reach by planning something its parent could not have run.
    """
    parent_spec = parent.workflow_spec or {}
    parent_allow = set(parent_spec.get("allow") or [])
    wanted_allow = set(requested.get("allow") or parent_allow)
    allow = sorted(wanted_allow & parent_allow) if parent_allow else sorted(wanted_allow)

    parent_skills = set(parent.skill_ids or [])
    wanted_skills = set(requested.get("skill_ids") or parent_skills)
    skills = sorted(wanted_skills & parent_skills)

    parent_budget = parent.effective_budget
    budget: dict = {}
    for key, parent_value in parent_budget.items():
        wanted = (requested.get("budget") or {}).get(key, parent_value)
        try:
            budget[key] = min(wanted, parent_value)
        except TypeError:
            budget[key] = parent_value
    # A child is one level deeper, so its own depth allowance shrinks by one —
    # otherwise `max_depth` would only ever bound the first hop.
    budget["max_depth"] = max(0, int(parent_budget.get("max_depth", 2)) - 1)

    # Effort narrows the same way (EB9). A request that still names these under
    # `budget` — where they lived before — is read for one release.
    wanted_effort = {**(requested.get("budget") or {}), **(requested.get("effort") or {})}
    effort: dict = {}
    for key, parent_value in parent.effective_effort.items():
        wanted = wanted_effort.get(key, parent_value)
        try:
            effort[key] = min(int(wanted), parent_value)
        except (TypeError, ValueError):
            effort[key] = parent_value

    spec = copy.deepcopy(parent_spec)
    spec["allow"] = allow
    # A child never spawns unless its parent's policy says the line continues.
    spec.pop("steps", None)
    spec["entry"] = requested.get("entry") or "understand"
    return {"allow": allow, "skill_ids": skills, "budget": budget, "effort": effort, "workflow_spec": spec}


async def depth_of(db: AsyncSession, agent: Agent) -> int:
    depth = 0
    node = agent
    while node.parent_agent_id and depth < 16:
        parent = await db.get(Agent, node.parent_agent_id)
        if parent is None:
            break
        node = parent
        depth += 1
    return depth


async def children_spawned_in(db: AsyncSession, run_id: str, *, parent_agent_id: str | None = None) -> int:
    """Helpers spawned in one run — by one agent, when ``parent_agent_id`` is named."""
    stmt = select(Agent.id).where(Agent.spawned_in_run_id == run_id)
    if parent_agent_id is not None:
        stmt = stmt.where(Agent.parent_agent_id == parent_agent_id)
    return len((await db.execute(stmt)).scalars().all())


async def descendants_spawned(db: AsyncSession, run: TaskRun) -> int:
    """Helpers spawned anywhere in the tree under ``run``'s root."""
    root = await ledger_acts.root_of(db, run)
    tree = [root.id, *await descendants(db, root.id)]
    stmt = select(Agent.id).where(Agent.spawned_in_run_id.in_(tree))
    return len((await db.execute(stmt)).scalars().all())


async def spawn(
    db: AsyncSession,
    *,
    parent: Agent,
    run: TaskRun,
    name: str,
    instructions: str,
    requested: dict,
    lifetime: str = AgentLifetime.ephemeral.value,
    step_id: str | None = None,
) -> Agent:
    """Create a child agent under its parent's ceilings, and write its ledger row.

    Refused before anything is created when a ceiling is reached — depth,
    children per agent in this run, helpers in the whole tree — or when the
    budget it asks for is more than the run has left. A refusal names the bound
    and the count, is a ``refused`` ledger row, and raises :class:`BoundExceeded`.
    """
    try:
        await _check_spawn(db, parent=parent, run=run, requested=requested, lifetime=lifetime)
    except BoundExceeded as refused:
        await ledger_acts.spawn_refused(
            db,
            run=run,
            name=(name or "Helper").strip(),
            refused_by=refused.refused_by,
            rule=str(refused),
            step_run_id=step_id,
        )
        raise

    narrowed = narrow(parent, requested=requested)

    child = Agent(
        graph_id=parent.graph_id,
        name=_unique_name(name, parent),
        description=f"Spawned by {parent.name}.",
        kind=AgentKind.spawned.value,
        status=AgentStatus.active.value,
        lifetime=lifetime,
        instructions=instructions,
        workflow_spec=narrowed["workflow_spec"],
        budget=narrowed["budget"],
        effort=narrowed["effort"],
        # A child speaks as its parent does — the spawn names no other voice
        # (soul.md § Seams). Words only, so inheriting it widens nothing.
        soul=parent.soul,
        soul_traits=dict(parent.soul_traits or {}),
        # Bounded agency does not propagate by default: a spawned agent cannot
        # spawn unless it was deliberately given the policy.
        policy={"can_spawn": False, "can_be_assigned": False},
        parent_agent_id=parent.id,
        spawned_in_run_id=run.id,
        created_by_kind="agent",
        created_by_id=parent.id,
    )
    db.add(child)
    await db.flush()

    # A spawned agent's bindings are named at spawn (BN4) and are rows like any
    # other, written by the one manager that writes them. The parent is the
    # actor: nobody typed this.
    for skill_id in narrowed["skill_ids"]:
        skill = await _skills_qs.get(db, skill_id)
        if skill is None:
            continue
        await _bindings.bind(db, skill=skill, agent_id=child.id, agent_name=child.name, actor_id=parent.id)
    await db.refresh(child, ["bound_skills"])

    await emit_event(
        db,
        action=actions.AGENT_SPAWN,
        target_kind=actions.TARGET_AGENT,
        target_id=child.id,
        graph_id=parent.graph_id,
        task_id=run.todo_id,
        run_id=run.id,
        actor_kind=ActorKind.agent,
        actor_id=parent.id,
        on_behalf_of_user_id=run.on_behalf_of_user_id,
        details={"actor_name": parent.name, "child_name": child.name, "lifetime": lifetime},
    )
    await ledger_acts.spawned(
        db,
        run=run,
        child=child,
        depth=await depth_of(db, child),
        escrow=int(narrowed["budget"].get("max_tokens_run") or 0) or None,
        step_run_id=step_id,
    )
    return child


async def _check_spawn(db: AsyncSession, *, parent: Agent, run: TaskRun, requested: dict, lifetime: str) -> None:
    """Raise :class:`BoundExceeded` naming the first bound this spawn would cross."""
    policy = parent.effective_policy
    if not policy.get("can_spawn", False):
        raise BoundExceeded(f"'{parent.name}' is not allowed to spawn agents.", refused_by="policy")
    if lifetime == AgentLifetime.persistent.value and not policy.get("can_spawn_persistent", False):
        raise BoundExceeded(f"'{parent.name}' may only spawn ephemeral agents.", refused_by="policy")

    depth, (max_depth, by) = await depth_of(db, parent) + 1, await bound_of(db, parent, "max_depth", run=run)
    if depth > max_depth:
        raise BoundExceeded(
            f"Delegation is capped at depth {max_depth}{_named(by)}; this helper would be at depth {depth}.",
            ceiling="max_depth",
            count=depth - 1,
        )
    children = await children_spawned_in(db, run.id, parent_agent_id=parent.id)
    max_children = ceiling(parent, "max_children")
    if children + 1 > max_children:
        raise BoundExceeded(
            f"{parent.name} may spawn at most {max_children} agents in this run, and has spawned {children}.",
            ceiling="max_children",
            count=children,
        )
    tree, (max_tree, by) = await descendants_spawned(db, run), await bound_of(db, parent, "max_descendants", run=run)
    if tree + 1 > max_tree:
        raise BoundExceeded(
            f"This run may have at most {max_tree} helpers in all{_named(by)}, and {tree} are spawned.",
            ceiling="max_descendants",
            count=tree,
        )
    wanted = (requested.get("budget") or {}).get("max_tokens_run")
    if wanted is not None:
        left = await remaining(db, run)
        if left is not None and int(wanted) > left:
            raise BoundExceeded(
                f"Asked for {int(wanted)} tokens, and this run has {left} left.",
                ceiling="max_tokens_run",
                count=left,
            )


# ── escrow ────────────────────────────────────────────────────────────────────


def run_budget(run: TaskRun, agent: Agent | None) -> int | None:
    """The tokens one run may spend: its escrow, else what it froze at open, else its agent's.

    ``None`` is a run nothing bounds — no escrow, no frozen budget and no agent.
    """
    if run.escrow_tokens is not None:
        return int(run.escrow_tokens)
    frozen = (run.params or {}).get("max_tokens_run")
    if frozen:
        return int(frozen)
    if agent is not None:
        return int(agent.effective_budget.get("max_tokens_run") or 0) or None
    return None


async def budget_of(db: AsyncSession, run: TaskRun, agent: Agent | None) -> int | None:
    """:func:`run_budget` under the policies' tokens a run: the smaller of the two binds."""
    budget = run_budget(run, agent)
    capped = (await access.AccessGate().limits(db, agent=agent, run=run)).get("max_tokens_run")
    if capped is None:
        return budget
    return capped[0] if budget is None else min(budget, capped[0])


async def spent(db: AsyncSession, run: TaskRun) -> int:
    """The run's own tokens so far — itself and its direct steps, never its children."""
    tokens_in, tokens_out = run_tokens(run, await TaskRunQuerySet().nodes_of(db, run_id=run.id))
    return tokens_in + tokens_out


async def _children(db: AsyncSession, run: TaskRun) -> list[TaskRun]:
    """The runs delegated from ``run``'s steps, re-read: they settle in their own sessions."""
    children = await TaskRunQuerySet().children_of_nodes(db, run_id=run.id)
    for child in children:
        await db.refresh(child, ["status", "escrow_tokens", "escrow_returned", "queued_at"])
    return children


async def remaining(db: AsyncSession, run: TaskRun) -> int | None:
    """What ``run`` may still promise: its budget less its own tokens, live escrows and what ended children spent."""
    agent = await db.get(Agent, run.agent_id) if run.agent_id else None
    budget = await budget_of(db, run, agent)
    if budget is None:
        return None
    held = 0
    for child in await _children(db, run):
        if child.escrow_tokens is None:
            continue
        if child.status in _LIVE or child.escrow_returned is None:
            held += child.escrow_tokens
        else:
            held += max(0, child.escrow_tokens - child.escrow_returned)
    return max(0, budget - await spent(db, run) - held)


async def take_escrow(db: AsyncSession, *, parent_run: TaskRun, child_agent: Agent, wanted: int | None) -> int | None:
    """How many tokens the child run is escrowed, or a refusal naming the remainder.

    ``wanted`` is what the step asked for; with none, the child takes its own
    run budget or an even share of the remainder across the children its
    agent may still open, whichever is smaller. ``None`` is a parent nothing
    bounds, whose child is bounded by its own agent alone.
    """
    left = await remaining(db, parent_run)
    if left is None:
        return int(wanted) if wanted else None
    if wanted is not None and int(wanted) > left:
        raise BoundExceeded(
            f"Asked to escrow {int(wanted)} tokens, and this run has {left} left.",
            ceiling="max_tokens_run",
            count=left,
        )
    if left <= 0:
        raise BoundExceeded("This run has no tokens left to hand a helper.", ceiling="max_tokens_run", count=0)
    if wanted is not None:
        return int(wanted)
    parent = await db.get(Agent, parent_run.agent_id) if parent_run.agent_id else None
    open_slots = max(1, ceiling(parent, "max_children") - len(await _children(db, parent_run))) if parent else 1
    own = int(child_agent.effective_budget.get("max_tokens_run") or 0) or left
    return max(1, min(own, left // open_slots or left))


async def settle_escrow(db: AsyncSession, run: TaskRun) -> None:
    """Return a child run's unspent escrow once it has ended, and write the ledger row.

    Idempotent: a run whose return is written is left alone. A run with no
    escrow is not a child and has nothing to return.
    """
    if run.escrow_tokens is None or run.escrow_returned is not None:
        return
    used = await spent(db, run)
    run.escrow_returned = max(0, int(run.escrow_tokens) - used)
    await ledger_acts.escrow_returned(db, run=run, returned=run.escrow_returned, spent=used)


async def wait_for_room(db: AsyncSession, *, parent_run: TaskRun, child_run: TaskRun, timeout_s: float) -> bool:
    """Hold a child ``queued`` while its parent already has ``max_live`` children live.

    Only the siblings queued before it count, so children start in the order
    they were opened. Returns False when the wait ran out.
    """
    parent = await db.get(Agent, parent_run.agent_id) if parent_run.agent_id else None
    if parent is None:
        return True
    max_live, _ = await bound_of(db, parent, "max_live", run=parent_run)
    deadline = asyncio.get_running_loop().time() + timeout_s
    while True:
        ahead = [
            c
            for c in await _children(db, parent_run)
            if c.id != child_run.id and c.status in _LIVE and c.queued_at <= child_run.queued_at
        ]
        if len(ahead) < max_live:
            return True
        if asyncio.get_running_loop().time() >= deadline:
            return False
        await asyncio.sleep(_POLL_S)


# ── may delegate to ───────────────────────────────────────────────────────────


def may_delegate(caller: Agent, target: Agent) -> str:
    """``always`` · ``ask`` · ``never`` — how ``caller`` may hand work to ``target``.

    A helper the caller spawned itself is always allowed: spawning it was the
    permission. An authored agent the caller's list does not name is ``ask``.
    ``always`` holds only under the caller's policies: inside a step whose
    access check found no policy allowing ``work.delegate`` on the target, it
    asks the owner instead.
    """
    if target.parent_agent_id == caller.id:
        return ALWAYS
    listed = (caller.effective_policy.get("may_delegate") or {}).get(target.id)
    if listed == ALWAYS and (access.delegate_allowed.get() or {}).get(target.id) is False:
        return ASK
    return listed if listed in (ALWAYS, ASK, NEVER) else ASK


def allow_always(caller: Agent, target: Agent) -> None:
    """Write ``always`` for ``target`` into ``caller``'s *May delegate to*."""
    policy = dict(caller.policy or {})
    listed = dict(policy.get("may_delegate") or {})
    if listed.get(target.id) == ALWAYS:
        return
    listed[target.id] = ALWAYS
    policy["may_delegate"] = listed
    caller.policy = policy


async def refuse_loop(db: AsyncSession, *, run: TaskRun, target: Agent) -> None:
    """Refuse a delegation into an agent already in the run's chain."""
    if target.id in await ledger_acts.agents_in_chain(db, run):
        raise BoundExceeded(
            f"{target.name} is already working in this run; handing it the work again would loop.",
            refused_by="policy",
            cause="loop",
        )


async def owner_of(db: AsyncSession, agent: Agent) -> list[str]:
    """Who an ask about ``agent`` goes to: the person who made it, else the Graph's owner.

    A spawned helper's owner is its nearest ancestor a person made.
    """
    node: Agent | None = agent
    depth = 0
    while node is not None and depth < 16:
        if node.created_by_kind == "user" and node.created_by_id:
            return [node.created_by_id]
        node = await db.get(Agent, node.parent_agent_id) if node.parent_agent_id else None
        depth += 1
    graph = await db.get(Graph, agent.graph_id)
    return [graph.created_by_id] if graph is not None and graph.created_by_id else []


# ── cancellation ──────────────────────────────────────────────────────────────


async def end_waiting_children(db: AsyncSession, run_ids: list[str]) -> list[TaskRun]:
    """End the delegated runs under a cancelled parent that never started working.

    A child waiting for room is a row with no task behind it, so nothing would
    otherwise move it: it ends ``cancelled · parent_ended`` here, and its escrow
    goes back.
    """
    if not run_ids:
        return []
    rows = (
        (
            await db.execute(
                select(TaskRun).where(
                    TaskRun.id.in_(run_ids),
                    TaskRun.task_key == "",
                    TaskRun.status.in_([RunStatus.queued.value, RunStatus.awaiting_input.value]),
                )
            )
        )
        .scalars()
        .all()
    )
    for row in rows:
        row.status = RunStatus.cancelled.value
        row.outcome = "cancelled"
        row.finished_at = datetime.now(UTC)
        row.exit_reason = ExitReason.parent_ended.value
        await settle_escrow(db, row)
        await ledger_acts.run_ended(db, run=row, reason=row.exit_reason)
    return list(rows)


def _unique_name(name: str, parent: Agent) -> str:
    """Names are unique per graph, and a spawned agent's name is model-chosen.

    Suffixing with the parent keeps the constraint satisfiable without failing
    the step over a collision the user did not cause.
    """
    cleaned = (name or "Helper").strip()[:180]
    return f"{cleaned} · {parent.name}"[:255]


async def await_children(
    db: AsyncSession,
    *,
    run_ids: list[str],
    timeout_s: float = DEFAULT_CHILD_TIMEOUT_S,
) -> list[ChildOutcome]:
    """Fan-in: wait for each child to settle, then hand back what it emitted.

    The parent reads the child's **stream**, not its return value — R2 in
    practice. A child that never settles fails the parent's step with a reason
    rather than hanging the parent forever.
    """
    deadline = asyncio.get_running_loop().time() + timeout_s
    pending = set(run_ids)
    outcomes: dict[str, ChildOutcome] = {}

    while pending and asyncio.get_running_loop().time() < deadline:
        for run_id in list(pending):
            # Expire the identity map: the child runs on its own DB session, so
            # the parent has to re-read rather than trust what it cached.
            db.expire_all()
            child = await TaskRunQuerySet().get(db, run_id)
            if child is None:
                outcomes[run_id] = ChildOutcome(run_id, "missing", [])
                pending.discard(run_id)
                continue
            if child.status in {
                RunStatus.succeeded.value,
                RunStatus.failed.value,
                RunStatus.cancelled.value,
            }:
                outcomes[run_id] = ChildOutcome(run_id, child.status, await _emissions(db, run_id))
                pending.discard(run_id)
        if pending:
            await asyncio.sleep(_POLL_S)

    for run_id in pending:
        outcomes[run_id] = ChildOutcome(run_id, "timed_out", await _emissions(db, run_id))
    return [outcomes[t] for t in run_ids]


async def _emissions(db: AsyncSession, run_id: str) -> list[dict]:
    """What the child said, addressed by ``(run_id, seq, kind)``.

    Only the kinds a parent can act on — a child's step chatter belongs to the
    child's own trace, not to its parent's working set.
    """
    rows = (
        (
            await db.execute(
                select(TaskStream)
                .where(
                    TaskStream.run_id == run_id,
                    TaskStream.kind.in_(["result", "metric", "chart.spec", "table.page", "cannot_answer"]),
                )
                .order_by(TaskStream.seq)
            )
        )
        .scalars()
        .all()
    )
    return [{"run_id": run_id, "seq": r.seq, "kind": r.kind, "payload": r.payload} for r in rows]


async def cost_rollup(db: AsyncSession, *, run_id: str) -> dict:
    """Own tokens, and the children's, summed up the ``parent_run_id`` tree.

    Summed on read: the tree is tens of rows, and materialising it would be a
    cache to invalidate for a number nobody sorts by.
    """
    own_in = own_out = child_in = child_out = 0
    frontier = [run_id]
    depth = 0
    while frontier and depth < 8:
        rows = (
            await db.execute(
                select(TaskRun.tokens_in, TaskRun.tokens_out, TaskRun.parent_run_id).where(
                    TaskRun.parent_run_id.in_(frontier)
                )
            )
        ).all()
        for tokens_in, tokens_out, owner in rows:
            if owner == run_id:
                own_in += tokens_in or 0
                own_out += tokens_out or 0
            else:
                child_in += tokens_in or 0
                child_out += tokens_out or 0
        frontier = list(
            (await db.execute(select(TaskRun.id).where(TaskRun.parent_run_id.in_(frontier)))).scalars().all()
        )
        depth += 1
    return {
        "own_tokens": own_in + own_out,
        "child_tokens": child_in + child_out,
        "total_tokens": own_in + own_out + child_in + child_out,
    }


async def descendants(db: AsyncSession, run_id: str) -> list[str]:
    """Every run under this one — what a cancel has to walk."""
    out: list[str] = []
    frontier = [run_id]
    depth = 0
    while frontier and depth < 8:
        frontier = list(
            (await db.execute(select(TaskRun.id).where(TaskRun.parent_run_id.in_(frontier)))).scalars().all()
        )
        out.extend(frontier)
        depth += 1
    return out
