"""Project rules — the folder a task is filed in (docs/for-developers/modules/work/spec.md).

Archiving freezes a project's tasks read-only. Running runs still finish:
freezing is about what a person or an agent may *start*, not about killing work
already in flight.
"""

from __future__ import annotations

import re

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.work.models import Project, ProjectStatus
from invana.apps.work.querysets import ProjectQuerySet, TaskQuerySet
from invana.apps.work.schemas import ProjectCreate, ProjectRead, ProjectUpdate
from invana.core.auth.models import User
from invana.core.auth.querysets import UserQuerySet
from invana.core.errors import ConflictError, NotFoundError
from invana.core.events import actions
from invana.core.events.services import current_trace_id, diff_changed_fields, emit_event

_SLUG_STRIP = re.compile(r"[^a-z0-9]+")

_FIELDS = ["name", "description", "status"]


def slugify(name: str) -> str:
    slug = _SLUG_STRIP.sub("-", name.lower()).strip("-")
    return (slug or "project")[:64]


class ProjectManager:
    projects_qs = ProjectQuerySet()
    tasks_qs = TaskQuerySet()
    users_qs = UserQuerySet()

    async def list_for_graph(self, session: AsyncSession, *, graph_id: str) -> list[ProjectRead]:
        projects = await self.projects_qs.list_for_graph(session, graph_id=graph_id)
        counts = await self.tasks_qs.count_by_project(session, graph_id=graph_id)
        open_counts = await self.tasks_qs.count_by_project(session, graph_id=graph_id, open_only=True)
        # One lookup for the whole list. The detail reads its creator off the row
        # it was already given, so opening a project asks nothing extra.
        names = await self._creator_names(session, projects)
        out: list[ProjectRead] = []
        for project in projects:
            read = ProjectRead.model_validate(project)
            read.created_by_name = names.get(project.created_by_id or "")
            read.task_count = counts.get(project.id, 0)
            read.open_task_count = open_counts.get(project.id, 0)
            out.append(read)
        return out

    async def read(self, session: AsyncSession, *, project: Project) -> ProjectRead:
        """One project, with its creator resolved — what create, get and update return."""
        read = ProjectRead.model_validate(project)
        names = await self._creator_names(session, [project])
        read.created_by_name = names.get(project.created_by_id or "")
        return read

    async def _creator_names(self, session: AsyncSession, projects: list[Project]) -> dict[str, str]:
        ids = {p.created_by_id for p in projects if p.created_by_kind == "user" and p.created_by_id}
        return await self.users_qs.usernames_by_ids(session, list(ids))

    async def get_by_key(self, session: AsyncSession, *, key: str, graph_id: str) -> Project:
        project = await self.projects_qs.get_by_key(session, key=key, graph_id=graph_id)
        if project is None:
            raise NotFoundError("Project not found.")
        return project

    def require_writable(self, project: Project | None) -> None:
        """An archived project freezes its tasks read-only."""
        if project is not None and project.status == ProjectStatus.archived.value:
            raise ConflictError(f"Project '{project.key}' is archived; its tasks are read-only.")

    async def create(self, session: AsyncSession, *, graph_id: str, payload: ProjectCreate, actor: User) -> Project:
        project = Project(
            graph_id=graph_id,
            key=payload.key or slugify(payload.name),
            name=payload.name,
            description=payload.description,
            created_by_kind="user",
            created_by_id=actor.id,
        )
        try:
            await self.projects_qs.add(session, project)
        except IntegrityError as exc:
            raise ConflictError(f"A project keyed '{project.key}' already exists in this graph.") from exc
        await emit_event(
            session,
            action=actions.PROJECT_CREATE,
            target_kind=actions.TARGET_PROJECT,
            target_id=project.id,
            graph_id=graph_id,
            project_id=project.id,
            actor_id=actor.id,
            details={"key": project.key, "name": project.name},
            trace_id=current_trace_id(),
        )
        return project

    async def update(self, session: AsyncSession, *, project: Project, payload: ProjectUpdate, actor: User) -> Project:
        before = {f: getattr(project, f) for f in _FIELDS}
        for field in _FIELDS:
            value = getattr(payload, field)
            if value is not None:
                setattr(project, field, value)
        changed = diff_changed_fields(before, {f: getattr(project, f) for f in _FIELDS}, fields=_FIELDS)
        if changed:
            # Freezing a folder of work and reopening it are each their own fact.
            # A bare `project.update` would bury the one somebody comes looking
            # for — "when did this start again, and who said so?"
            status_after = changed.get("status", {}).get("after")
            action = actions.PROJECT_UPDATE
            if status_after == ProjectStatus.archived.value:
                action = actions.PROJECT_ARCHIVE
            elif status_after == ProjectStatus.active.value:
                action = actions.PROJECT_UNARCHIVE
            await emit_event(
                session,
                action=action,
                target_kind=actions.TARGET_PROJECT,
                target_id=project.id,
                graph_id=project.graph_id,
                project_id=project.id,
                actor_id=actor.id,
                details={"key": project.key, "changed": changed},
                trace_id=current_trace_id(),
            )
        return project

    async def delete(self, session: AsyncSession, *, project: Project, actor: User) -> None:
        """Hard delete. Its tasks survive with ``project_id`` NULL — they move to
        the graph's "No project" bucket rather than disappearing with the folder
        someone filed them in.
        """
        key, graph_id, project_id = project.key, project.graph_id, project.id
        await self.projects_qs.delete(session, project)
        await emit_event(
            session,
            action=actions.PROJECT_DELETE,
            target_kind=actions.TARGET_PROJECT,
            target_id=project_id,
            graph_id=graph_id,
            actor_id=actor.id,
            details={"key": key},
            trace_id=current_trace_id(),
        )
