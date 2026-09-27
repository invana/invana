"""Rules for a Graph's agents — seeding, creation, status and the default.

A **seeded** agent cannot be renamed or deleted; it is retired instead. That is
what keeps a Graph's starting agents recognisable across upgrades.

Retirement, deletion and lineage read `runs` and live in
`runtime/managers/agent_lifecycle.py` — an app may not import the runtime
(migration-plan §18.1.1 S1).
"""

from __future__ import annotations

import copy

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.models import DEFAULT_EFFORT, Agent, AgentKind, AgentStatus
from invana.apps.agents.querysets import AgentQuerySet
from invana.apps.agents.registry import SEEDED_AGENTS, SURFACE_DEFAULT_AGENT
from invana.apps.agents.schemas import (
    AgentCreate,
    AgentRead,
    AgentUpdate,
)
from invana.apps.govern.managers import LensManager
from invana.apps.govern.models import Lens, LensKind
from invana.apps.graphs.models import Graph
from invana.apps.llm.voice import check_traits
from invana.apps.skills.managers import BindCheck, SkillBindingManager, SkillManager
from invana.apps.work.models import Task, TaskStatus
from invana.apps.work.querysets import TaskQuerySet
from invana.core.auth.models import User
from invana.core.errors import ConflictError, NotFoundError, ValidationError
from invana.core.events import actions
from invana.core.events.models import ActorKind
from invana.core.events.services import current_trace_id, diff_changed_fields, emit_event

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
]
#: The fields that are the agent's voice. A change to one is `agent.soul_set`
#: rather than `agent.update`, because it changes how the agent speaks and
#: nothing it may do (SO2 · AG16).
_VOICE = ("soul", "soul_traits")


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
    tasks_qs = TaskQuerySet()
    # Binding is Skills' rule, called from here rather than reimplemented: this
    # package writes no `skill_bindings` row of its own (BN6).
    skills = SkillManager()
    bindings = SkillBindingManager()
    # An agent's own narrowing is a guardrail scoped to it (AG10 · AG26), and
    # guardrails are Govern's rows.
    lenses = LensManager()

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
            created.append(agent)
            if seeded.default and not graph.default_agent_id:
                graph.default_agent_id = agent.id
        if graph.default_agent_id is None:
            explorer = await self.agents_qs.get_by_key(session, graph_id=graph.id, key="explorer")
            if explorer is not None:
                graph.default_agent_id = explorer.id
        return created

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
            raise ConflictError(f"'{agent.name}' is {agent.status}. Pick another agent, or resume this one.")
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

        agent = Agent(
            graph_id=graph.id,
            name=payload.name,
            description=payload.description,
            instructions=payload.instructions,
            kind=AgentKind.authored.value,
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
            trace_id=current_trace_id(),
        )
        return agent

    async def update_agent(self, session: AsyncSession, *, agent: Agent, payload: AgentUpdate, actor: User) -> Agent:
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

        before = {f: copy.deepcopy(getattr(agent, f)) for f in _UPDATABLE}
        for field in _UPDATABLE:
            value = getattr(payload, field)
            if value is not None:
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
                    details={"name": agent.name, "changed": rest, "version": agent.version},
                    trace_id=current_trace_id(),
                )
            if voice:
                await emit_event(
                    session,
                    action=actions.AGENT_SOUL_SET,
                    target_kind=actions.TARGET_AGENT,
                    target_id=agent.id,
                    graph_id=agent.graph_id,
                    actor_id=actor.id,
                    # The dials are small and closed, so they ride in full; the
                    # soul is a document, so the event says its size and the
                    # agent version holds the text.
                    details={
                        "name": agent.name,
                        "changed": voice,
                        "version": agent.version,
                        "soul_traits": agent.soul_traits,
                        "soul_chars": len(agent.soul or ""),
                    },
                    trace_id=current_trace_id(),
                )
        return agent

    async def set_status(self, session: AsyncSession, *, agent: Agent, status: AgentStatus, actor: User) -> Agent:
        """Pause / resume. Retiring goes through :func:`retire_agent`."""
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
            trace_id=current_trace_id(),
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
            },
            trace_id=current_trace_id(),
        )
        return agent

    async def set_default_agent(self, session: AsyncSession, *, graph: Graph, agent: Agent, actor: User) -> Graph:
        if not agent.is_available:
            raise ConflictError(f"'{agent.name}' is {agent.status}; a paused or retired agent cannot be the default.")
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
            trace_id=current_trace_id(),
        )
        return graph

    async def _open_tasks(self, session: AsyncSession, *, agent: Agent) -> list[Task]:
        return await self.tasks_qs.open_for_agent(session, graph_id=agent.graph_id, agent_id=agent.id)

    async def _block_open_tasks(self, session: AsyncSession, *, agent: Agent, reason: str) -> None:
        for task in await self._open_tasks(session, agent=agent):
            if task.status != TaskStatus.review.value:
                task.status = TaskStatus.blocked.value
                task.blocked_reason = reason
