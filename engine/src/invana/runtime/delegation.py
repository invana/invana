"""Delegation — agents that create agents (docs/for-developers/modules/work/spec.md).

**No new mechanism.** These are four ordinary task functions that a plan may
contain only if the agent's envelope names them, and the plan is validated
against the envelope before anything runs. Seeded agents do not allow them.

The bounds are enforced **here, in the interpreter** — never by the model and
never by the prompt:

| Bound | Where |
|---|---|
| depth | ``budget.max_depth`` (default 2), against the ``parent_agent_id`` chain |
| fan-out | ``budget.max_children`` (default 3) per run |
| inheritance narrows | a child's allow-list, skills, budget and LLM are ⊆ its parent's |
| the human at the root | ``on_behalf_of_user_id`` is copied down, never re-derived |

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

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.models import Agent, AgentKind, AgentLifetime, AgentStatus
from invana.apps.skills.managers import SkillBindingManager
from invana.apps.skills.querysets import SkillQuerySet
from invana.core.events import actions
from invana.core.events.models import ActorKind
from invana.core.events.services import current_trace_id, emit_event
from invana.runtime.models import RunStatus, TaskRun, TaskStream
from invana.runtime.querysets import TaskRunQuerySet

_skills = SkillQuerySet()
_bindings = SkillBindingManager()

# How long a parent waits on one child before failing its own `delegate` step.
DEFAULT_CHILD_TIMEOUT_S = 300.0
# How often the parent looks; the child's own stream is the record either way.
_POLL_S = 0.5


class BoundExceeded(Exception):
    """A spawn or delegate step asked for more than the envelope allows."""


@dataclass(slots=True)
class ChildOutcome:
    run_id: str
    status: str
    emitted: list[dict]


def narrow(parent: Agent, *, requested: dict) -> dict:
    """Compute a child's bindings as the intersection with its parent's.

    Inheritance **narrows**, always. This is checked at ``spawn_agent`` and
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

    spec = copy.deepcopy(parent_spec)
    spec["allow"] = allow
    # A child never spawns unless its parent's policy says the line continues.
    spec.pop("steps", None)
    spec["entry"] = requested.get("entry") or "understand"
    return {"allow": allow, "skill_ids": skills, "budget": budget, "workflow_spec": spec}


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


async def children_spawned_in(db: AsyncSession, run_id: str) -> int:
    rows = (await db.execute(select(Agent.id).where(Agent.spawned_in_run_id == run_id))).scalars().all()
    return len(rows)


async def spawn(
    db: AsyncSession,
    *,
    parent: Agent,
    run: TaskRun,
    name: str,
    instructions: str,
    requested: dict,
    lifetime: str = AgentLifetime.ephemeral.value,
) -> Agent:
    """Create a child agent under its parent's ceiling."""
    policy = parent.effective_policy
    if not policy.get("can_spawn", False):
        raise BoundExceeded(f"'{parent.name}' is not allowed to spawn agents.")
    if lifetime == AgentLifetime.persistent.value and not policy.get("can_spawn_persistent", False):
        raise BoundExceeded(f"'{parent.name}' may only spawn ephemeral agents.")

    budget = parent.effective_budget
    if await depth_of(db, parent) + 1 > int(budget.get("max_depth", 2)):
        raise BoundExceeded(f"Delegation is capped at depth {budget.get('max_depth', 2)}.")
    if await children_spawned_in(db, run.id) + 1 > int(budget.get("max_children", 3)):
        raise BoundExceeded(f"This run may spawn at most {budget.get('max_children', 3)} agents.")

    narrowed = narrow(parent, requested=requested)
    # A child may only rebind its LLM when the parent's policy says so;
    # otherwise it thinks with the same model, which is what makes a child's
    # cost predictable from its parent's.
    llm_id = requested.get("llm_config_id") if policy.get("can_rebind_llm", False) else None

    child = Agent(
        graph_id=parent.graph_id,
        name=_unique_name(name, parent),
        description=f"Spawned by {parent.name}.",
        kind=AgentKind.spawned.value,
        status=AgentStatus.active.value,
        lifetime=lifetime,
        instructions=instructions,
        workflow_spec=narrowed["workflow_spec"],
        llm_config_id=llm_id or parent.llm_config_id,
        budget=narrowed["budget"],
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
        skill = await _skills.get(db, skill_id)
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
        trace_id=current_trace_id(),
    )
    return child


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
