"""Rules for a Graph's agents — seeding, creation, status and the default.

A **seeded** agent cannot be renamed or deleted; it is retired instead. That is
what keeps a Graph's starting agents recognisable across upgrades.

Retirement, deletion and lineage read `runs` and live in
`runtime/managers/agent_lifecycle.py` — an app may not import the runtime
(migration-plan §18.1.1 S1).
"""

from __future__ import annotations

import copy
from collections.abc import Sequence

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.models import DEFAULT_EFFORT, Agent, AgentKind, AgentLifetime, AgentStatus
from invana.apps.agents.querysets import AgentQuerySet
from invana.apps.agents.registry import SEEDED_AGENTS, SURFACE_DEFAULT_AGENT, SeededAgent
from invana.apps.agents.schemas import (
    AgentCreate,
    AgentRead,
    AgentUpdate,
)
from invana.apps.govern.managers import LensManager, LLMEndpointManager
from invana.apps.govern.models import Lens, LensKind
from invana.apps.graphs.models import Graph
from invana.apps.iam.managers import HoldingsManager
from invana.apps.iam.managers.policies import PolicyManager
from invana.apps.iam.models import PolicyAttachment
from invana.apps.iam.querysets import HoldingsQuerySet
from invana.apps.iam.querysets.policies import PolicyQuerySet
from invana.apps.llm.voice import check_traits
from invana.apps.skills.managers import BindCheck, SkillBindingManager, SkillManager
from invana.apps.work.models import Task, TaskStatus
from invana.apps.work.querysets import TaskQuerySet
from invana.core.auth.models import User
from invana.core.errors import ConflictError, NotFoundError, ValidationError
from invana.core.events import actions
from invana.core.events.models import ActorKind
from invana.core.events.querysets import EventQuerySet
from invana.core.events.services import diff_changed_fields, emit_event
from invana.core.lists import ListParams
from invana.core.lists.schemas import PageInfo

"""Service layer for agents — the agents, the lifecycle, and lineage."""

# No ``skill_ids``: the bindings live in `skill_bindings`, and binding is its own write
# with its own refusal and its own event (BN6).
_UPDATABLE = [
    "name",
    "description",
    "instructions",
    "workflow_spec",
    "budget",
    "effort",
    "policy",
    "soul",
    "soul_traits",
    "model_pin",
]
#: The fields that are the agent's voice. A change to one is `agent.soul_set`
#: rather than `agent.update`, because it changes how the agent speaks and
#: nothing it may do (SO2 · AG16).
_VOICE = ("soul", "soul_traits")

#: An agent budget key → the policy limit that ceilings it, and how a refusal names it.
_POLICY_CEILINGS = {
    "max_tokens_run": ("tokens_run", "tokens a run"),
    "max_tokens_month": ("tokens_month", "tokens a month"),
    "max_descendants": ("descendants", "agents a run"),
    "max_depth": ("depth", "depth"),
    "max_live": ("live_agents", "live agents at once"),
}
#: Envelope functions that write work, and those that write the graph, its models or its data —
#: what a seeded agent is born holding ``contributor`` and ``modeller`` for.
_WORK_WRITES = ("work.",)
_GRAPH_WRITES = (
    "graph.write.",
    "graph.stitch.commit",
    "graph.stitch.declare",
    "graph.stitch.run",
    "graph.stitch.withdraw",
    "model.migrate",
    "model.understand_ask",
    "model.validate_proposal",
    "data.",
)


def managed_for_envelope(spec: dict | None) -> list[str]:
    """The managed policies an agent is born holding: ``viewer``, and what its envelope writes.

    An envelope that names nothing allows everything, so it holds all three.
    """
    allow = list((spec or {}).get("allow") or [])
    names = ["viewer"]
    if not allow or any(k.startswith(_WORK_WRITES) for k in allow):
        names.append("contributor")
    if not allow or any(k.startswith(_GRAPH_WRITES) for k in allow):
        names.append("modeller")
    return names


def check_effort(effort: dict | None) -> dict[str, int]:
    """Effort as stored, or a refusal naming what is wrong with it (EB9).

    ``0`` is a value, not an absence: ``max_clarifications: 0`` is an agent
    that never asks.
    """
    out: dict[str, int] = {}
    for key, value in (effort or {}).items():
        if key not in DEFAULT_EFFORT:
            raise ValidationError(f"'{key}' is not an effort setting. They are: {', '.join(DEFAULT_EFFORT)}.")
        if isinstance(value, bool) or not isinstance(value, int) or value < 0:
            raise ValidationError(f"'{key}' must be a whole number, 0 or more.")
        if key == "max_steps" and value < 1:
            raise ValidationError("'max_steps' must be at least 1 — a plan with no steps answers nothing.")
        out[key] = value
    return out


def agent_actor(agent: Agent) -> dict:
    """The kwargs every event an agent emits carries.

    ``actor_name`` is snapshotted into ``details`` so a *deleted* agent still
    reads by name — the audit convention (docs/for-developers/modules/operate/features/audit-and-activity.md), applied
    to the new principal kind.
    """
    return {
        "actor_kind": ActorKind.agent,
        "actor_id": agent.id,
        "details": {"actor_name": agent.name},
    }


class AgentManager:
    agents_qs = AgentQuerySet()
    events_qs = EventQuerySet()
    tasks_qs = TaskQuerySet()
    # Binding is Skills' rule, called from here rather than reimplemented: this
    # package writes no `skill_bindings` row of its own (BN6).
    skills = SkillManager()
    bindings = SkillBindingManager()
    # An agent's own narrowing is a guardrail scoped to it (AG10 · AG26), and
    # guardrails are Govern's rows.
    lenses = LensManager()
    endpoints = LLMEndpointManager()
    # What an agent holds is IAM's: a new agent is attached its managed policies
    # there, and its budget is checked against the ceilings they set.
    holdings = HoldingsManager()
    holdings_qs = HoldingsQuerySet()
    policies_qs = PolicyQuerySet()

    async def reads(self, session: AsyncSession, items: list[Agent]) -> list[AgentRead]:
        """Agents as the API answers them, each with its own guardrail named.

        One read of the Graph's agent-scoped guardrails for the whole list, not
        one per row (AG10 · AG26).
        """
        if not items:
            return []
        own: dict[str, Lens] = {}
        for lens in await self.lenses.lenses_qs.list_for_graph(
            session, items[0].graph_id, kind=LensKind.guardrail.value
        ):
            if lens.agent_scope_id and lens.agent_scope_id not in own:
                own[lens.agent_scope_id] = lens
        out: list[AgentRead] = []
        for agent in items:
            read = AgentRead.model_validate(agent)
            guardrail = own.get(agent.id)
            if guardrail is not None:
                read.guardrail_id = guardrail.id
                read.guardrail_name = guardrail.display_name
            out.append(read)
        return out

    async def read(self, session: AsyncSession, agent: Agent) -> AgentRead:
        return (await self.reads(session, [agent]))[0]

    async def seed_agents(self, session: AsyncSession, *, graph: Graph) -> list[Agent]:
        """Give a graph the agents it is born with, idempotently.

        Called at graph creation and again on the first read of the agents, so an
        graph created before agents existed grows them the moment it is looked at
        rather than needing a data migration to be re-run.
        """
        created: list[Agent] = []
        for seeded in SEEDED_AGENTS:
            existing = await self.agents_qs.get_by_key(session, graph_id=graph.id, key=seeded.key)
            if existing is not None:
                self._add_shipped(existing, seeded)
                continue
            agent = Agent(
                graph_id=graph.id,
                key=seeded.key,
                name=seeded.name,
                description=seeded.description,
                kind=AgentKind.seeded.value,
                instructions=seeded.instructions,
                workflow_spec=copy.deepcopy(seeded.workflow_spec),
                # Delegation's bounds — depth, fan-out — travel with the agent that
                # may delegate, and the interpreter reads them from here (DG2).
                budget=copy.deepcopy(seeded.budget),
                effort=copy.deepcopy(seeded.effort),
                # No model is bound here, and there is nothing to keep fresh:
                # a seeded agent carries no lens, so *Everything, inside the
                # guardrails* resolves through the shipped cast over whatever
                # the Graph offers ([PM14](docs/for-developers/modules/agents/features/providers-and-models.md)).
                created_by_kind="system",
            )
            await self.agents_qs.add(session, agent)
            if not created:
                # A Graph being created has no managed policies yet; write them before the first is held.
                await PolicyManager().ensure_managed(session, graph_id=graph.id)
            await self._hold(session, agent=agent, names=managed_for_envelope(agent.workflow_spec), actor_id=None)
            created.append(agent)
            if seeded.default and not graph.default_agent_id:
                graph.default_agent_id = agent.id
        if graph.default_agent_id is None:
            explorer = await self.agents_qs.get_by_key(session, graph_id=graph.id, key="explorer")
            if explorer is not None:
                graph.default_agent_id = explorer.id
        return created

    @staticmethod
    def _add_shipped(agent: Agent, seeded: SeededAgent) -> None:
        """Give a seeded agent the functions and packaged flows a release added.

        ``shipped`` remembers what the agent was last given, so only what is new
        since then is added: what an owner took away stays away. A Graph seeded
        before ``board.open`` shipped gains it this way.
        """
        spec = copy.deepcopy(agent.workflow_spec or {})
        given = spec.get("shipped")
        changed = False
        for key in ("allow", "templates"):
            shipped = seeded.workflow_spec.get(key)
            if not isinstance(shipped, list):
                continue
            have = list(spec.get(key) or [])
            seen = set(given.get(key) or []) if isinstance(given, dict) else set(have)
            new = [k for k in shipped if k not in seen and k not in have]
            if new:
                spec[key] = have + new
            changed = changed or bool(new) or not isinstance(given, dict)
        if changed:
            spec["shipped"] = {
                k: list(v) for k in ("allow", "templates") if isinstance(v := seeded.workflow_spec.get(k), list)
            }
            agent.workflow_spec = spec

    async def default_agent_for_surface(self, session: AsyncSession, *, graph: Graph, surface: str) -> Agent | None:
        """Which agent a new session on this surface binds (docs/for-developers/modules/agents/spec.md).

        Explorer takes the graph's default so an owner can re-point it; Modeller
        always takes the seeded modeller, because a modeller session that plans
        graph queries is not a modeller session.
        """
        key = SURFACE_DEFAULT_AGENT.get(surface, "explorer")
        if key == "explorer" and graph.default_agent_id:
            agent = await self.agents_qs.get(session, graph.default_agent_id)
            # A default that cannot answer asks is passed over, not obeyed: the
            # session would draft a model instead of answering (AG3 · WQ5).
            if agent is not None and agent.graph_id == graph.id and agent.is_available and agent.answers_asks:
                return agent
        return await self.agents_qs.get_by_key(session, graph_id=graph.id, key=key)

    async def list_agents(
        self,
        session: AsyncSession,
        *,
        graph: Graph,
        include_ephemeral: bool = False,
        include_retired: bool = False,
    ) -> list[Agent]:
        await self.seed_agents(session, graph=graph)
        return await self.agents_qs.list_for_graph(
            session, graph.id, include_ephemeral=include_ephemeral, include_retired=include_retired
        )

    async def page_agents(
        self, session: AsyncSession, *, graph: Graph, params: ListParams
    ) -> tuple[Sequence[Agent], PageInfo]:
        """One page of the Agents list — seeding the Graph's agents on first touch."""
        await self.seed_agents(session, graph=graph)
        return await self.agents_qs.page_for_graph(session, graph.id, params=params)

    async def count_by_lifetime(self, session: AsyncSession, *, graph_id: str) -> tuple[int, int]:
        """How many of the Graph's agents that are not retired are persistent, and how many ephemeral.

        An ephemeral agent is a helper spawned for one task; the Agents list
        hides it by default and says how many it hid. Counted over the Graph,
        not over a filtered page. Returns ``(persistent, ephemeral)``.
        """
        counts = await self.agents_qs.count_by_lifetime(session, graph_id)
        return counts.get(AgentLifetime.persistent.value, 0), counts.get(AgentLifetime.ephemeral.value, 0)

    async def get_or_404(self, session: AsyncSession, *, agent_id: str, graph_id: str) -> Agent:
        agent = await self.agents_qs.get(session, agent_id)
        if agent is None or agent.graph_id != graph_id:
            raise NotFoundError("Agent not found.")
        return agent

    async def require_available(self, session: AsyncSession, *, agent_id: str, graph_id: str) -> Agent:
        """The guard every path that opens a run runs first.

        A paused or retired agent is not an error in the abstract — it is a state
        the user can fix — so the 409 says which one it is and the composer offers
        the picker (docs/for-developers/modules/agents/spec.md, docs/for-developers/modules/work/spec.md J1's *blocked*
        seam).
        """
        agent = await self.get_or_404(session, agent_id=agent_id, graph_id=graph_id)
        if not agent.is_available:
            fix = "create it" if agent.status == AgentStatus.draft.value else "resume this one"
            raise ConflictError(f"'{agent.name}' is {agent.status}. Pick another agent, or {fix}.")
        return agent

    async def create_agent(
        self,
        session: AsyncSession,
        *,
        graph: Graph,
        payload: AgentCreate,
        actor: User,
        bind_check: BindCheck | None = None,
    ) -> Agent:
        spec = payload.workflow_spec
        if spec is None and payload.envelope_from:
            seeded = next((s for s in SEEDED_AGENTS if s.key == payload.envelope_from), None)
            if seeded is None:
                raise ValidationError(f"No seeded agent named '{payload.envelope_from}' to copy an envelope from.")
            spec = copy.deepcopy(seeded.workflow_spec)
            # The template brings its effort with its envelope (AG1); a number
            # the author typed still wins, key by key.
            payload.effort = {**seeded.effort, **payload.effort}

        pin = payload.model_pin or None
        if pin is not None:
            pin = await self.endpoints.check_pin(session, graph_id=graph.id, address=pin)

        agent = Agent(
            graph_id=graph.id,
            name=payload.name,
            description=payload.description,
            instructions=payload.instructions,
            kind=AgentKind.authored.value,
            # Built first, offered work only once *Create agent* passes its gate.
            status=AgentStatus.draft.value,
            model_pin=pin,
            workflow_spec=spec or {},
            budget=payload.budget,
            effort=check_effort(payload.effort),
            policy=payload.policy,
            soul=payload.soul,
            soul_traits=check_traits(payload.soul_traits),
            created_by_kind="user",
            created_by_id=actor.id,
        )
        try:
            await self.agents_qs.add(session, agent)
        except IntegrityError as exc:
            raise ConflictError(f"An agent named '{payload.name}' already exists in this graph.") from exc
        # A new agent holds `viewer`; anything more is attached in IAM.
        await self._hold(session, agent=agent, names=["viewer"], actor_id=actor.id)
        await self._check_ceilings(session, agent=agent, budget=payload.budget)

        # The skills this agent starts with, bound as part of creating it. Each
        # one goes through the binding manager carrying the same `bind_check`
        # the standalone bind route uses, so a skill the envelope refuses
        # refuses the create rather than slipping in through a back door (BN5).
        for skill_id in dict.fromkeys(payload.skill_ids):
            skill = await self.skills.get(session, skill_id=skill_id, graph_id=graph.id)
            await self.bindings.bind(
                session,
                skill=skill,
                agent_id=agent.id,
                agent_name=agent.name,
                actor_id=actor.id,
                check=bind_check,
            )
        await session.refresh(agent, ["bound_skills"])

        await emit_event(
            session,
            action=actions.AGENT_CREATE,
            target_kind=actions.TARGET_AGENT,
            target_id=agent.id,
            graph_id=graph.id,
            actor_id=actor.id,
            details={"name": agent.name, "kind": agent.kind},
        )
        return agent

    async def update_agent(
        self,
        session: AsyncSession,
        *,
        agent: Agent,
        payload: AgentUpdate,
        actor: User,
        restored_from: int | None = None,
        evaluated: dict | None = None,
    ) -> Agent:
        """Apply an edit, bump the version once, and record before and after.

        ``restored_from`` is set by a rollback: the agent version whose
        instructions this edit restores, carried on the ``agent.update``.
        ``evaluated`` is the eval gate's verdict the edit passed, carried beside it.
        """
        if agent.kind == AgentKind.seeded.value and payload.name is not None and payload.name != agent.name:
            # Seeded agents are addressed by key elsewhere; renaming one silently
            # breaks nothing, but it does make the trace harder to read across
            # graphes. Everything else about a seeded agent is editable.
            raise ConflictError("A seeded agent cannot be renamed.")

        # Refused before anything is set, so a bad dial never half-applies an edit.
        if payload.soul_traits is not None:
            payload.soul_traits = check_traits(payload.soul_traits)
        if payload.effort is not None:
            payload.effort = check_effort(payload.effort)
        if payload.budget is not None:
            await self._check_ceilings(session, agent=agent, budget=payload.budget)
        # A pin is cleared by sending null, so it is read by set-ness; an empty
        # string reads as null too.
        repin = "model_pin" in payload.model_fields_set
        pin = payload.model_pin or None
        if repin and pin is not None:
            pin = await self.endpoints.check_pin(session, graph_id=agent.graph_id, address=pin)

        before = {f: copy.deepcopy(getattr(agent, f)) for f in _UPDATABLE}
        for field in _UPDATABLE:
            value = getattr(payload, field)
            if field == "model_pin":
                if repin:
                    agent.model_pin = pin
            elif value is not None:
                setattr(agent, field, value)
        after = {f: getattr(agent, f) for f in _UPDATABLE}
        changed = diff_changed_fields(before, after, fields=_UPDATABLE)

        if changed:
            # The version is what a run records, so it has to move whenever
            # anything about *how this agent thinks* moves — or how it speaks:
            # `task_runs.agent_version` is how a run says which soul it spoke
            # with (SO6). One bump per edit, however many fields moved.
            agent.version += 1
            try:
                await session.flush()
            except IntegrityError as exc:
                raise ConflictError(f"An agent named '{agent.name}' already exists in this graph.") from exc
            voice = [f for f in changed if f in _VOICE]
            rest = [f for f in changed if f not in _VOICE]
            if rest:
                await emit_event(
                    session,
                    action=actions.AGENT_UPDATE,
                    target_kind=actions.TARGET_AGENT,
                    target_id=agent.id,
                    graph_id=agent.graph_id,
                    actor_id=actor.id,
                    details={
                        "name": agent.name,
                        "changed": rest,
                        "version": agent.version,
                        # Before and after — the agent keeps no version rows,
                        # so this is the only place an earlier version survives.
                        "diff": {f: changed[f] for f in rest},
                        "why": payload.why,
                        **({"restored_from": restored_from} if restored_from is not None else {}),
                        **({"eval": evaluated} if evaluated is not None else {}),
                    },
                )
            if voice:
                await emit_event(
                    session,
                    action=actions.AGENT_SOUL_SET,
                    target_kind=actions.TARGET_AGENT,
                    target_id=agent.id,
                    graph_id=agent.graph_id,
                    actor_id=actor.id,
                    # The dials ride in full beside the soul's size; ``diff``
                    # holds the before and after, text included, because the
                    # agent keeps no version rows to hold it instead.
                    details={
                        "name": agent.name,
                        "changed": voice,
                        "version": agent.version,
                        "soul_traits": agent.soul_traits,
                        "soul_chars": len(agent.soul or ""),
                        "diff": {f: changed[f] for f in voice},
                        "why": payload.why,
                    },
                )
        return agent

    # ── instructions: draft, publish, roll back ──────────────────────────────

    async def write_draft(self, session: AsyncSession, *, agent: Agent, instructions: str) -> Agent:
        """Write the agent's unpublished instructions. Nothing runs on them yet."""
        agent.instructions_draft = instructions
        await session.flush()
        return agent

    async def discard_draft(self, session: AsyncSession, *, agent: Agent) -> Agent:
        agent.instructions_draft = None
        await session.flush()
        return agent

    async def publish_instructions(
        self,
        session: AsyncSession,
        *,
        agent: Agent,
        actor: User,
        why: str | None = None,
        evaluated: dict | None = None,
    ) -> Agent:
        """Move the draft into ``instructions`` — an ordinary ``agent.update``.

        A draft that says what the instructions already say closes without a
        new version: nothing a run reads has changed. Refused when no draft is
        open, because there is nothing to publish.
        """
        draft = agent.instructions_draft
        if draft is None:
            raise ConflictError(f"'{agent.name}' has no draft of its instructions to publish.")
        agent.instructions_draft = None
        return await self.update_agent(
            session, agent=agent, payload=AgentUpdate(instructions=draft, why=why), actor=actor, evaluated=evaluated
        )

    async def rollback_instructions(
        self,
        session: AsyncSession,
        *,
        agent: Agent,
        version: int,
        actor: User,
        why: str | None = None,
        evaluated: dict | None = None,
    ) -> Agent:
        """Restore the instructions as they were at an earlier agent version.

        An agent keeps no version rows, so the text is read back from the
        ``diff`` its update events carry: the ``after`` of the last change at
        or before ``version``, else the ``before`` of the first change after
        it, else today's text. The restore is a new version, never a rewrite.

        Refused while a draft is open (the draft is a person's unpublished
        work), when that text is already current, and when the change holding
        it was written before events recorded before and after. A version the
        agent never had reads as absent.
        """
        if agent.instructions_draft is not None:
            raise ConflictError(
                f"'{agent.name}' has a draft of its instructions — publish or discard it before rolling back."
            )
        if version >= agent.version:
            raise NotFoundError(f"Version {version} of '{agent.name}' is not an earlier version.")
        text = await self.instructions_at(session, agent=agent, version=version)
        if text == agent.instructions:
            raise ConflictError(f"The instructions of '{agent.name}' at v{version} are already current.")
        return await self.update_agent(
            session,
            agent=agent,
            payload=AgentUpdate(instructions=text, why=why),
            actor=actor,
            restored_from=version,
            evaluated=evaluated,
        )

    async def instructions_at(self, session: AsyncSession, *, agent: Agent, version: int) -> str:
        """The agent's instructions as they read at ``version``, folded from its update events."""
        events = await self.events_qs.for_targets(
            session,
            graph_id=agent.graph_id,
            target_kind=actions.TARGET_AGENT,
            target_ids=[agent.id],
            actions=frozenset({actions.AGENT_UPDATE}),
        )
        changes = [
            (int((e.details or {}).get("version") or 0), e.details or {})
            for e in events
            if "instructions" in ((e.details or {}).get("changed") or [])
        ]
        at_or_before = [(v, d) for v, d in changes if v <= version]
        if at_or_before:
            recorded, side = at_or_before[-1][1], "after"
        elif changes:
            recorded, side = changes[0][1], "before"
        else:
            return agent.instructions
        value = ((recorded.get("diff") or {}).get("instructions") or {}).get(side)
        if value is None:
            raise ConflictError(
                f"The instructions of '{agent.name}' at v{version} were changed before edits were recorded, "
                "so they cannot be restored."
            )
        return value

    async def set_status(self, session: AsyncSession, *, agent: Agent, status: AgentStatus, actor: User) -> Agent:
        """Pause / resume. Retiring goes through :func:`retire_agent`.

        A draft is neither: it becomes active only through :meth:`make_live`,
        which runs the eval gate a resume would skip.
        """
        if agent.status == AgentStatus.draft.value:
            raise ConflictError(f"'{agent.name}' is a draft. Create it before pausing or resuming it.")
        agent.status = status.value
        if status is AgentStatus.paused:
            await self._block_open_tasks(session, agent=agent, reason=f"'{agent.name}' is paused")
        await emit_event(
            session,
            action=actions.AGENT_PAUSE if status is AgentStatus.paused else actions.AGENT_RESUME,
            target_kind=actions.TARGET_AGENT,
            target_id=agent.id,
            graph_id=agent.graph_id,
            actor_id=actor.id,
            details={"name": agent.name},
        )
        return agent

    async def make_live(
        self,
        session: AsyncSession,
        *,
        agent: Agent,
        actor: User,
        why: str | None = None,
        evaluated: dict | None = None,
    ) -> Agent:
        """*Create agent*: move a draft to ``active``, so it may be offered work.

        Refused with 409 unless the agent is a draft — an active agent is
        already created, and a paused or retired one is resumed or left alone.
        ``evaluated`` is the eval gate's verdict the caller already passed; it
        rides on the ``agent.activate`` event beside the ``why``.
        """
        if agent.status != AgentStatus.draft.value:
            raise ConflictError(f"'{agent.name}' is {agent.status}, not a draft — there is nothing to create.")
        agent.status = AgentStatus.active.value
        await session.flush()
        await emit_event(
            session,
            action=actions.AGENT_ACTIVATE,
            target_kind=actions.TARGET_AGENT,
            target_id=agent.id,
            graph_id=agent.graph_id,
            actor_id=actor.id,
            details={
                "name": agent.name,
                "why": why,
                **({"eval": evaluated} if evaluated is not None else {}),
            },
        )
        return agent

    async def retire_agent(
        self,
        session: AsyncSession,
        *,
        agent: Agent,
        actor: User,
        reassign_to_kind: str | None = None,
        reassign_to_id: str | None = None,
        why: str | None = None,
    ) -> Agent:
        """Retire, not delete. **The row stays** so lineage and every trace row
        still resolve to a name (docs/for-developers/modules/work/spec.md)."""
        agent.status = AgentStatus.retired.value
        tasks = await self._open_tasks(session, agent=agent)
        for task in tasks:
            if reassign_to_kind and reassign_to_id:
                task.assignee_kind = reassign_to_kind
                task.assignee_id = reassign_to_id
                task.status = TaskStatus.assigned.value
                task.blocked_reason = None
            else:
                task.status = TaskStatus.blocked.value
                task.blocked_reason = f"'{agent.name}' was retired"
        await emit_event(
            session,
            action=actions.AGENT_RETIRE,
            target_kind=actions.TARGET_AGENT,
            target_id=agent.id,
            graph_id=agent.graph_id,
            actor_id=actor.id,
            details={
                "name": agent.name,
                "open_tasks": [t.id for t in tasks],
                "reassigned_to": reassign_to_id,
                "why": why,
            },
        )
        return agent

    async def set_default_agent(self, session: AsyncSession, *, graph: Graph, agent: Agent, actor: User) -> Graph:
        if not agent.is_available:
            raise ConflictError(
                f"'{agent.name}' is {agent.status}; a draft, paused or retired agent cannot be the default."
            )
        if not agent.answers_asks:
            # The default answers every Explorer ask that names no agent, so it
            # must be able to read the graph (AG3 · WQ5).
            raise ConflictError(f"'{agent.name}' cannot answer questions on the graph, so it cannot be the default.")
        graph.default_agent_id = agent.id
        await emit_event(
            session,
            action=actions.AGENT_SET_DEFAULT,
            target_kind=actions.TARGET_AGENT,
            target_id=agent.id,
            graph_id=graph.id,
            actor_id=actor.id,
            details={"name": agent.name},
        )
        return graph

    # ── what it holds ─────────────────────────────────────────────────────────

    async def _hold(self, session: AsyncSession, *, agent: Agent, names: list[str], actor_id: str | None) -> None:
        """Attach the Graph's managed policies ``names`` to a new agent.

        A Graph whose managed policies are not written yet attaches nothing.
        """
        for policy in await self.holdings_qs.managed_by_name(session, graph_id=agent.graph_id, names=names):
            await self.policies_qs.add(
                session,
                PolicyAttachment(
                    policy_id=policy.id,
                    graph_id=agent.graph_id,
                    holder_kind="agent",
                    holder_id=agent.id,
                    attached_by_id=actor_id,
                    via="direct",
                ),
            )

    async def _check_ceilings(self, session: AsyncSession, *, agent: Agent, budget: dict | None) -> None:
        """Refuse a budget above a ceiling a policy the agent holds sets, naming the policy and the ceiling.

        The tightest ceiling across its policies and the Graph's boundaries
        binds; a key the budget does not set is not checked.
        """
        wanted = {k: v for k, v in (budget or {}).items() if k in _POLICY_CEILINGS and v is not None}
        if not wanted:
            return
        held = [
            *await self.holdings.policies_for(session, graph_id=agent.graph_id, principal=("agent", agent.id)),
            *await self.holdings.boundaries(session, graph_id=agent.graph_id),
        ]
        for key, value in wanted.items():
            limit, label = _POLICY_CEILINGS[key]
            for h in held:
                ceiling = (h.policy.limits or {}).get(limit)
                if ceiling is not None and int(value) > int(ceiling):
                    raise ValidationError(
                        f"Policy {h.policy.name} caps {label} at {int(ceiling)}; "
                        f"'{agent.name}' cannot be set to {int(value)}."
                    )

    async def _open_tasks(self, session: AsyncSession, *, agent: Agent) -> list[Task]:
        return await self.tasks_qs.open_for_agent(session, graph_id=agent.graph_id, agent_id=agent.id)

    async def _block_open_tasks(self, session: AsyncSession, *, agent: Agent, reason: str) -> None:
        for task in await self._open_tasks(session, agent=agent):
            if task.status != TaskStatus.review.value:
                task.status = TaskStatus.blocked.value
                task.blocked_reason = reason
