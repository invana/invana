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

from invana.apps.agents.models import Agent, AgentKind, AgentStatus
from invana.apps.agents.querysets import AgentQuerySet
from invana.apps.agents.registry import SEEDED_AGENTS, SURFACE_DEFAULT_AGENT
from invana.apps.agents.schemas import (
    AgentCreate,
    AgentUpdate,
)
from invana.apps.govern.managers import LensManager
from invana.apps.govern.models import Lens, LensKind
from invana.apps.graphs.models import Graph
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
_UPDATABLE = ["name", "description", "instructions", "workflow_spec", "budget", "policy"]


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
    # The third bound is a `lenses` row, so the refusal that a world is not this
    # Graph's — or is a guardrail, which nobody picks — is Govern's to raise.
    lenses = LensManager()

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
            if agent is not None and agent.graph_id == graph.id and agent.is_available:
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

    async def resolve_lens(self, session: AsyncSession, *, graph_id: str, lens_id: str | None) -> Lens | None:
        """The world an agent is being put in, or ``None`` for *Everything*.

        A guardrail is refused rather than accepted quietly: a guardrail is
        already in force on every run this agent opens
        ([GR1](docs/for-developers/modules/govern/features/guardrails.md)), so
        binding one here would read as a second bound that changes nothing.
        """
        if lens_id is None:
            return None
        lens = await self.lenses.get(session, lens_id=lens_id, graph_id=graph_id)
        if lens.kind != LensKind.world.value:
            raise ValidationError(
                f"'{lens.name}' is a guardrail, and a guardrail is already in force on every run. Pick a world."
            )
        return lens

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

        lens = await self.resolve_lens(session, graph_id=graph.id, lens_id=payload.lens_id)

        agent = Agent(
            graph_id=graph.id,
            name=payload.name,
            description=payload.description,
            instructions=payload.instructions,
            kind=AgentKind.authored.value,
            workflow_spec=spec or {},
            budget=payload.budget,
            policy=payload.policy,
            lens_id=lens.id if lens else None,
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

        before = {f: getattr(agent, f) for f in _UPDATABLE}
        for field in _UPDATABLE:
            value = getattr(payload, field)
            if value is not None:
                setattr(agent, field, value)
        after = {f: getattr(agent, f) for f in _UPDATABLE}
        changed = diff_changed_fields(before, after, fields=_UPDATABLE)

        # The bound moves on its own event, because *which world this agent
        # works in* is the one field on this object an auditor reads by itself
        # (AG6). Set-ness, not None-ness: null here is `Everything`, chosen.
        lens_moved = "lens_id" in payload.model_fields_set and payload.lens_id != agent.lens_id
        if lens_moved:
            lens = await self.resolve_lens(session, graph_id=agent.graph_id, lens_id=payload.lens_id)
            agent.lens_id = lens.id if lens else None
            changed = [*changed, "lens_id"]

        if changed:
            # The version is what a run records, so it has to move whenever
            # anything about *how this agent thinks* moves.
            agent.version += 1
            try:
                await session.flush()
            except IntegrityError as exc:
                raise ConflictError(f"An agent named '{agent.name}' already exists in this graph.") from exc
            await emit_event(
                session,
                action=actions.AGENT_UPDATE,
                target_kind=actions.TARGET_AGENT,
                target_id=agent.id,
                graph_id=agent.graph_id,
                actor_id=actor.id,
                details={"name": agent.name, "changed": changed, "version": agent.version},
                trace_id=current_trace_id(),
            )
        if lens_moved:
            # `lens` is view-only and was loaded before the write, so the name
            # the response reads back would otherwise be the world it left.
            await session.refresh(agent, ["lens"])
            await emit_event(
                session,
                action=actions.AGENT_LENS_SET,
                target_kind=actions.TARGET_AGENT,
                target_id=agent.id,
                graph_id=agent.graph_id,
                actor_id=actor.id,
                details={"name": agent.name, "lens_id": agent.lens_id, "lens_name": agent.lens_name},
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
