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
        "branch_id",
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
        "type",
        "question",
        "visibility",
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


class ProjectBranchView(ModelView):
    label = "Project branches"
    icon = "fa fa-code-branch"
    fields = ["id", "project_id", "number", "parent_id", "title", "body", "status", "merged_into_id", "created_at"]
    search_fields = ["title"]


class ProjectFindingView(ModelView):
    label = "Project findings"
    icon = "fa fa-magnifying-glass"
    fields = [
        "id",
        "project_id",
        "branch_id",
        "number",
        "statement",
        "stance",
        "cites",
        "added_by_kind",
        "added_by_id",
        "reviewed_by_id",
        "reviewed_at",
        "created_at",
    ]
    search_fields = ["statement"]


class BranchFindingView(ModelView):
    label = "Branch findings"
    icon = "fa fa-link"
    fields = ["id", "branch_id", "finding_id", "via", "created_at"]


class ProjectDecisionView(ModelView):
    label = "Project decisions"
    icon = "fa fa-gavel"
    fields = [
        "id",
        "project_id",
        "branch_id",
        "number",
        "verdict",
        "choice",
        "rationale",
        "cites",
        "addresses",
        "into_branch_id",
        "supersedes_id",
        "checks",
        "warnings",
        "decided_by_id",
        "created_at",
    ]


class ProjectProposalView(ModelView):
    label = "Project proposals"
    icon = "fa fa-lightbulb"
    fields = [
        "id",
        "project_id",
        "branch_id",
        "number",
        "kind",
        "payload",
        "rationale",
        "status",
        "agent_id",
        "submitted_by_id",
        "resolved_by_id",
        "resolved_at",
        "note",
        "result",
        "created_at",
    ]


class ProjectReportView(ModelView):
    label = "Project reports"
    icon = "fa fa-file-lines"
    fields = ["id", "project_id", "draft", "draft_updated_by_id", "draft_updated_at"]


class ProjectReportVersionView(ModelView):
    label = "Report versions"
    icon = "fa fa-file-signature"
    fields = ["id", "report_id", "version", "body", "cites", "published_by_id", "published_at"]
