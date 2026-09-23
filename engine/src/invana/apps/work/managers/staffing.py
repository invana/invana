"""Who is on a project (docs/for-developers/modules/work/spec.md).

**Staffing is not a permission** — it does not grant access, and membership
already does that. But it still cannot name a stranger, which is the one check
in here.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.models import Agent
from invana.apps.graphs.querysets import GraphMemberQuerySet
from invana.apps.work.models import Project, ProjectAssignment
from invana.apps.work.querysets import ProjectAssignmentQuerySet
from invana.apps.work.schemas import AssignmentCreate
from invana.core.auth.models import User
from invana.core.errors import NotFoundError
from invana.core.events import actions
from invana.core.events.services import current_trace_id, emit_event


class StaffingManager:
    project_assignments_qs = ProjectAssignmentQuerySet()
    members_qs = GraphMemberQuerySet()

    async def list_for_project(
        self, session: AsyncSession, *, project: Project
    ) -> list[tuple[ProjectAssignment, str | None]]:
        """Each assignment with the principal's display name, or ``None`` if the
        principal is gone."""
        rows = await self.project_assignments_qs.list_for_project(session, project_id=project.id)
        out: list[tuple[ProjectAssignment, str | None]] = []
        for row in rows:
            if row.principal_kind == "user":
                user = await session.get(User, row.principal_id)
                name = user.username if user else None
            else:
                agent = await session.get(Agent, row.principal_id)
                name = agent.name if agent else None
            out.append((row, name))
        return out

    async def staff(
        self, session: AsyncSession, *, project: Project, payload: AssignmentCreate, actor: User
    ) -> ProjectAssignment:
        existing = await self.project_assignments_qs.find(
            session,
            project_id=project.id,
            principal_kind=payload.principal_kind,
            principal_id=payload.principal_id,
        )
        if existing is not None:
            return existing

        await self._require_principal_in_graph(
            session,
            graph_id=project.graph_id,
            kind=payload.principal_kind,
            principal_id=payload.principal_id,
        )
        row = ProjectAssignment(
            project_id=project.id,
            principal_kind=payload.principal_kind,
            principal_id=payload.principal_id,
            assigned_by_kind="user",
            assigned_by_id=actor.id,
        )
        await self.project_assignments_qs.add(session, row)
        await emit_event(
            session,
            action=actions.PROJECT_STAFF,
            target_kind=actions.TARGET_PROJECT,
            target_id=project.id,
            graph_id=project.graph_id,
            project_id=project.id,
            actor_id=actor.id,
            details={"principal_kind": payload.principal_kind, "principal_id": payload.principal_id},
            trace_id=current_trace_id(),
        )
        return row

    async def unstaff(self, session: AsyncSession, *, project: Project, assignment_id: str, actor: User) -> None:
        row = await self.project_assignments_qs.get(session, assignment_id)
        if row is None or row.project_id != project.id:
            raise NotFoundError("Assignment not found.")
        details = {"principal_kind": row.principal_kind, "principal_id": row.principal_id}
        await self.project_assignments_qs.delete(session, row)
        await emit_event(
            session,
            action=actions.PROJECT_UNSTAFF,
            target_kind=actions.TARGET_PROJECT,
            target_id=project.id,
            graph_id=project.graph_id,
            project_id=project.id,
            actor_id=actor.id,
            details=details,
            trace_id=current_trace_id(),
        )

    async def _require_principal_in_graph(
        self, session: AsyncSession, *, graph_id: str, kind: str, principal_id: str
    ) -> None:
        if kind == "agent":
            agent = await session.get(Agent, principal_id)
            if agent is None or agent.graph_id != graph_id:
                raise NotFoundError("Agent not found in this graph.")
            return
        member = await self.members_qs.get(session, graph_id=graph_id, user_id=principal_id)
        if member is None:
            raise NotFoundError("That person is not a member of this graph.")
