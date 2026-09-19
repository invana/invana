"""Agent roster rules — seeding, creation, status and the default.

A **seeded** agent cannot be renamed or deleted; it is retired instead. That is
what keeps a Graph's starting roster recognisable across upgrades.

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
from invana.apps.graphs.models import Graph
from invana.apps.llm_providers.querysets import LLMProviderQuerySet
from invana.apps.work.models import Task, TaskStatus
from invana.apps.work.querysets import TaskQuerySet
from invana.core.auth.models import User
from invana.core.errors import ConflictError, NotFoundError, ValidationError
from invana.core.events import actions
from invana.core.events.models import ActorKind
from invana.core.events.services import current_trace_id, diff_changed_fields, emit_event

"""Service layer for agents — the roster, the lifecycle, and lineage."""

_UPDATABLE = ["name", "description", "instructions", "workflow_spec", "llm_config_id", "skill_ids", "budget", "policy"]


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
    querysets = AgentQuerySet()
    providers = LLMProviderQuerySet()
    tasks = TaskQuerySet()

    async def seed_agents(self, session: AsyncSession, *, graph: Graph) -> list[Agent]:
        """Give a graph the agents it is born with, idempotently.

        Called at graph creation and again on the first read of the roster, so an
        graph created before agents existed grows them the moment it is looked at
        rather than needing a data migration to be re-run.
        """
        default_llm = await self.providers.get_default(session, graph.id)

        created: list[Agent] = []
        for seeded in SEEDED_AGENTS:
            existing = await self.querysets.get_by_key(session, graph_id=graph.id, key=seeded.key)
            if existing is not None:
                # Keep a seeded agent's binding fresh when the graph's default
                # provider changes; an authored agent keeps whatever it was given.
                if existing.llm_config_id is None and default_llm is not None:
                    existing.llm_config_id = default_llm.id
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
                llm_config_id=default_llm.id if default_llm else None,
                created_by_kind="system",
            )
            await self.querysets.add(session, agent)
            created.append(agent)
            if seeded.default and not graph.default_agent_id:
                graph.default_agent_id = agent.id
        if graph.default_agent_id is None:
            explorer = await self.querysets.get_by_key(session, graph_id=graph.id, key="explorer")
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
            agent = await self.querysets.get(session, graph.default_agent_id)
            if agent is not None and agent.graph_id == graph.id and agent.is_available:
                return agent
        return await self.querysets.get_by_key(session, graph_id=graph.id, key=key)

    async def list_agents(
        self,
        session: AsyncSession,
        *,
        graph: Graph,
        include_ephemeral: bool = False,
        include_retired: bool = False,
    ) -> list[Agent]:
        await self.seed_agents(session, graph=graph)
        return await self.querysets.list_for_graph(
            session, graph.id, include_ephemeral=include_ephemeral, include_retired=include_retired
        )

    async def get_or_404(self, session: AsyncSession, *, agent_id: str, graph_id: str) -> Agent:
        agent = await self.querysets.get(session, agent_id)
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

    async def create_agent(self, session: AsyncSession, *, graph: Graph, payload: AgentCreate, actor: User) -> Agent:
        spec = payload.workflow_spec
        if spec is None and payload.envelope_from:
            seeded = next((s for s in SEEDED_AGENTS if s.key == payload.envelope_from), None)
            if seeded is None:
                raise ValidationError(f"No seeded agent named '{payload.envelope_from}' to copy an envelope from.")
            spec = copy.deepcopy(seeded.workflow_spec)

        agent = Agent(
            graph_id=graph.id,
            name=payload.name,
            description=payload.description,
            instructions=payload.instructions,
            kind=AgentKind.authored.value,
            workflow_spec=spec or {},
            llm_config_id=payload.llm_config_id,
            skill_ids=list(payload.skill_ids),
            budget=payload.budget,
            policy=payload.policy,
            created_by_kind="user",
            created_by_id=actor.id,
        )
        try:
            await self.querysets.add(session, agent)
        except IntegrityError as exc:
            raise ConflictError(f"An agent named '{payload.name}' already exists in this graph.") from exc
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
        return await self.tasks.open_for_agent(session, graph_id=agent.graph_id, agent_id=agent.id)

    async def _block_open_tasks(self, session: AsyncSession, *, agent: Agent, reason: str) -> None:
        for task in await self._open_tasks(session, agent=agent):
            if task.status != TaskStatus.review.value:
                task.status = TaskStatus.blocked.value
                task.blocked_reason = reason
