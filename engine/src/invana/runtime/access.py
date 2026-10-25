"""Effective access — the check every step passes before it dispatches.

docs/for-developers/modules/identity-and-access/features/effective-access.md ·
features/policies.md. What a run may do is the intersection of the layers that
bound it; this module runs the **policy layers** of that intersection:

| Layer | Reads | Applies when |
|---|---|---|
| its policies | the run's agent's holdings — a spawned agent reads its lead's | the run has an agent |
| started by | the person at the root run: their Graph roles and attachments | a person started it |
| boundary | every saved boundary policy, each on its own | always (none allows) |

The world is the run's frozen lens and keeps enforcing as each step touches a
participant; the dispatch check leaves it to the governor. Skill needs are the
plan itself.

One pure function, :func:`decide`, answers every layer for one action on one
resource, so the dispatch check, Test access, the effective-access matrix and
a policy's impact all agree. :class:`AccessGate` gathers what a run holds and
calls it before each dispatched step whose function has a bound::

    gate = AccessGate()
    await gate.check(db, run=th, step_key=row.task_key, args=row.args, vars=v)  # raises TaskFailure

A refusal fails the step ``bound · policy_refused`` with a message that names
the layer and the policies (*viewer does not allow work.create_task on
project/\\**), and the step's ledger row is ``refused`` by ``grant``.

Limits ride the same holdings: :meth:`AccessGate.limits` is the tightest
ceiling per budget key across the agent's policies and the boundaries, which
delegation and the run budget clamp to, and :meth:`AccessGate.month_refusal`
refuses a new run once a held policy's tokens a month are spent.

``work.delegate`` keeps the agent's own *May delegate to* under its policies:
when its policies do not allow ``work.delegate`` on the target, the step is not
refused but asks the target's owner instead of running at once. The gate notes
the verdict in :data:`delegate_allowed` for :func:`invana.runtime.delegation.may_delegate`
to read inside the same step.
"""

from __future__ import annotations

import contextvars
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlparse

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.models import Agent, AgentKind
from invana.apps.iam.managers import Held, HoldingsManager
from invana.apps.iam.managers.attachments import AttachmentManager, GraphHolders
from invana.apps.iam.models import Policy, PolicyKind
from invana.core.policy import allows, layer_of
from invana.runtime import ledger_acts
from invana.runtime.catalogue import CATALOGUE, RunVars, TaskFailure
from invana.runtime.models import TaskRun
from invana.runtime.querysets.access import AccessQuerySet

#: A policy limit → the agent budget key it ceilings.
LIMIT_KEYS: dict[str, str] = {
    "tokens_run": "max_tokens_run",
    "tokens_month": "max_tokens_month",
    "descendants": "max_descendants",
    "depth": "max_depth",
    "live_agents": "max_live",
}

#: The bounds whose functions read or change the Graph's records and models.
GRAPH_BOUNDS = frozenset({"graph_read", "graph_write", "schema_write", "ingest"})

#: The deepest a spawned agent's parents are walked.
_MAX_DEPTH = 16

#: Inside one step: target agent id → whether the caller's policies allow ``work.delegate`` on it.
delegate_allowed: contextvars.ContextVar[dict[str, bool] | None] = contextvars.ContextVar(
    "delegate_allowed", default=None
)


# ── the pure part ────────────────────────────────────────────────────────────


@dataclass(frozen=True, slots=True)
class Holder:
    """A principal and every saved policy it holds."""

    #: ``person`` · ``agent`` · ``token``.
    kind: str
    id: str | None
    name: str
    held: tuple[Held, ...] = ()

    @property
    def names(self) -> list[str]:
        return [h.policy.name for h in self.held]


@dataclass(frozen=True, slots=True)
class LayerVerdict:
    """What one layer says about one action on one resource."""

    #: ``policies`` · ``token`` · ``started_by`` · ``world`` · ``boundary``.
    layer: str
    #: ``allows`` · ``refuses`` · ``n/a``.
    says: str
    #: ``(kind, id, name)`` of who the layer read — the principal, the person, each boundary.
    by: tuple[tuple[str, str | None, str], ...] = ()
    #: The policies the layer checked.
    policies: tuple[str, ...] = ()
    #: The policy whose statement allowed, when one did.
    allowed_by: str | None = None
    #: Why it refused, as the step's failure says it; empty when it allows.
    reason: str = ""


@dataclass(frozen=True, slots=True)
class Decision:
    """Every layer's verdict, and the first that refuses."""

    action: str
    resource: str
    layers: tuple[LayerVerdict, ...]

    @property
    def refused(self) -> LayerVerdict | None:
        return next((v for v in self.layers if v.says == "refuses"), None)

    @property
    def allowed(self) -> bool:
        return self.refused is None

    @property
    def message(self) -> str:
        first = self.refused
        return first.reason if first is not None else f"Allowed: {self.action} on {self.resource}."

    def layer(self, name: str) -> LayerVerdict | None:
        return next((v for v in self.layers if v.layer == name), None)

    def waive(self, name: str) -> Decision:
        """The same decision with one layer read as not applying."""
        return replace(
            self, layers=tuple(replace(v, says="n/a", reason="") if v.layer == name else v for v in self.layers)
        )


def and_list(names: Sequence[str]) -> str:
    """``viewer`` · ``viewer and contributor`` · ``a, b and c``."""
    names = list(names)
    if len(names) <= 1:
        return "".join(names)
    return f"{', '.join(names[:-1])} and {names[-1]}"


def _first_allowing(
    held: Iterable[Held], *, action: str, resource: str, bound: str | None, depth: int | None, now: datetime
) -> str | None:
    for h in held:
        if allows(h.statements, action=action, resource=resource, bound=bound, depth=depth, now=now) is not None:
            return h.policy.name
    return None


def _holder_layer(
    layer: str, holder: Holder, *, action: str, resource: str, bound: str | None, depth: int | None, now: datetime
) -> LayerVerdict:
    by = ((holder.kind, holder.id, holder.name),)
    names = tuple(holder.names)
    hit = _first_allowing(holder.held, action=action, resource=resource, bound=bound, depth=depth, now=now)
    if hit is not None:
        return LayerVerdict(layer=layer, says="allows", by=by, policies=names, allowed_by=hit)
    if layer == "token":
        reason = f"The token {holder.name} is narrowed to statements that do not allow {action} on {resource}."
    elif not names:
        reason = f"{holder.name} holds no policy, so nothing allows {action} on {resource}."
    else:
        verb = "does" if len(names) == 1 else "do"
        reason = f"{and_list(names)} {verb} not allow {action} on {resource}."
    return LayerVerdict(layer=layer, says="refuses", by=by, policies=names, reason=reason)


def _starter_layer(
    starter: Holder,
    *,
    run_number: int | None,
    action: str,
    resource: str,
    bound: str | None,
    depth: int | None,
    now: datetime,
) -> LayerVerdict:
    by = (("person", starter.id, starter.name),)
    names = tuple(starter.names)
    hit = _first_allowing(starter.held, action=action, resource=resource, bound=bound, depth=depth, now=now)
    if hit is not None:
        return LayerVerdict(layer="started_by", says="allows", by=by, policies=names, allowed_by=hit)
    who = f"{starter.name}, who started run #{run_number}," if run_number is not None else starter.name
    if not names:
        reason = f"{who} holds no role in this Graph, so nothing allows {action} on {resource}."
    else:
        verb = "does" if len(names) == 1 else "do"
        reason = f"{who} holds {and_list(names)}, which {verb} not allow {action} on {resource}."
    return LayerVerdict(layer="started_by", says="refuses", by=by, policies=names, reason=reason)


def _boundary_layer(
    boundaries: Sequence[Held], *, action: str, resource: str, bound: str | None, depth: int | None, now: datetime
) -> LayerVerdict:
    by = tuple(("policy", b.policy.id, b.policy.name) for b in boundaries)
    names = tuple(b.policy.name for b in boundaries)
    for b in boundaries:
        if allows(b.statements, action=action, resource=resource, bound=bound, depth=depth, now=now) is None:
            reason = f"boundary {b.policy.name} does not allow {action} on {resource}."
            return LayerVerdict(layer="boundary", says="refuses", by=by, policies=names, reason=reason)
    return LayerVerdict(layer="boundary", says="allows", by=by, policies=names)


def decide(
    *,
    action: str,
    resource: str,
    bound: str | None = None,
    depth: int | None = 0,
    agent: Holder | None = None,
    starter: Holder | None = None,
    run_number: int | None = None,
    token: Holder | None = None,
    boundaries: Sequence[Held] = (),
    world: LayerVerdict | None = None,
    now: datetime | None = None,
) -> Decision:
    """Every policy layer's verdict on ``action`` against ``resource``.

    ``agent`` is the principal whose own policies are the *its policies* layer
    (an agent, or a person in Test access); ``token`` adds the token's narrowing
    as its own layer; ``starter`` is the person who started the run, absent
    when nobody did; ``world`` is a verdict the caller read off a lens, when it
    asked for one. Boundaries all apply; with none, the layer allows.
    """
    moment = now or datetime.now(UTC)
    kw: dict[str, Any] = {"action": action, "resource": resource, "bound": bound, "depth": depth, "now": moment}
    layers: list[LayerVerdict] = []
    if agent is not None:
        layers.append(_holder_layer("policies", agent, **kw))
    if token is not None:
        layers.append(_holder_layer("token", token, **kw))
    if starter is not None:
        layers.append(_starter_layer(starter, run_number=run_number, **kw))
    if world is not None:
        layers.append(world)
    layers.append(_boundary_layer(boundaries, **kw))
    return Decision(action=action, resource=resource, layers=tuple(layers))


def _types_in(args: dict) -> list[str]:
    out: list[str] = []
    for key in ("label", "type", "types"):
        value = args.get(key)
        values = value if isinstance(value, list | tuple) else [value]
        out.extend(str(v).strip() for v in values if isinstance(v, str) and v.strip())
    return list(dict.fromkeys(out))


def resources_for(
    task_key: str, bound: str | None, args: dict | None, *, model: str | None = None, target: str | None = None
) -> list[str]:
    """The resources one call of ``task_key`` reaches, as policies name them.

    A resource not known before the step runs is its bare layer (``graph``,
    ``third_party``), which a statement covers when any of its resources is in
    that layer. ``model`` is ``<provider>/<model>`` of the run's endpoint;
    ``target`` the name of the agent a spawn or a delegation reaches.
    """
    args = args or {}
    head = task_key.split(".", 1)[0]
    if task_key in ("work.spawn_agent", "work.delegate"):
        return [f"agent/{target}" if target else "agent"]
    if task_key == "work.create_task":
        return ["project/*"]
    if head == "web":
        host = urlparse(str(args.get("url") or "")).hostname
        return [f"third_party/web/{host}" if host else "third_party"]
    if head == "mcp":
        parts = task_key.split(".")
        return [f"third_party/mcp/{parts[1]}/{'.'.join(parts[2:])}" if len(parts) > 2 else "third_party"]
    if head == "mail":
        return ["third_party/mail/*"]
    if head == "science":
        parts = task_key.split(".")
        return [f"third_party/science/{parts[1]}" if len(parts) > 1 else "third_party"]
    if bound == "llm":
        return [f"llm/{model}" if model else "llm"]
    if bound in GRAPH_BOUNDS or head in ("graph", "model", "data"):
        types = _types_in(args)
        return [f"graph/{t}/*" for t in types] or ["graph"]
    if bound == "network":
        return ["third_party"]
    if head == "work":
        return ["agent"]
    return ["graph"]


def layer_resource(task_key: str, bound: str | None) -> str:
    """The bare layer a function reaches — what *functions allowed* is counted at."""
    return layer_of(resources_for(task_key, bound, None)[0])


def default_resource(task_key: str, bound: str | None) -> str:
    """The widest resource a function reaches, as a matrix row reads it before a statement narrows it."""
    resource = resources_for(task_key, bound, None)[0]
    return resource if "/" in resource else f"{resource}/*"


def bound_functions() -> list[tuple[str, str]]:
    """Every catalogue function that touches something, as ``(key, bound)``, by key."""
    return sorted((key, entry.bound.value) for key, entry in CATALOGUE.items() if entry.bound.value != "none")


def model_of(provider: Any) -> str | None:
    """``<provider kind>/<model>`` of an endpoint, or ``None`` with none."""
    if provider is None:
        return None
    kind = getattr(provider, "provider", None)
    kind = getattr(kind, "value", kind)
    model = getattr(provider, "model_id", None)
    return f"{kind}/{model}" if kind and model else None


def holding_agent_ids(graph: GraphHolders, policy: Policy) -> list[str]:
    """The agents holding ``policy`` — attached directly or through a group; every agent for a boundary."""
    if policy.kind == PolicyKind.boundary.value:
        return list(graph.agents)
    rows = graph.by_policy.get(policy.id, [])
    direct = [a.holder_id for a in rows if a.holder_kind == "agent"]
    groups = {a.holder_id for a in rows if a.holder_kind == "group"}
    via = [m.member_id for m in graph.group_members if m.group_id in groups and m.member_kind == "agent"]
    return list(dict.fromkeys([*direct, *via]))


def holding_person_ids(graph: GraphHolders, policy: Policy) -> list[str]:
    """The people holding ``policy`` — attached, through a group, or as a Graph role."""
    rows = graph.by_policy.get(policy.id, [])
    direct = [a.holder_id for a in rows if a.holder_kind == "person"]
    groups = {a.holder_id for a in rows if a.holder_kind == "group"}
    via = [m.member_id for m in graph.group_members if m.group_id in groups and m.member_kind == "person"]
    roles = [m.user_id for m in graph.role_holders(policy)]
    return list(dict.fromkeys([*direct, *via, *roles]))


def refusal(decision: Decision) -> TaskFailure:
    """The step failure a refused decision raises."""
    first = decision.refused
    assert first is not None
    return TaskFailure(
        cls="bound",
        cause="policy_refused",
        message=first.reason,
        short="refused by policy",
        evidence={
            "refused_by": "grant",
            "layer": first.layer,
            "policies": list(first.policies),
            "action": decision.action,
            "resource": decision.resource,
        },
    )


# ── what a run holds ─────────────────────────────────────────────────────────


@dataclass(frozen=True, slots=True)
class RunAccess:
    """What one run holds: its agent's policies, its starter's, and the boundaries."""

    agent: Holder | None
    starter: Holder | None
    run_number: int | None
    depth: int
    boundaries: tuple[Held, ...]


async def lead_of(db: AsyncSession, agent: Agent) -> tuple[Agent, int]:
    """The agent whose policies ``agent`` holds, and how many spawn levels below it ``agent`` is.

    A spawned agent holds its parent's access, so the walk climbs
    ``parent_agent_id`` to the first agent that was not spawned. Any other
    agent — a delegated one included — holds its own, at depth 0.
    """
    node, depth = agent, 0
    while node.kind == AgentKind.spawned.value and node.parent_agent_id and depth < _MAX_DEPTH:
        parent = await db.get(Agent, node.parent_agent_id)
        if parent is None:
            break
        node, depth = parent, depth + 1
    return node, depth


class AccessGate:
    """Gathers what a run holds and refuses a step its policy layers do not allow."""

    holdings = HoldingsManager()
    qs = AccessQuerySet()

    async def run_access(self, db: AsyncSession, *, run: TaskRun, agent: Agent | None) -> RunAccess:
        """The holders a step of ``run`` is checked against.

        The starter is the person at the root run — who it is on behalf of,
        else the person who opened it. A run no person started has none.
        """
        root = await ledger_acts.root_of(db, run)
        holder, depth = None, 0
        if agent is not None:
            lead, depth = await lead_of(db, agent)
            held = await self.holdings.policies_for(
                db, graph_id=run.graph_id, principal=("agent", lead.id), run_id=root.id
            )
            holder = Holder(kind="agent", id=agent.id, name=agent.name, held=tuple(held))
        starter = None
        person = run.on_behalf_of_user_id or root.on_behalf_of_user_id
        if not person and root.author_kind == "user":
            person = root.author_id
        if person:
            user = await self.qs.user(db, ref=person)
            held = await self.holdings.policies_for(db, graph_id=run.graph_id, principal=("person", person))
            starter = Holder(kind="person", id=person, name=user.username if user else person, held=tuple(held))
        boundaries = tuple(await self.holdings.boundaries(db, graph_id=run.graph_id))
        return RunAccess(agent=holder, starter=starter, run_number=root.number, depth=depth, boundaries=boundaries)

    async def check(self, db: AsyncSession, *, run: TaskRun, step_key: str, args: dict | None, vars: RunVars) -> None:
        """Raise the step's :class:`TaskFailure` when a policy layer refuses it.

        A function with no bound touches nothing and needs no statement; a
        step outside the catalogue is not a function and is left alone.
        """
        entry = CATALOGUE.get(step_key)
        if entry is None or entry.bound.value == "none":
            return
        bound = entry.bound.value
        target = await self._target(db, step_key=step_key, args=args or {}, vars=vars)
        target_name = target.name if isinstance(target, Agent) else target
        access = await self.run_access(db, run=run, agent=vars.agent)
        for resource in resources_for(step_key, bound, args, model=model_of(vars.provider), target=target_name):
            decision = decide(
                action=step_key,
                resource=resource,
                bound=bound,
                depth=access.depth,
                agent=access.agent,
                starter=access.starter,
                run_number=access.run_number,
                boundaries=access.boundaries,
            )
            if step_key == "work.delegate" and isinstance(target, Agent):
                ours = decision.layer("policies")
                allowed = ours is None or ours.says == "allows"
                delegate_allowed.set({**(delegate_allowed.get() or {}), target.id: allowed})
                # Its own policies not allowing it is an ask to the target's owner, not a refusal.
                decision = decision.waive("policies")
            if not decision.allowed:
                raise refusal(decision)

    async def _target(self, db: AsyncSession, *, step_key: str, args: dict, vars: RunVars) -> Agent | str | None:
        """The agent a delegation hands work to, or the name a spawn asks for."""
        if step_key == "work.spawn_agent":
            return str(args.get("name") or "").strip() or None
        if step_key != "work.delegate":
            return None
        agent_id = str(args.get("agent_id") or "") or (vars.spawned[-1] if vars.spawned else "")
        return await db.get(Agent, agent_id) if agent_id else None

    # ── limits ───────────────────────────────────────────────────────────────

    async def limits(self, db: AsyncSession, *, agent: Agent | None, run: TaskRun | None) -> dict[str, tuple[int, str]]:
        """The tightest policy ceiling per budget key — ``{max_live: (2, "fare-team")}``.

        Read across the lead agent's policies and every boundary; a key no
        policy limits is absent.
        """
        if agent is None:
            return {}
        held = await self._held_with_boundaries(db, agent=agent, run=run)
        out: dict[str, tuple[int, str]] = {}
        for h in held:
            for limit, key in LIMIT_KEYS.items():
                value = (h.policy.limits or {}).get(limit)
                if value is None:
                    continue
                if key not in out or int(value) < out[key][0]:
                    out[key] = (int(value), h.policy.name)
        return out

    async def month_refusal(self, db: AsyncSession, *, run: TaskRun, agent: Agent | None) -> TaskFailure | None:
        """The failure that keeps a new run from starting once a held policy's tokens a month are spent.

        Tokens a month are counted across every agent holding the policy, from
        the settled run rows of this calendar month.
        """
        if agent is None:
            return None
        held = [h for h in await self._held_with_boundaries(db, agent=agent, run=run) if h.policy.limits]
        capped = [h for h in held if (h.policy.limits or {}).get("tokens_month") is not None]
        if not capped:
            return None
        graph = await AttachmentManager().graph_holders(db, graph_id=run.graph_id)
        now = datetime.now(UTC)
        month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        for h in capped:
            ceiling = int(h.policy.limits["tokens_month"])
            used = await self.qs.tokens_since(db, agent_ids=holding_agent_ids(graph, h.policy), since=month)
            if used >= ceiling:
                return TaskFailure(
                    cls="bound",
                    cause="budget_declined",
                    message=(
                        f"Policy {h.policy.name} allows {ledger_acts.tokens_line(ceiling)} tokens a month, and its "
                        f"holders have spent {ledger_acts.tokens_line(used)}, so this run did not start."
                    ),
                    short="tokens a month spent",
                    evidence={"refused_by": "ceiling", "policy": h.policy.name, "ceiling": ceiling, "spent": used},
                )
        return None

    async def _held_with_boundaries(self, db: AsyncSession, *, agent: Agent, run: TaskRun | None) -> list[Held]:
        lead, _ = await lead_of(db, agent)
        root_id = (await ledger_acts.root_of(db, run)).id if run is not None else None
        held = await self.holdings.policies_for(
            db, graph_id=agent.graph_id, principal=("agent", lead.id), run_id=root_id
        )
        return [*held, *await self.holdings.boundaries(db, graph_id=agent.graph_id)]
