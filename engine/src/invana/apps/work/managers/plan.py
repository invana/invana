"""The plan a project's tasks describe — waves, blockers, the critical path.

One call, because the Plan tab and the Plan canvas are two renderings of the
same fact. The topology itself is derived by ``work/plan.py``, which is pure and
takes no session; this manager is what feeds it and names the result.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.querysets import AgentQuerySet
from invana.apps.graphs.models import Graph
from invana.apps.work.models import Project, Task
from invana.apps.work.plan import derive
from invana.apps.work.querysets import ProjectQuerySet, TaskDependencyQuerySet, TaskQuerySet
from invana.apps.work.schemas import PlanEdge, PlanTaskRead, ProjectPlanResponse
from invana.core.auth.querysets import UserQuerySet


class PlanManager:
    tasks = TaskQuerySet()
    dependencies = TaskDependencyQuerySet()
    projects = ProjectQuerySet()
    agents = AgentQuerySet()
    users = UserQuerySet()

    async def for_project(self, session: AsyncSession, *, graph: Graph, project: Project | None) -> ProjectPlanResponse:
        tasks = await self.tasks.list_for_project(
            session, graph_id=graph.id, project_id=project.id if project else None
        )
        ids = [t.id for t in tasks]
        edges = await self.dependencies.edges_into(session, task_ids=ids)

        # A cross-project dependency is allowed within a graph, so the plan has
        # to draw the other project's task too — greyed, with its project's key.
        external_ids = {depends_on_id for depends_on_id, _ in edges if depends_on_id not in ids}
        external = await self.tasks.by_ids(session, list(external_ids))

        every = tasks + external
        derived = derive([(t.id, t.status, t.due_at, t.created_at) for t in every], edges)
        positions = derived.by_id()

        keys = await self.projects.keys_by_ids(session, [t.project_id for t in every if t.project_id])
        names = await self._assignee_names(session, every)

        task_reads = [
            PlanTaskRead(
                id=t.id,
                title=t.title,
                status=t.status,
                assignee_kind=t.assignee_kind,
                assignee_id=t.assignee_id,
                assignee_name=names.get(t.assignee_id or ""),
                due_at=t.due_at,
                wave=positions[t.id].wave,
                order=positions[t.id].order,
                blocked_by=positions[t.id].blocked_by,
                critical=positions[t.id].critical,
                project_key=keys.get(t.project_id or ""),
            )
            for t in every
            if t.id in positions
        ]
        task_reads.sort(key=lambda t: t.order)
        return ProjectPlanResponse(
            project_key=project.key if project else None,
            tasks=task_reads,
            edges=[PlanEdge(source=a, target=b) for a, b in derived.edges],
            critical_path=derived.critical_path,
        )

    async def _assignee_names(self, session: AsyncSession, tasks: list[Task]) -> dict[str, str]:
        user_ids = [t.assignee_id for t in tasks if t.assignee_kind == "user" and t.assignee_id]
        agent_ids = [t.assignee_id for t in tasks if t.assignee_kind == "agent" and t.assignee_id]
        out = await self.users.usernames_by_ids(session, list(set(user_ids)))
        out.update(await self.agents.names_by_ids(session, list(set(agent_ids))))
        return out
