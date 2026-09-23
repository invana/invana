"""Binding rules — offer a skill to an agent, and take it back.

The one write path ([BN6](docs/for-developers/modules/skills/features/bindings.md)):
a bind is a single skill reaching a single agent, so it has somewhere to be
refused and somebody to attribute. Replacing a whole list had neither.

**Nothing here imports an agent.** Skills is an independent module that agents
bind to, so the agent arrives as an id and a name — the id for the row, the name
for the event, which must still read after the agent is gone
(docs/for-developers/modules/operate/features/audit-and-activity.md).

That is also why the bind-time checks arrive as a **callable**
([BN5](docs/for-developers/modules/skills/features/bindings.md)): the envelope
half reads the plan a skill version draws, and `apps/task_plans` sits above this
package. So the check is composed one band up
(`runtime/managers/skill_bind.py`) and handed in by whoever binds — the same
shape `SkillDraftManager.apply_drawing` uses for `resolve_plan`.
"""

from __future__ import annotations

from typing import Protocol

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.skills.models import Skill, SkillBinding
from invana.apps.skills.querysets import SkillBindingQuerySet
from invana.core.errors import ConflictError, NotFoundError
from invana.core.events import actions
from invana.core.events.services import current_trace_id, emit_event


class BindCheck(Protocol):
    """Whatever refuses a bind this agent could never run.

    Raises — it never returns a verdict — so a caller that does not hand one in
    gets the shipped behaviour of before, which is what
    [BN7](docs/for-developers/modules/skills/features/bindings.md) asks for: a
    bind is never refused on grounds it did not check.
    """

    async def __call__(
        self,
        session: AsyncSession,
        *,
        skill: Skill,
        agent_id: str,
        agent_name: str,
    ) -> None: ...


class SkillBindingManager:
    """Stateless. The session is the first argument of every method."""

    skill_bindings_qs = SkillBindingQuerySet()

    async def skill_ids_for_agent(self, session: AsyncSession, *, agent_id: str) -> list[str]:
        return await self.skill_bindings_qs.skill_ids_for_agent(session, agent_id=agent_id)

    async def agent_ids_for_skill(self, session: AsyncSession, *, skill_id: str) -> list[str]:
        return await self.skill_bindings_qs.agent_ids_for_skill(session, skill_id=skill_id)

    async def bind(
        self,
        session: AsyncSession,
        *,
        skill: Skill,
        agent_id: str,
        agent_name: str,
        actor_id: str,
        check: BindCheck | None = None,
    ) -> SkillBinding:
        """Offer a skill to an agent.

        Binding what is already bound is a conflict rather than a silent
        no-op: the caller believes it is changing the bindings, and it is not.

        ``check`` runs **before the row is written** and raises to refuse
        ([BN5](docs/for-developers/modules/skills/features/bindings.md)) — so a
        skill this agent could never run fails here, in front of the person
        binding it, rather than inside a run at 3am.
        """
        existing = await self.skill_bindings_qs.get(session, skill_id=skill.id, agent_id=agent_id)
        if existing is not None:
            raise ConflictError(f"'{skill.name}' is already offered to {agent_name}.")

        if check is not None:
            await check(session, skill=skill, agent_id=agent_id, agent_name=agent_name)

        binding = SkillBinding(skill_id=skill.id, agent_id=agent_id, bound_by_id=actor_id)
        await self.skill_bindings_qs.add(session, binding)
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
        binding = await self.skill_bindings_qs.get(session, skill_id=skill.id, agent_id=agent_id)
        if binding is None:
            raise NotFoundError(f"'{skill.name}' is not offered to {agent_name}.")

        await self.skill_bindings_qs.delete(session, binding)
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
