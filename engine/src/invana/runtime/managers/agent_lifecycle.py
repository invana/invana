"""Retiring, deleting and tracing an agent.

Band 3 rather than `apps/agents`: all four read `runs`, and the retirement
preview also reads sessions and tasks. An app may not import the runtime; the
runtime may import an app (migration-plan §18.1.1 S1). This is also
[§14.2 item 5](../../../docs/for-developers/building-engine/migration-plan.md) —
the cross-app read that was living in the wrong app.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.managers import AgentManager
from invana.apps.agents.models import Agent, AgentKind, AgentLifetime, AgentStatus
from invana.apps.agents.querysets import AgentQuerySet
from invana.apps.agents.schemas import (
    AgentEdge,
    AgentLineageResponse,
    AgentNode,
    LifecycleAct,
    LifecycleEffect,
    LifecycleItem,
    LifecyclePreview,
)
from invana.apps.sessions.models import Session as ChatSession
from invana.apps.work.models import Task, TaskStatus
from invana.core.auth.models import User
from invana.core.errors import ConflictError
from invana.core.events import actions
from invana.core.events.services import current_trace_id, emit_event
from invana.runtime.models import TaskRun
from invana.runtime.querysets import TaskRunQuerySet


class AgentLifecycleManager:
    agents_qs = AgentQuerySet()
    agent_rules = AgentManager()
    runs_qs = TaskRunQuerySet()

    async def spend_this_month(self, session: AsyncSession, *, graph_id: str) -> dict[str, float]:
        """``{agent_id: usd}`` since the first of the month, for the list's
        meter ([C10](docs/for-developers/modules/agents/features/author-an-agent.md)).

        It lives here rather than in ``apps/agents`` because it reads
        ``task_runs``, which an app may not (migration-plan §18.1.1). The window
        is the **calendar month**, the same one ``max_cost_usd_month`` names — a
        rolling thirty days would draw a different number from the ceiling it
        sits beside.
        """
        now = datetime.now(UTC)
        since = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        return await self.runs_qs.spend_by_agent(session, graph_id=graph_id, since=since)

    async def preview(self, session: AsyncSession, *, agent: Agent, act: LifecycleAct) -> LifecyclePreview:
        """The open work this act would disturb, item by item.

        One shape for both acts
        ([LC8](../../../docs/for-developers/modules/agents/features/lifecycle.md)):
        the list is the same work either way, and what differs is the effect —
        which is exactly what a count cannot carry (LC6). The runs are read
        first because *nothing is killed* is the reassurance a person reaches
        for at 3am, and a todo in ``review`` is the one row where the two acts
        disagree.
        """
        items: list[LifecycleItem] = []

        for run in await self.runs_qs.in_flight_for_agent(session, agent_id=agent.id):
            items.append(
                LifecycleItem(
                    kind="run",
                    id=run.id,
                    title=run.label or run.workflow_key or "Run",
                    effect=LifecycleEffect.finishes,
                    note="Finishes — never killed.",
                )
            )

        for task in await self.agent_rules._open_tasks(session, agent=agent):
            # `_block_open_tasks` leaves a task in review alone, and retiring
            # does not: the same row, two answers, which is the whole argument
            # for showing the items rather than the count (LC9).
            spared = act is LifecycleAct.pause and task.status == TaskStatus.review.value
            items.append(
                LifecycleItem(
                    kind="task",
                    id=task.id,
                    title=task.title,
                    effect=LifecycleEffect.unchanged if spared else LifecycleEffect.blocked,
                    note=(
                        "In review — a pause leaves it alone."
                        if spared
                        else f"Blocked, naming '{agent.name}'. It unblocks when the agent does."
                        if act is LifecycleAct.pause
                        else f"Blocked, naming '{agent.name}'. Reassign it to move it on."
                    ),
                )
            )

        threads = (
            (await session.execute(select(ChatSession.id, ChatSession.title).where(ChatSession.agent_id == agent.id)))
            .tuples()
            .all()
        )
        for thread_id, title in threads:
            items.append(
                LifecycleItem(
                    kind="session",
                    id=thread_id,
                    title=title or "Untitled thread",
                    effect=LifecycleEffect.refused,
                    note="Its next ask is refused, naming the state — never answered by another agent.",
                )
            )

        return LifecyclePreview(agent_id=agent.id, act=act, items=items)

    async def delete_agent(self, session: AsyncSession, *, agent: Agent, actor: User) -> None:
        """Hard delete — allowed only for an agent that has never run_ask.

        Anything else would leave the trace pointing at nothing, so it retires
        instead and the caller is told which.
        """
        if agent.kind == AgentKind.seeded.value:
            raise ConflictError("A seeded agent cannot be deleted. Retire it.")
        run_ask = (
            await session.execute(select(TaskRun.id).where(TaskRun.agent_id == agent.id).limit(1))
        ).scalar_one_or_none()
        if run_ask is not None:
            raise ConflictError(f"'{agent.name}' has already run_ask; retire it instead so its trace still resolves.")
        name, graph_id, agent_id = agent.name, agent.graph_id, agent.id
        await self.agents_qs.delete(session, agent)
        await emit_event(
            session,
            action=actions.AGENT_DELETE,
            target_kind=actions.TARGET_AGENT,
            target_id=agent_id,
            graph_id=graph_id,
            actor_id=actor.id,
            details={"name": name},
            trace_id=current_trace_id(),
        )

    async def retire_ephemeral_for_task(self, session: AsyncSession, *, task_id: str, graph_id: str) -> None:
        """Close out the agents a task's runs spawned (docs/for-developers/modules/work/spec.md).

        An ephemeral agent exists for the task it was spawned for; when that task
        closes it is retired automatically, hidden from the list, and still fully
        present in lineage and the trace.
        """
        run_ids = (await session.execute(select(TaskRun.id).where(TaskRun.todo_id == task_id))).scalars().all()
        if not run_ids:
            return
        agents = (
            (
                await session.execute(
                    select(Agent).where(
                        Agent.graph_id == graph_id,
                        Agent.lifetime == AgentLifetime.ephemeral.value,
                        Agent.status != AgentStatus.retired.value,
                        Agent.spawned_in_run_id.in_(list(run_ids)),
                    )
                )
            )
            .scalars()
            .all()
        )
        for agent in agents:
            agent.status = AgentStatus.retired.value

    async def lineage(self, session: AsyncSession, *, agent: Agent) -> AgentLineageResponse:
        """Ancestors, descendants, and the people and tasks around them.

        The first canvas kind whose nodes are **not all the same thing**
        (docs/for-developers/modules/explore/features/selection-and-the-panel.md): agents, people and tasks share one
        drawing, which is why
        a click has to branch on the node's kind.
        """
        agents_qs = self.agents_qs
        nodes: dict[str, AgentNode] = {}
        edges: list[AgentEdge] = []

        def add_agent(a: Agent) -> None:
            nodes[a.id] = AgentNode(
                id=a.id,
                kind="agent",
                label=a.name,
                agent_kind=a.kind,
                status=a.status,
                lifetime=a.lifetime,
            )

        add_agent(agent)

        # Up the parent chain, then down through every descendant.
        node: Agent | None = agent
        seen_up: set[str] = set()
        while node is not None and node.parent_agent_id and node.parent_agent_id not in seen_up:
            seen_up.add(node.parent_agent_id)
            parent = await agents_qs.get(session, node.parent_agent_id)
            if parent is None:
                break
            add_agent(parent)
            edges.append(
                AgentEdge(
                    id=f"spawn:{parent.id}:{node.id}",
                    source=parent.id,
                    target=node.id,
                    kind="spawned",
                    label="spawned",
                )
            )
            node = parent

        frontier = [agent]
        while frontier:
            current = frontier.pop()
            for child in await agents_qs.children(session, current.id):
                if child.id in nodes:
                    continue
                add_agent(child)
                edges.append(
                    AgentEdge(
                        id=f"spawn:{current.id}:{child.id}",
                        source=current.id,
                        target=child.id,
                        kind="spawned",
                        label="spawned",
                    )
                )
                frontier.append(child)

        # The person who authored the root, and the tasks these agents worked. A
        # person node is inert on the canvas — MVP has no person surface — but it
        # is what makes "who set this in motion" legible at a glance.
        for a in list(nodes.values()):
            source_agent = await agents_qs.get(session, a.id)
            if source_agent is None or source_agent.created_by_kind != "user" or not source_agent.created_by_id:
                continue
            user = await session.get(User, source_agent.created_by_id)
            if user is None:
                continue
            if user.id not in nodes:
                nodes[user.id] = AgentNode(id=user.id, kind="user", label=user.username)
            edges.append(
                AgentEdge(
                    id=f"authored:{user.id}:{a.id}",
                    source=user.id,
                    target=a.id,
                    kind="authored",
                    label="authored",
                )
            )

        agent_ids = [a.id for a in nodes.values() if a.kind == "agent"]
        tasks = (
            (
                await session.execute(
                    select(Task).where(Task.graph_id == agent.graph_id, Task.assignee_id.in_(agent_ids))
                )
            )
            .scalars()
            .all()
        )
        for task in tasks:
            nodes[task.id] = AgentNode(id=task.id, kind="task", label=task.title, status=task.status)
            edges.append(
                AgentEdge(
                    id=f"assigned:{task.assignee_id}:{task.id}",
                    source=task.assignee_id or "",
                    target=task.id,
                    kind="assigned",
                    label="assigned",
                )
            )

        return AgentLineageResponse(agent_id=agent.id, nodes=list(nodes.values()), edges=edges)
