"""Binding rules — offer a skill to an agent, and take it back.

The one write path ([BN6](docs/for-developers/modules/skills/features/bindings.md)):
a bind is a single skill reaching a single agent, so it has somewhere to be
refused and somebody to attribute. Replacing a whole list had neither.

**Nothing here imports an agent.** Skills is an independent module that agents
bind to, so the agent arrives as an id and a name — the id for the row, the name
for the event, which must still read after the agent is gone
(docs/for-developers/modules/operate/features/audit-and-activity.md).
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.skills.models import Skill, SkillBinding
from invana.apps.skills.querysets import SkillBindingQuerySet
from invana.core.errors import ConflictError, NotFoundError
from invana.core.events import actions
from invana.core.events.services import current_trace_id, emit_event


class SkillBindingManager:
    """Stateless. The session is the first argument of every method."""

    querysets = SkillBindingQuerySet()

    async def skill_ids_for_agent(self, session: AsyncSession, *, agent_id: str) -> list[str]:
        return await self.querysets.skill_ids_for_agent(session, agent_id=agent_id)

    async def agent_ids_for_skill(self, session: AsyncSession, *, skill_id: str) -> list[str]:
        return await self.querysets.agent_ids_for_skill(session, skill_id=skill_id)

    async def bind(
        self,
        session: AsyncSession,
        *,
        skill: Skill,
        agent_id: str,
        agent_name: str,
        actor_id: str,
    ) -> SkillBinding:
        """Offer a skill to an agent.

        Binding what is already bound is a conflict rather than a silent
        no-op: the caller believes it is changing the roster, and it is not.
        """
        existing = await self.querysets.get(session, skill_id=skill.id, agent_id=agent_id)
        if existing is not None:
            raise ConflictError(f"'{skill.name}' is already offered to {agent_name}.")

        binding = SkillBinding(skill_id=skill.id, agent_id=agent_id, bound_by_id=actor_id)
        await self.querysets.add(session, binding)
        await emit_event(
            session,
            action=actions.AGENT_SKILL_BOUND,
            target_kind=actions.TARGET_AGENT,
            target_id=agent_id,
            graph_id=skill.graph_id,
            actor_id=actor_id,
            details={"skill_id": skill.id, "skill_name": skill.name, "agent_name": agent_name},
            trace_id=current_trace_id(),
        )
        return binding

    async def unbind(
        self,
        session: AsyncSession,
        *,
        skill: Skill,
        agent_id: str,
        agent_name: str,
        actor_id: str,
    ) -> None:
        """Take a skill back. The next run is not offered it; a run in flight
        already has its prompt ([BN3](docs/for-developers/modules/skills/features/bindings.md))."""
        binding = await self.querysets.get(session, skill_id=skill.id, agent_id=agent_id)
        if binding is None:
            raise NotFoundError(f"'{skill.name}' is not offered to {agent_name}.")

        await self.querysets.delete(session, binding)
        await emit_event(
            session,
            action=actions.AGENT_SKILL_UNBOUND,
            target_kind=actions.TARGET_AGENT,
            target_id=agent_id,
            graph_id=skill.graph_id,
            actor_id=actor_id,
            details={"skill_id": skill.id, "skill_name": skill.name, "agent_name": agent_name},
            trace_id=current_trace_id(),
        )
