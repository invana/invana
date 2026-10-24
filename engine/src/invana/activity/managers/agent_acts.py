"""Pause and Retire as the Graph sees them: the agent's open work, and the
schedules that start it.

The agent's own work — runs, Todos, sessions — is read by the runtime's
``AgentLifecycleManager``. Schedules live in this band, above the runtime, so
the part of each act that touches a schedule is added here: the preview names
each active schedule that starts the agent and what the act does to it, and
retiring pauses them in the same transaction.

Usage::

    acts = AgentActsManager()
    preview = await acts.preview(session, agent=agent, act=LifecycleAct.retire)
    agent = await acts.retire(session, agent=agent, actor=user, why="Replaced")
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.managers.schedules import ScheduleManager
from invana.apps.agents.managers import AgentManager
from invana.apps.agents.models import Agent
from invana.apps.agents.schemas import LifecycleAct, LifecycleEffect, LifecycleItem, LifecyclePreview
from invana.core.auth.models import User
from invana.runtime.managers import AgentLifecycleManager


class AgentActsManager:
    lifecycle = AgentLifecycleManager()
    agents = AgentManager()
    schedules = ScheduleManager()

    async def preview(self, session: AsyncSession, *, agent: Agent, act: LifecycleAct) -> LifecyclePreview:
        """The open work ``act`` would disturb, the schedules that start the agent last.

        A pause leaves a schedule active and its firings fail naming the
        state until the agent resumes; a retire pauses it.
        """
        preview = await self.lifecycle.preview(session, agent=agent, act=act)
        for row in await self.schedules.starting(session, agent=agent):
            retire = act is LifecycleAct.retire
            preview.items.append(
                LifecycleItem(
                    kind="schedule",
                    id=row.id,
                    title=row.name,
                    effect=LifecycleEffect.paused if retire else LifecycleEffect.refused,
                    note=(
                        "Paused. Point it at another agent and resume it to run again."
                        if retire
                        else "Stays on; each firing fails, naming the pause, until the agent resumes."
                    ),
                )
            )
        return preview

    async def retire(
        self,
        session: AsyncSession,
        *,
        agent: Agent,
        actor: User,
        reassign_to_kind: str | None = None,
        reassign_to_id: str | None = None,
        why: str | None = None,
    ) -> Agent:
        """Retire ``agent`` and pause every active schedule that starts it."""
        agent = await self.agents.retire_agent(
            session,
            agent=agent,
            actor=actor,
            reassign_to_kind=reassign_to_kind,
            reassign_to_id=reassign_to_id,
            why=why,
        )
        await self.schedules.pause_for_retired(session, agent=agent, actor_id=actor.id)
        return agent
