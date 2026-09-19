"""starlette-admin views for Work (migration-plan §4.1)."""

from __future__ import annotations

from starlette_admin.contrib.sqla import ModelView


class TaskView(ModelView):
    label = "Tasks"
    icon = "fa fa-list-check"
    fields = [
        "id",
        "graph_id",
        "project_id",
        "parent_id",
        "title",
        "body",
        "acceptance",
        "status",
        "assignee_kind",
        "assignee_id",
        "created_by_kind",
        "created_by_id",
        "result",
        "blocked_reason",
        "due_at",
        "closed_at",
        "created_at",
        "updated_at",
    ]
    search_fields = ["title", "body"]


class TaskDependencyView(ModelView):
    label = "Task dependencies"
    icon = "fa fa-arrow-right-long"
    fields = ["id", "task_id", "depends_on_id", "kind", "binds", "created_at"]


class ProjectView(ModelView):
    label = "Projects"
    icon = "fa fa-folder-open"
    fields = [
        "id",
        "graph_id",
        "key",
        "name",
        "description",
        "status",
        "created_by_kind",
        "created_by_id",
        "created_at",
        "updated_at",
    ]
    search_fields = ["key", "name"]


class ProjectAssignmentView(ModelView):
    label = "Project staffing"
    icon = "fa fa-user-plus"
    fields = ["id", "project_id", "principal_kind", "principal_id", "assigned_by_id", "assigned_at"]
