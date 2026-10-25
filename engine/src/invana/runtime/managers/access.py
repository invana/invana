"""IAM's reads that compose the runtime — effective access, Test access, impact and limits.

docs/for-developers/modules/identity-and-access/features/effective-access.md ·
features/policies.md · features/the-iam-product.md. Band 3 because they read
what only the runtime may read together: holdings (``apps/iam``), agents and
their skills' plans, the catalogue's bounds, the ledger and ``task_runs``.

Every verdict comes from :func:`invana.runtime.access.decide` — the function the
dispatch check runs — so the matrix, Test access and a policy's impact always
agree with what a run would be allowed. Every number is computed here or in
:mod:`invana.runtime.querysets.access`; Studio prints them::

    reads = AccessReadManager()
    page = await reads.agents(session, graph=graph, params=params)
    matrix = await reads.effective(session, graph=graph, agent_id=a, started_by="priya")
    verdict = await reads.test(session, graph=graph, request=AccessCheckRequest(...))
    impact = await reads.impact(session, graph=graph, name="fare-team", request=ImpactRequest(...))
    limits = await reads.limit_usage(session, graph=graph, name="fare-team")

**Skill needs** are the functions the agent's bound skills' current plans name,
and the packaged plans its envelope lets a Plan step pick — both put steps in a
plan. **The world column** reads a world (a lens of kind ``world``) at the
row's layer: a layer it closes without allowing anything in it, or denies
whole, refuses; a layer the lens does not govern (agents, projects, datasets)
is ``n/a``. Participant-level rules stay the run's to enforce.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.envelope import Envelope
from invana.apps.agents.models import Agent
from invana.apps.flows.models import TaskForm
from invana.apps.flows.querysets import FlowQuerySet
from invana.apps.govern.models import Lens
from invana.apps.graphs.models import Graph
from invana.apps.iam.managed import MANAGED_BY_NAME
from invana.apps.iam.managers import Held, HoldingsManager
from invana.apps.iam.managers.attachments import AttachmentManager, plural
from invana.apps.iam.models import Policy, PolicyKind
from invana.apps.iam.schemas import (
    AGENT_ACCESS_LIST,
    AccessCheckLayer,
    AccessCheckRead,
    AccessCheckRequest,
    AgentAccessPage,
    AgentAccessRow,
    Delegate,
    EffectiveRead,
    EffectiveRow,
    HeldPolicy,
    ImpactBreak,
    ImpactRead,
    ImpactRequest,
    ImpactRow,
    LayerRead,
    LimitRow,
    LimitsRead,
    OverviewRead,
    PrincipalRef,
)
from invana.core.errors import NotFoundError, ValidationError
from invana.core.ledger.schemas import LedgerRowRead
from invana.core.lists import ListParams, ListSpec, Page, applied_filters
from invana.core.policy import LAYERS, StatementError, allows, layer_of, parse_statements, summary
from invana.plugins import load_plugins
from invana.runtime import ledger_acts
from invana.runtime.access import (
    Decision,
    Holder,
    LayerVerdict,
    and_list,
    bound_functions,
    decide,
    default_resource,
    holding_agent_ids,
    holding_person_ids,
    layer_resource,
    lead_of,
)
from invana.runtime.catalogue import CATALOGUE
from invana.runtime.delegation import ALWAYS, ASK, NEVER, descendants_spawned
from invana.runtime.models import TaskRun
from invana.runtime.querysets.access import AccessQuerySet

#: An agent's refused ledger rows, newest first.
REFUSAL_LIST = ListSpec(filters={}, sorts=("-at",), search_title="act or rule")

#: A policy layer → the lens layer a world governs it under.
_LENS_LAYER = {
    "graph": "graph_data",
    "llm": "llm",
    "third_party": "third_party",
    "cache": "cache",
    "human": "human",
}

#: Test access's layer labels.
_LABELS = {
    "policies": "Its policies",
    "token": "Token",
    "started_by": "Started by",
    "world": "World",
    "boundary": "Boundary",
}

#: The Limits tab's rows, in order: key · label · per.
_LIMIT_ROWS = (
    ("tokens_month", "Tokens", "a month"),
    ("tokens_run", "Tokens", "a run"),
    ("live_agents", "Live agents", "at once"),
    ("descendants", "Agents a run", "descendants"),
    ("depth", "Depth", "spawn levels"),
    ("worker_seconds_hour", "Worker-seconds", "an hour"),
    ("pools", "Pools", "it may use"),
)

_LAYER_ORDER = {name: i for i, (name, _, _) in enumerate(LAYERS)}
_REFUSED_WINDOW = timedelta(days=7)
_USE_WINDOW = timedelta(days=30)


def _used_line(n: int) -> str:
    if n == 0:
        return "not used in 30 days"
    return "used once in 30 days" if n == 1 else f"used {n} times in 30 days"


def _p95(values: Sequence[int]) -> int | None:
    """The nearest-rank 95th percentile of ascending ``values``."""
    if not values:
        return None
    return int(values[max(0, math.ceil(0.95 * len(values)) - 1)])


def _side_effect(act: str) -> str:
    manifest = load_plugins().task(act)
    effect = getattr(manifest, "side_effect", None) if manifest is not None else None
    return str(getattr(effect, "value", effect) or act.rsplit(".", 1)[-1])


def world_verdict(lens: Lens, layer: str) -> LayerVerdict:
    """What a world says about a policy layer — ``n/a`` for a layer it does not govern."""
    name = lens.display_name
    by = (("world", lens.id, name),)
    governed = _LENS_LAYER.get(layer)
    if governed is None:
        return LayerVerdict(layer="world", says="n/a", by=by)
    rules = list(lens.rules or [])

    def head(rule: dict) -> str:
        return str(rule.get("match") or "").split("/", 1)[0]

    whole = {governed, f"{governed}/*", f"{governed}/**"}
    denied = any(not r.get("allow") and str(r.get("match") or "") in whole for r in rules)
    closed = governed in set(lens.closed_layers or []) and not any(
        r.get("allow") and head(r) == governed for r in rules
    )
    if denied or closed:
        return LayerVerdict(layer="world", says="refuses", by=by, reason=f"the world {name} closes the {layer} layer.")
    return LayerVerdict(layer="world", says="allows", by=by)


class AccessReadManager:
    """Stateless. The session is the first argument of every method."""

    qs = AccessQuerySet()
    holdings = HoldingsManager()
    attachments = AttachmentManager()
    plans_qs = FlowQuerySet()

    # ── the IAM home ─────────────────────────────────────────────────────────

    async def overview(self, session: AsyncSession, *, graph: Graph) -> OverviewRead:
        """The IAM home's counts: people, service accounts, groups, agents, saved policies and tokens."""
        people, service = await self.qs.member_counts(session, graph_id=graph.id)
        now = datetime.now(UTC)
        live, expiring = await self.qs.token_counts(
            session, graph_id=graph.id, now=now, week_end=now + timedelta(days=7)
        )
        policies = {kind.value: 0 for kind in PolicyKind}
        policies.update(await self.qs.saved_policy_counts(session, graph_id=graph.id))
        return OverviewRead(
            people=people,
            service_accounts=service,
            groups=await self.qs.group_count(session, graph_id=graph.id),
            agents=await self.qs.agent_count(session, graph_id=graph.id),
            policies=policies,
            tokens_live=live,
            tokens_expiring_week=expiring,
        )

    # ── IAM, Agents ──────────────────────────────────────────────────────────

    async def agents(self, session: AsyncSession, *, graph: Graph, params: ListParams) -> AgentAccessPage:
        """Every agent that is not spawned, with its policies, functions allowed and refusals in 7 days."""
        rows, info, kinds = await self.qs.agent_page(session, graph_id=graph.id, params=params)
        boundaries = await self.holdings.boundaries(session, graph_id=graph.id)
        refused = await self.qs.refused_since(
            session, graph_id=graph.id, agent_ids=[a.id for a in rows], since=datetime.now(UTC) - _REFUSED_WINDOW
        )
        owners = await self.qs.usernames(session, ids=[self._owner_id(a) or "" for a in rows])
        items: list[AgentAccessRow] = []
        for agent in rows:
            held = await self.holdings.policies_for(session, graph_id=graph.id, principal=("agent", agent.id))
            holder = Holder(kind="agent", id=agent.id, name=agent.name, held=tuple(held))
            allowed = self._functions_allowed(holder, held, boundaries)
            acts = refused.get(agent.id, [])
            count = sum(n for _, n in acts)
            items.append(
                AgentAccessRow(
                    agent_id=agent.id,
                    name=agent.name,
                    kind=agent.kind,
                    version=agent.version,
                    policies=holder.names,
                    functions_allowed=allowed,
                    refused_7d=count,
                    refused_line=f"{count} · {_side_effect(acts[0][0])}" if acts else "0",
                    owner=owners.get(self._owner_id(agent) or ""),
                )
            )
        page = AgentAccessPage.of(items, info, applied_filters(params, AGENT_ACCESS_LIST))
        page.kinds = kinds
        return page

    # ── an agent's effective access ──────────────────────────────────────────

    async def effective(
        self,
        session: AsyncSession,
        *,
        graph: Graph,
        agent_id: str,
        started_by: str | None = None,
        run_id: str | None = None,
        world_id: str | None = None,
    ) -> EffectiveRead:
        """The agent's matrix: every function its skills need or its policies allow, each layer's say.

        ``started_by`` (a user id or username) or ``run_id`` (whose starter is
        read, and whose run-long attachments count) fill the *started by*
        column; ``world_id`` fills the world column. Without them those columns
        read ``n/a``.
        """
        agent = await self._agent_or_404(session, graph_id=graph.id, agent_id=agent_id)
        run = await self._run_or_404(session, graph_id=graph.id, run_id=run_id) if run_id else None
        lead, depth = await lead_of(session, agent)
        held = await self.holdings.policies_for(
            session, graph_id=graph.id, principal=("agent", lead.id), run_id=run.id if run else None
        )
        holder = Holder(kind="agent", id=agent.id, name=agent.name, held=tuple(held))
        starter, run_number = await self._starter(session, graph_id=graph.id, ref=started_by, run=run)
        lens = await self._world_or_404(session, graph_id=graph.id, world_id=world_id) if world_id else None
        boundaries = await self.holdings.boundaries(session, graph_id=graph.id)
        needs = await self._needs(session, agent=lead)
        envelope = Envelope.from_spec(agent.workflow_spec, effort=agent.effective_effort)

        rows: list[EffectiveRow] = []
        for key, bound in bound_functions():
            needed = key in needs
            resource = self._narrowest(held, key=key, bound=bound)
            decision = decide(
                action=key,
                resource=resource,
                bound=bound,
                depth=depth,
                agent=holder,
                starter=starter,
                run_number=run_number,
                boundaries=boundaries,
                world=world_verdict(lens, layer_of(resource)) if lens is not None else None,
            )
            ours = decision.layer("policies")
            if not needed and (ours is None or ours.says != "allows"):
                continue
            outside = bool(envelope.allow) and key not in envelope.allow
            rows.append(self._row(key, bound, resource, decision, needed=needed, outside=outside))
        rows.sort(key=lambda r: (_LAYER_ORDER.get(r.layer, len(_LAYER_ORDER)), r.action))
        present = {r.layer for r in rows}
        return EffectiveRead(
            agent_id=agent.id,
            agent=agent.name,
            kind=agent.kind,
            owner=(await self.qs.usernames(session, ids=[self._owner_id(agent) or ""])).get(
                self._owner_id(agent) or ""
            ),
            started_by=PrincipalRef(kind="person", id=starter.id, name=starter.name) if starter else None,
            world=PrincipalRef(kind="world", id=lens.id, name=lens.display_name) if lens else None,
            policies=await self._held_policies(session, held),
            layers=[LayerRead(layer=n, label=label, line=line) for n, label, line in LAYERS if n in present],
            rows=rows,
            delegates=await self._delegates(session, agent=agent, held=held, depth=depth),
            functions_allowed=self._functions_allowed(holder, held, boundaries),
            refused=sum(1 for r in rows if r.effective == "refused"),
        )

    async def refusals(
        self, session: AsyncSession, *, graph: Graph, agent_id: str, params: ListParams
    ) -> Page[LedgerRowRead]:
        """One page of the agent's refused ledger rows, newest first."""
        agent = await self._agent_or_404(session, graph_id=graph.id, agent_id=agent_id)
        rows, info = await self.qs.refusal_page(session, graph_id=graph.id, agent_id=agent.id, params=params)
        return Page[LedgerRowRead].of(
            [LedgerRowRead.model_validate(r) for r in rows], info, applied_filters(params, REFUSAL_LIST)
        )

    # ── Test access ──────────────────────────────────────────────────────────

    async def test(self, session: AsyncSession, *, graph: Graph, request: AccessCheckRequest) -> AccessCheckRead:
        """The dispatch check's own verdict on one action and resource, run without running anything."""
        entry = CATALOGUE.get(request.action)
        bound = entry.bound.value if entry is not None else None
        run = await self._run_or_404(session, graph_id=graph.id, run_id=request.run_id) if request.run_id else None
        principal, token, depth = await self._principal(session, graph_id=graph.id, request=request, run=run)
        starter, run_number = await self._starter(session, graph_id=graph.id, ref=request.started_by, run=run)
        lens = (
            await self._world_or_404(session, graph_id=graph.id, world_id=request.world_id)
            if request.world_id
            else None
        )
        decision = decide(
            action=request.action,
            resource=request.resource,
            bound=bound,
            depth=depth,
            agent=principal,
            token=token,
            starter=starter,
            run_number=run_number,
            boundaries=await self.holdings.boundaries(session, graph_id=graph.id),
            world=world_verdict(lens, layer_of(request.resource)) if lens is not None else None,
        )
        first = decision.refused
        return AccessCheckRead(
            allowed=decision.allowed,
            decided_by=first.layer if first else None,
            message=decision.message,
            layers=[
                AccessCheckLayer(
                    layer=v.layer,
                    label=_LABELS[v.layer],
                    by=[PrincipalRef(kind=k, id=i, name=n) for k, i, n in v.by],
                    says=v.says,
                    reason=v.reason or (f"{v.allowed_by} allows it" if v.allowed_by else ""),
                )
                for v in decision.layers
            ],
        )

    # ── a policy's impact and its limits ─────────────────────────────────────

    async def impact(self, session: AsyncSession, *, graph: Graph, name: str, request: ImpactRequest) -> ImpactRead:
        """Who gains and who loses what if ``name`` held ``request``'s statements, and which skills would break.

        Each holder — agents and people holding it directly, through a group
        or as a Graph role; everyone for a boundary — is read with every policy
        it holds, the candidate in place of the saved statements. A loss carries
        its ledger count over 30 days.
        """
        policy = await self.policy_or_404(session, graph_id=graph.id, name=name)
        try:
            candidate = tuple(parse_statements([s.model_dump() for s in request.statements]))
        except StatementError as exc:
            raise ValidationError(str(exc)) from None
        current = tuple(parse_statements(policy.statements))
        replaced = Held(policy=policy, how="candidate", statements=candidate)
        is_boundary = policy.kind == PolicyKind.boundary.value

        holders_ctx = await self.attachments.graph_holders(session, graph_id=graph.id)
        agent_ids = holding_agent_ids(holders_ctx, policy)
        person_ids = (
            [m.user_id for m in holders_ctx.members] if is_boundary else holding_person_ids(holders_ctx, policy)
        )
        agents = await self.qs.agents_by_ids(session, ids=agent_ids)
        usernames = await self.qs.usernames(session, ids=person_ids)
        boundaries = await self.holdings.boundaries(session, graph_id=graph.id)
        after_boundaries = [*(b for b in boundaries if b.policy.id != policy.id), *([replaced] if is_boundary else [])]

        pairs = self._pairs([*current, *candidate])
        now = datetime.now(UTC)
        rows: list[ImpactRow] = []
        breaks: list[ImpactBreak] = []
        holders: list[tuple[str, str, str]] = [
            *(("agent", a, agents[a].name) for a in agent_ids if a in agents),
            *(("person", p, usernames.get(p, p)) for p in person_ids),
        ]
        for kind, ident, label in holders:
            held = await self.holdings.policies_for(session, graph_id=graph.id, principal=(kind, ident))
            after_held = held if is_boundary else [*(h for h in held if h.policy.id != policy.id), replaced]
            before = Holder(kind=kind, id=ident, name=label, held=tuple(held))
            after = Holder(kind=kind, id=ident, name=label, held=tuple(after_held))

            def can(who: Holder, bounds: Sequence[Held], key: str, bound: str, resource: str) -> bool:
                return decide(action=key, resource=resource, bound=bound, agent=who, boundaries=bounds).allowed

            gains = [
                (k, r)
                for k, b, r in pairs
                if not can(before, boundaries, k, b, r) and can(after, after_boundaries, k, b, r)
            ]
            losses = [
                (k, r)
                for k, b, r in pairs
                if can(before, boundaries, k, b, r) and not can(after, after_boundaries, k, b, r)
            ]
            uses = await self.qs.uses_since(
                session,
                graph_id=graph.id,
                actor_kind=kind,
                actor_id=ident,
                acts=[k for k, _ in losses],
                since=now - _USE_WINDOW,
            )
            for key, resource in gains:
                rows.append(
                    ImpactRow(
                        holder_kind=kind, holder_id=ident, name=label, change="gains", what=f"{key} on {resource}"
                    )
                )
            for key, resource in losses:
                used = uses.get(key, 0)
                rows.append(
                    ImpactRow(
                        holder_kind=kind,
                        holder_id=ident,
                        name=label,
                        change="loses",
                        what=f"{key} on {resource}",
                        used_30d=used,
                        used_line=_used_line(used),
                    )
                )
            if not gains and not losses:
                rows.append(ImpactRow(holder_kind=kind, holder_id=ident, name=label, change="same", what="nothing new"))
            if kind == "agent":
                breaks.extend(
                    await self._breaks(
                        session, agent=agents[ident], before=(before, boundaries), after=(after, after_boundaries)
                    )
                )
        parts = [plural(len(agents), "agent")] if agents else []
        if person_ids:
            parts.append(plural(len(person_ids), "person", "people"))
        return ImpactRead(
            policy=policy.name,
            version=policy.version,
            writes_version=policy.version + 1,
            holders_line=f"Held by {and_list(parts)}" if parts else "Held by nobody",
            rows=rows,
            breaks=breaks,
        )

    async def limit_usage(self, session: AsyncSession, *, graph: Graph, name: str) -> LimitsRead:
        """Each limit's ceiling beside what the policy's holding agents use now.

        Tokens a month and a run's p95 over 30 days come from settled run rows;
        live agents and the largest live tree's helpers from running ones.
        Worker-seconds and pools show their ceiling; nothing meters them yet.
        """
        policy = await self.policy_or_404(session, graph_id=graph.id, name=name)
        limits = dict(policy.limits or {})
        holders_ctx = await self.attachments.graph_holders(session, graph_id=graph.id)
        agent_ids = holding_agent_ids(holders_ctx, policy)
        now = datetime.now(UTC)
        month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        live = await self.qs.live_runs(session, agent_ids=agent_ids)
        roots = [r for r in live if r.parent_run_id is None]
        trees = [(await descendants_spawned(session, r), r.number) for r in roots]
        tree, tree_run = max(trees, key=lambda t: t[0], default=(0, None))
        used: dict[str, int | None] = {
            "tokens_month": await self.qs.tokens_since(session, agent_ids=agent_ids, since=month),
            "tokens_run": _p95(await self.qs.run_tokens_since(session, agent_ids=agent_ids, since=now - _USE_WINDOW)),
            "live_agents": len(live),
            "descendants": tree,
        }
        rows: list[LimitRow] = []
        for key, label, per in _LIMIT_ROWS:
            ceiling = limits.get(key) if key != "pools" else (list(limits.get("pools") or []) or None)
            value = used.get(key)
            if value is None:
                line = "—"
            elif key == "tokens_run":
                line = f"p95 {ledger_acts.tokens_line(value)}"
            elif key.startswith("tokens"):
                line = ledger_acts.tokens_line(value)
            elif key == "descendants" and value and tree_run is not None:
                line = f"{value} in #{tree_run}"
            else:
                line = str(value)
            share = None
            if isinstance(ceiling, int) and ceiling > 0 and value is not None:
                share = round(min(100.0, value * 100.0 / ceiling), 1)
            rows.append(
                LimitRow(key=key, label=label, per=per, ceiling=ceiling, used=value, used_line=line, share=share)
            )
        owner = (await self.qs.usernames(session, ids=[policy.owner_id or ""])).get(policy.owner_id or "")
        return LimitsRead(rows=rows, may_ask_more=bool(limits.get("may_ask_more")), asks_go_to=owner)

    async def policy_or_404(self, session: AsyncSession, *, graph_id: str, name: str) -> Policy:
        policy = await self.qs.policy_by_name(session, graph_id=graph_id, name=name)
        if policy is None:
            raise NotFoundError(f"No policy named {name} in this Graph.")
        return policy

    # ── helpers ──────────────────────────────────────────────────────────────

    @staticmethod
    def _owner_id(agent: Agent) -> str | None:
        return agent.created_by_id if agent.created_by_kind == "user" else None

    async def _agent_or_404(self, session: AsyncSession, *, graph_id: str, agent_id: str) -> Agent:
        agent = (await self.qs.agents_by_ids(session, ids=[agent_id])).get(agent_id)
        if agent is None or agent.graph_id != graph_id:
            raise NotFoundError("Agent not found.")
        return agent

    async def _run_or_404(self, session: AsyncSession, *, graph_id: str, run_id: str) -> TaskRun:
        run = await session.get(TaskRun, run_id)
        if run is None or run.graph_id != graph_id:
            raise NotFoundError("Run not found.")
        return run

    async def _world_or_404(self, session: AsyncSession, *, graph_id: str, world_id: str) -> Lens:
        lens = await self.qs.world(session, graph_id=graph_id, world_id=world_id)
        if lens is None:
            raise NotFoundError("World not found.")
        return lens

    async def _starter(
        self, session: AsyncSession, *, graph_id: str, ref: str | None, run: TaskRun | None
    ) -> tuple[Holder | None, int | None]:
        """The person a check reads as having started the run, and the run's number."""
        root = await ledger_acts.root_of(session, run) if run is not None else None
        person = ref
        if person is None and root is not None:
            person = root.on_behalf_of_user_id or (root.author_id if root.author_kind == "user" else None)
        if not person:
            return None, root.number if root else None
        user = await self.qs.user(session, ref=person)
        if user is None:
            raise NotFoundError("No such person.")
        held = await self.holdings.policies_for(session, graph_id=graph_id, principal=("person", user.id))
        return Holder(kind="person", id=user.id, name=user.username, held=tuple(held)), root.number if root else None

    async def _principal(
        self, session: AsyncSession, *, graph_id: str, request: AccessCheckRequest, run: TaskRun | None
    ) -> tuple[Holder, Holder | None, int]:
        """The *its policies* holder of Test access, the token layer when a token asks, and the spawn depth."""
        run_id = (await ledger_acts.root_of(session, run)).id if run is not None else None
        if request.principal_kind == "agent":
            agent = await self._agent_or_404(session, graph_id=graph_id, agent_id=request.principal_id)
            lead, depth = await lead_of(session, agent)
            held = await self.holdings.policies_for(
                session, graph_id=graph_id, principal=("agent", lead.id), run_id=run_id
            )
            return Holder(kind="agent", id=agent.id, name=agent.name, held=tuple(held)), None, depth
        if request.principal_kind == "token":
            tok = await self.qs.token(session, token_id=request.principal_id)
            if tok is None or (tok.graph_id is not None and tok.graph_id != graph_id):
                raise NotFoundError("No such token.")
            user = await self.qs.user(session, ref=tok.user_id)
            held = await self.holdings.policies_for(session, graph_id=graph_id, principal=("person", tok.user_id))
            holder = Holder(
                kind="person", id=tok.user_id, name=user.username if user else tok.user_id, held=tuple(held)
            )
            inline = await self.qs.policy(session, policy_id=tok.policy_id)
            token = None
            if inline is not None:
                statements = tuple(parse_statements(inline.statements))
                token = Holder(
                    kind="token",
                    id=tok.id,
                    name=tok.name,
                    held=(Held(policy=inline, how="inline", statements=statements),),
                )
            return holder, token, 0
        user = await self.qs.user(session, ref=request.principal_id)
        if user is None:
            raise NotFoundError("No such person.")
        held = await self.holdings.policies_for(
            session, graph_id=graph_id, principal=("person", user.id), run_id=run_id
        )
        return Holder(kind="person", id=user.id, name=user.username, held=tuple(held)), None, 0

    async def _needs(self, session: AsyncSession, *, agent: Agent) -> set[str]:
        """The functions the agent's bound skills' current plans name, and its envelope's packaged plans."""
        envelope = Envelope.from_spec(agent.workflow_spec, effort=agent.effective_effort)
        plan_ids: list[str] = []
        for key in sorted(envelope.templates):
            plan = await self.plans_qs.find_by_key(session, graph_id=agent.graph_id, key=key, version=None)
            if plan is not None:
                plan_ids.append(plan.id)
        for skill in agent.bound_skills or []:
            if skill.current_version is not None:
                plan_ids.append(skill.current_version.plan_id)
        tasks = await self.plans_qs.tasks_for_plans(session, plan_ids=plan_ids)
        return {t.step_key for nodes in tasks.values() for t in nodes if t.step_key and t.form != TaskForm.human.value}

    async def _skill_needs(self, agent: Agent, session: AsyncSession) -> list[tuple[str, str, int, list[str]]]:
        """Each bound skill with a published version: ``(id, name, version, needs)``."""
        skills = [s for s in agent.bound_skills or [] if s.current_version is not None]
        tasks = await self.plans_qs.tasks_for_plans(session, plan_ids=[s.current_version.plan_id for s in skills])
        out: list[tuple[str, str, int, list[str]]] = []
        for skill in skills:
            version = skill.current_version
            nodes = tasks.get(version.plan_id, [])
            needs = list(dict.fromkeys(t.step_key for t in nodes if t.step_key and t.form != TaskForm.human.value))
            out.append((skill.id, skill.name, version.version, needs))
        return out

    @classmethod
    def _functions_allowed(cls, holder: Holder, held: Sequence[Held], boundaries: Sequence[Held]) -> int:
        """Catalogue functions with a bound its policies and the boundary allow.

        One count for the IAM Agents list and the agent's own page, whether or not a
        skill needs the function; each is checked at its matrix row's resource.
        """
        return sum(
            1
            for key, bound in bound_functions()
            if decide(
                action=key,
                resource=cls._narrowest(held, key=key, bound=bound),
                bound=bound,
                depth=0,
                agent=holder,
                boundaries=boundaries,
            ).allowed
        )

    @staticmethod
    def _narrowest(held: Sequence[Held], *, key: str, bound: str) -> str:
        """The resource a matrix row reads: the narrowest one a held statement allowing it names in its layer.

        Narrowest is the most path segments without a wildcard, then the
        longest — ``graph/Fare/*`` over ``graph/*``.
        """
        fallback = default_resource(key, bound)
        layer = layer_of(fallback)
        named: list[str] = []
        for h in held:
            for statement in h.statements:
                if allows([statement], action=key, resource=layer, bound=bound, depth=0) is None:
                    continue
                named.extend(r for r in statement.resources if r != "*" and layer_of(r) == layer)
        if not named:
            return fallback
        return max(named, key=lambda r: (sum(1 for part in r.split("/") if "*" not in part), len(r)))

    @staticmethod
    def _row(key: str, bound: str, resource: str, decision: Decision, *, needed: bool, outside: bool) -> EffectiveRow:
        def says(name: str) -> str:
            verdict = decision.layer(name)
            return verdict.says if verdict is not None else "n/a"

        if not needed:
            why = "no skill needs it"
        elif outside:
            why = "not in its envelope"
        else:
            why = decision.refused.reason if decision.refused else ""
        allowed = decision.allowed and needed and not outside
        return EffectiveRow(
            action=key,
            resource=resource,
            layer=layer_of(resource),
            bound=bound,
            needs=needed,
            policies=says("policies"),
            started_by=says("started_by"),
            world=says("world"),
            boundary=says("boundary"),
            effective="allowed" if allowed else "refused",
            why=why,
        )

    async def _held_policies(self, session: AsyncSession, held: Sequence[Held]) -> list[HeldPolicy]:
        owners = await self.qs.usernames(session, ids=[h.policy.owner_id or "" for h in held])
        out: list[HeldPolicy] = []
        for h in held:
            managed = MANAGED_BY_NAME.get(h.policy.name) if h.policy.kind == PolicyKind.managed.value else None
            out.append(
                HeldPolicy(
                    id=h.policy.id,
                    name=h.policy.name,
                    kind=h.policy.kind,
                    summary=managed.summary if managed else summary(h.statements),
                    owner=owners.get(h.policy.owner_id or ""),
                    how=h.how,
                )
            )
        return out

    async def _delegates(
        self, session: AsyncSession, *, agent: Agent, held: Sequence[Held], depth: int
    ) -> list[Delegate]:
        """Each agent its *May delegate to* names, the policy that allows it, and how it may."""
        listed = dict((agent.effective_policy.get("may_delegate") or {}).items())
        targets = await self.qs.agents_by_ids(session, ids=list(listed))
        out: list[Delegate] = []
        for target_id, mode in listed.items():
            target = targets.get(target_id)
            if target is None or target.graph_id != agent.graph_id:
                continue
            verdict = decide(
                action="work.delegate",
                resource=f"agent/{target.name}",
                bound="work_write",
                depth=depth,
                agent=Holder(kind="agent", id=agent.id, name=agent.name, held=tuple(held)),
            ).layer("policies")
            by = verdict.allowed_by if verdict is not None else None
            may = mode if mode in (ALWAYS, ASK, NEVER) else ASK
            if may == ALWAYS and by is None:
                may = ASK
            out.append(Delegate(agent_id=target.id, name=target.name, kind=target.kind, by_policy=by, may=may))
        return sorted(out, key=lambda d: d.name.lower())

    @staticmethod
    def _pairs(statements: Sequence) -> list[tuple[str, str, str]]:
        """``(function, bound, resource)`` for every catalogue function against every resource the statements name."""
        resources = list(dict.fromkeys(r for s in statements for r in s.resources))
        out: list[tuple[str, str, str]] = []
        for key, bound in bound_functions():
            layer = layer_resource(key, bound)
            for resource in resources:
                if resource == "*":
                    out.append((key, bound, default_resource(key, bound)))
                elif layer_of(resource) == layer:
                    out.append((key, bound, resource))
        return list(dict.fromkeys(out))

    async def _breaks(
        self,
        session: AsyncSession,
        *,
        agent: Agent,
        before: tuple[Holder, Sequence[Held]],
        after: tuple[Holder, Sequence[Held]],
    ) -> list[ImpactBreak]:
        """The agent's bound skills with a need allowed now and refused under the candidate."""
        out: list[ImpactBreak] = []
        for skill_id, name, version, needs in await self._skill_needs(agent, session):
            for key in needs:
                entry = CATALOGUE.get(key)
                if entry is None or entry.bound.value == "none":
                    continue
                bound = entry.bound.value
                resource = layer_resource(key, bound)
                was = decide(action=key, resource=resource, bound=bound, agent=before[0], boundaries=before[1]).allowed
                now = decide(action=key, resource=resource, bound=bound, agent=after[0], boundaries=after[1]).allowed
                if was and not now:
                    out.append(
                        ImpactBreak(
                            agent_id=agent.id,
                            agent=agent.name,
                            skill_id=skill_id,
                            skill=name,
                            version=version,
                            needs=key,
                            line=f"{name} v{version} needs {key}, which {agent.name} would no longer hold.",
                        )
                    )
        return out


__all__ = ["REFUSAL_LIST", "AccessReadManager", "world_verdict"]
