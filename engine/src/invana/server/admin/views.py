"""starlette-admin model views for the graph modeller."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from starlette_admin import DropDown
from starlette_admin.contrib.sqla import Admin

from invana.apps.agents.models import Agent
from invana.apps.boards.models import Board, BoardVersion
from invana.apps.govern.models import Lens, RunTouch
from invana.apps.graphs.models import Graph, GraphConnection, GraphMember
from invana.apps.llm_providers.models import LLMModel, LLMProvider
from invana.apps.modeller.models import (
    ConstraintDefinition,
    EdgeTypeDefinition,
    GraphModel,
    GraphVersion,
    IndexDefinition,
    ModelLink,
    NodeTypeDefinition,
    PropertyKeyDefinition,
    SchemaProjection,
    TypePropertyMapping,
    ValidationRule,
)
from invana.apps.sessions.models import Session, SessionMessage
from invana.apps.skills.models import (
    Rule,
    RuleVersion,
    Skill,
    SkillBinding,
    SkillVersion,
    SkillVersionClarification,
)
from invana.apps.task_plans.models import Task as PlanTask
from invana.apps.task_plans.models import TaskPlan
from invana.apps.work.models import Project, ProjectAssignment, Task, TaskDependency
from invana.core.auth.models import PersonalAccessToken, RefreshToken, User
from invana.core.events.models import Event
from invana.runtime.models import (
    Emission,
    ProjectionTemplate,
    TaskPrompt,
    TaskRun,
    TaskStream,
)
from invana.server.admin.auth import SuperuserAuthProvider
from invana.server.agents.admin import AgentView
from invana.server.auth.admin import (
    PersonalAccessTokenView,
    RefreshTokenView,
    UserView,
)
from invana.server.boards.admin import BoardVersionView, BoardView
from invana.server.events.admin import EventView
from invana.server.govern.admin import LensView, RunTouchView
from invana.server.graphs.admin import (
    GraphConnectionView,
    GraphContainerView,
    GraphMemberView,
)
from invana.server.llm_providers.admin import LLMModelView, LLMProviderView
from invana.server.modeller.admin import (
    ConstraintDefinitionView,
    EdgeTypeDefinitionView,
    GraphModelView,
    GraphVersionView,
    IndexDefinitionView,
    ModelLinkView,
    NodeTypeDefinitionView,
    PropertyKeyDefinitionView,
    SchemaProjectionView,
    TypePropertyMappingView,
    ValidationRuleView,
)
from invana.server.rules.admin import RuleVersionView, RuleView
from invana.server.runtime.admin import (
    EmissionView,
    ProjectionTemplateView,
    RunNodeView,
    TaskPromptView,
    TaskRunView,
    TaskStreamView,
)
from invana.server.sessions.admin import (
    SessionMessageView,
    SessionView,
)
from invana.server.skills.admin import (
    SkillBindingView,
    SkillClarificationView,
    SkillVersionView,
    SkillView,
)
from invana.server.task_plans.admin import PlanTaskView, TaskPlanView
from invana.server.work.admin import (
    ProjectAssignmentView,
    ProjectView,
    TaskDependencyView,
    TaskView,
)

# Custom templates (currently: base.html with theme switcher) live alongside
# this module. starlette-admin's Jinja loader checks templates_dir first and
# falls through to the package defaults for anything we don't override.
_TEMPLATES_DIR = str(Path(__file__).parent / "templates")


# ---------------------------------------------------------------------------
# Auth views (Layer 1)
#
# Sensitive columns (`password_hash`, `token_hash`) are deliberately omitted
# from `fields` so they aren't displayed or editable. User creation goes through
# the CLI (`invana init`) or the superuser-gated register API, not the admin UI.
# ---------------------------------------------------------------------------


# ── TaskRuns (docs/for-developers/modules/ask/spec.md ·
# docs/for-developers/modules/ask/features/streaming-and-the-workflow.md) — the run behind a session reply ────────────


def mount_admin(app: FastAPI) -> None:
    """Create and mount the starlette-admin instance on *app*.

    Gated by ``SuperuserAuthProvider`` — only users with ``is_superuser=True``
    can sign in. Session cookies via ``SessionMiddleware`` (added in
    ``server/app.py``).
    """
    admin = Admin(
        app.state.sync_engine,
        title="Invana Admin",
        base_url="/admin",
        templates_dir=_TEMPLATES_DIR,
        auth_provider=SuperuserAuthProvider(parent_app=app),
    )
    # ── Identity (Layer 1) ───────────────────────────────────────────────────
    admin.add_view(
        DropDown(
            label="Identity",
            icon="fa fa-id-badge",
            views=[
                UserView(User, label="Users", icon="fa fa-user"),
                RefreshTokenView(RefreshToken, label="Refresh tokens", icon="fa fa-key"),
                PersonalAccessTokenView(PersonalAccessToken, label="Personal access tokens", icon="fa fa-key"),
            ],
        ),
    )

    # ── Graph container + membership (Layer 2 — docs/for-developers/modules/identity-and-access/spec.md)
    # ─────────────────────
    admin.add_view(
        DropDown(
            label="Graphs",
            icon="fa fa-project-diagram",
            views=[
                GraphContainerView(Graph, label="Graphs", icon="fa fa-circle-nodes"),
                GraphConnectionView(GraphConnection, label="Graph connections", icon="fa fa-plug"),
                GraphMemberView(GraphMember, label="Graph members", icon="fa fa-users"),
            ],
        ),
    )

    # ── Graph-scoped bindings (LLM / Skills) ─────────────────────────────────
    admin.add_view(
        DropDown(
            label="Agent bindings",
            icon="fa fa-robot",
            views=[
                LLMProviderView(LLMProvider, label="LLM providers", icon="fa fa-sparkles"),
                LLMModelView(LLMModel, label="LLM models", icon="fa fa-cube"),
                SkillView(Skill, label="Skills", icon="fa fa-wand-magic-sparkles"),
                SkillVersionView(SkillVersion, label="Skill versions", icon="fa fa-clock-rotate-left"),
                SkillClarificationView(
                    SkillVersionClarification, label="Skill clarifications", icon="fa fa-circle-question"
                ),
                SkillBindingView(SkillBinding, label="Skill bindings", icon="fa fa-link"),
                RuleView(Rule, label="Rules", icon="fa fa-scale-balanced"),
                RuleVersionView(RuleVersion, label="Rule versions", icon="fa fa-clock-rotate-left"),
            ],
        ),
    )

    # ── Govern (docs/for-developers/modules/govern/spec.md — the lens, and what a run touched)
    # ─────────────────────
    admin.add_view(
        DropDown(
            label="Govern",
            icon="fa fa-filter",
            views=[
                LensView(Lens, label="Lenses", icon="fa fa-filter"),
                RunTouchView(RunTouch, label="Run touches", icon="fa fa-fingerprint"),
            ],
        ),
    )

    # ── Audit (docs/for-developers/modules/operate/features/audit-and-activity.md — domain event log)
    # ───────────────────────────────────
    admin.add_view(
        DropDown(
            label="Audit",
            icon="fa fa-clock-rotate-left",
            views=[
                EventView(Event, label="Events", icon="fa fa-clock-rotate-left"),
            ],
        ),
    )

    # ── Modeller (schema + versions + type / property / constraint defs) ─────
    admin.add_view(
        DropDown(
            label="Modeller",
            icon="fa fa-diagram-project",
            views=[
                GraphModelView(GraphModel, label="Graph models"),
                GraphVersionView(GraphVersion, label="Schema versions"),
                NodeTypeDefinitionView(NodeTypeDefinition, label="Node types"),
                EdgeTypeDefinitionView(EdgeTypeDefinition, label="Edge types"),
                PropertyKeyDefinitionView(PropertyKeyDefinition, label="Property keys"),
                TypePropertyMappingView(TypePropertyMapping, label="Type-property mappings"),
                ConstraintDefinitionView(ConstraintDefinition, label="Constraints"),
                ValidationRuleView(ValidationRule, label="Validation rules"),
                IndexDefinitionView(IndexDefinition, label="Indexes"),
                SchemaProjectionView(SchemaProjection, label="Projections"),
                ModelLinkView(ModelLink, label="Model links"),
            ],
        ),
    )

    # ── Query sessions (docs/for-developers/modules/ask/spec.md) ─────────────────────────────────────────────
    admin.add_view(
        DropDown(
            label="Sessions",
            icon="fa fa-comments",
            views=[
                SessionView(Session, label="Sessions", icon="fa fa-comments"),
                SessionMessageView(SessionMessage, label="Messages", icon="fa fa-message"),
            ],
        ),
    )

    # ── TaskRuns (docs/for-developers/modules/ask/spec.md ·
    # docs/for-developers/modules/ask/features/streaming-and-the-workflow.md — the run behind every reply) ───────────
    admin.add_view(
        DropDown(
            label="Runs",
            icon="fa fa-brain",
            views=[
                TaskRunView(TaskRun, label="Runs", icon="fa fa-brain"),
                RunNodeView(TaskRun, label="Run nodes", icon="fa fa-list-check"),
                TaskStreamView(TaskStream, label="Run stream", icon="fa fa-stream"),
                EmissionView(Emission, label="Emissions", icon="fa fa-square-poll-vertical"),
                ProjectionTemplateView(ProjectionTemplate, label="Projection templates", icon="fa fa-table-cells"),
                TaskPromptView(TaskPrompt, label="Run prompts", icon="fa fa-circle-check"),
            ],
        ),
    )

    # ── Agents at work (docs/for-developers/modules/work/spec.md) ─────────────────────────────────────────────
    admin.add_view(
        DropDown(
            label="Agents at work",
            icon="fa fa-robot",
            views=[
                AgentView(Agent, label="Agents", icon="fa fa-robot"),
                TaskPlanView(TaskPlan, label="Plan library", icon="fa fa-diagram-next"),
                PlanTaskView(PlanTask, label="Plan tasks", icon="fa fa-diagram-project"),
                ProjectView(Project, label="Projects", icon="fa fa-folder-open"),
                ProjectAssignmentView(ProjectAssignment, label="Project staffing", icon="fa fa-user-plus"),
                TaskView(Task, label="Tasks", icon="fa fa-list-check"),
                TaskDependencyView(TaskDependency, label="Task dependencies", icon="fa fa-arrow-right-long"),
            ],
        ),
    )

    # ── Boards (docs/for-developers/building-engine/boards-migration.md)
    # ──────────────────────────────────────────
    admin.add_view(
        DropDown(
            label="Boards",
            icon="fa fa-diagram-project",
            views=[
                BoardView(Board, label="Boards", icon="fa fa-diagram-project"),
                BoardVersionView(BoardVersion, label="Board versions", icon="fa fa-clock-rotate-left"),
            ],
        ),
    )
    admin.mount_to(app)
