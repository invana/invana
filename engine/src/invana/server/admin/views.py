"""starlette-admin model views for the graph modeller."""

from __future__ import annotations

from fastapi import FastAPI
from starlette.requests import Request
from starlette_admin import DropDown, StringField
from starlette_admin.contrib.sqla import Admin, ModelView

from invana.auth.models import RefreshToken, User
from invana.events.models import Event
from invana.graphs.models import Graph, GraphConnection, GraphMember, Invitation
from invana.instructions.models import Instruction
from invana.llm_providers.models import LLMProvider
from invana.modeller.models import (
    ConstraintDefinition,
    EdgeTypeDefinition,
    GraphSchema,
    IndexDefinition,
    NodeTypeDefinition,
    PropertyKeyDefinition,
    SchemaProjection,
    SchemaVersion,
    TypePropertyMapping,
    ValidationRule,
)
from invana.skills.models import Skill


class GraphSchemaView(ModelView):
    fields = [
        "id",
        "name",
        "description",
        StringField("validation_mode", label="Validation Mode"),
        "created_at",
        "updated_at",
    ]
    search_fields = ["name"]


class SchemaVersionView(ModelView):
    fields = [
        "id",
        "schema_id",
        "version",
        StringField("status", label="Status"),
        "change_summary",
        "created_at",
        "activated_at",
    ]
    search_fields = ["version"]


class NodeTypeDefinitionView(ModelView):
    fields = ["id", "version_id", "name", "description", "parent_type", "is_abstract"]
    search_fields = ["name"]


class EdgeTypeDefinitionView(ModelView):
    fields = [
        "id",
        "version_id",
        "name",
        "description",
        "source_node_types",
        "target_node_types",
        StringField("multiplicity", label="Multiplicity"),
    ]
    search_fields = ["name"]


class PropertyKeyDefinitionView(ModelView):
    fields = [
        "id",
        "version_id",
        "name",
        "type",
        StringField("value_cardinality", label="Value Cardinality"),
        "description",
    ]
    search_fields = ["name"]


class TypePropertyMappingView(ModelView):
    fields = [
        "id",
        "property_key_id",
        "node_type_id",
        "edge_type_id",
        "default_value",
        "sort_order",
    ]


class ConstraintDefinitionView(ModelView):
    fields = [
        "id",
        "version_id",
        "name",
        StringField("target_kind", label="Target Kind"),
        "target_label",
        StringField("constraint_type", label="Constraint Type"),
        "properties",
    ]
    search_fields = ["name"]


class ValidationRuleView(ModelView):
    fields = [
        "id",
        "property_key_id",
        "type_property_mapping_id",
        StringField("rule_type", label="Rule Type"),
        "params",
    ]


class IndexDefinitionView(ModelView):
    fields = [
        "id",
        "version_id",
        "name",
        StringField("target_kind", label="Target Kind"),
        "target_label",
        "properties",
        StringField("index_type", label="Index Type"),
        "index_options",
    ]
    search_fields = ["name"]


class SchemaProjectionView(ModelView):
    fields = [
        "id",
        "version_id",
        "connector_id",
        StringField("status", label="Status"),
        "operations",
        "errors",
        "projected_at",
    ]


# ---------------------------------------------------------------------------
# Auth views (Layer 1)
#
# Sensitive columns (`password_hash`, `token_hash`) are deliberately omitted
# from `fields` so they aren't displayed or editable. User/invite creation
# goes through the CLI / invitations API, not the admin UI.
# ---------------------------------------------------------------------------


class UserView(ModelView):
    label = "Users"
    icon = "fa fa-user"
    fields = [
        "id",
        "email",
        "username",
        "first_name",
        "last_name",
        "is_superuser",
        "is_active",
        "username_last_changed_at",
        "created_at",
        "updated_at",
    ]
    search_fields = ["email", "username", "first_name", "last_name"]
    sortable_fields = ["email", "username", "created_at", "updated_at"]

    # Users come from `invana init` (root) or graph invitations — not admin UI.
    def can_create(self, request: Request) -> bool:
        return False


class GraphContainerView(ModelView):
    label = "Graphs"
    icon = "fa fa-project-diagram"
    fields = [
        "id",
        "slug",
        "name",
        "description",
        "intent",
        StringField("status", label="Status"),
        "connection",
        "created_by_id",
        "created_at",
        "updated_at",
    ]
    search_fields = ["name", "slug"]
    sortable_fields = ["name", "slug", "created_at"]


class GraphMemberView(ModelView):
    label = "Graph members"
    icon = "fa fa-users"
    fields = [
        "graph_id",
        "user_id",
        StringField("role", label="Role"),
        "created_at",
    ]
    sortable_fields = ["created_at"]


class InvitationView(ModelView):
    label = "Invitations"
    icon = "fa fa-envelope"
    fields = [
        "id",
        "email",
        "graph_id",
        StringField("role", label="Role"),
        "invited_by_id",
        "expires_at",
        "accepted_at",
        "created_at",
    ]
    search_fields = ["email"]
    sortable_fields = ["created_at", "expires_at", "accepted_at"]

    # Invitations are issued through the API (token shown once); admin UI is
    # read + revoke only.
    def can_create(self, request: Request) -> bool:
        return False

    def can_edit(self, request: Request) -> bool:
        return False


class RefreshTokenView(ModelView):
    label = "Refresh tokens"
    icon = "fa fa-key"
    fields = [
        "id",
        "user_id",
        "expires_at",
        "revoked_at",
        "created_at",
    ]
    sortable_fields = ["created_at", "expires_at", "revoked_at"]

    # Refresh tokens are session state — view + revoke (delete) only.
    def can_create(self, request: Request) -> bool:
        return False

    def can_edit(self, request: Request) -> bool:
        return False


class GraphConnectionView(ModelView):
    label = "Graph connections"
    icon = "fa fa-plug"
    fields = [
        "id",
        "graph_id",
        "uri",
        "connector_class",
        "read_only",
        StringField("status", label="Status"),
        "schema_id",
        "last_health_check_at",
        "latency_ms",
        "created_at",
        "updated_at",
    ]
    search_fields = ["uri"]


class LLMProviderView(ModelView):
    label = "LLM providers"
    icon = "fa fa-sparkles"
    # ``api_key_encrypted`` deliberately excluded from `fields` — ciphertext
    # isn't useful in admin and we don't want it edited by hand.
    fields = [
        "id",
        "graph_id",
        StringField("provider", label="Provider"),
        "model_id",
        "base_url",
        "guardrails",
        "is_default",
        "created_at",
        "updated_at",
    ]
    search_fields = ["model_id", "base_url"]


class SkillView(ModelView):
    label = "Skills"
    icon = "fa fa-wand-magic-sparkles"
    fields = [
        "id",
        "graph_id",
        "name",
        "description",
        "content",
        "when_to_use",
        "created_at",
        "updated_at",
    ]
    search_fields = ["name", "description"]


class InstructionView(ModelView):
    label = "Instructions"
    icon = "fa fa-scroll"
    fields = [
        "id",
        "graph_id",
        "name",
        "content",
        "priority",
        "created_at",
        "updated_at",
    ]
    search_fields = ["name"]


class EventView(ModelView):
    """Audit events (RFC-018). Read + delete only — admin shouldn't be able
    to author new events or rewrite the audit trail in-place."""

    label = "Events"
    icon = "fa fa-clock-rotate-left"
    fields = [
        "id",
        "created_at",
        "graph_id",
        "actor_id",
        StringField("actor_type", label="Actor"),
        "action",
        "target_kind",
        "target_id",
        "details",
        "trace_id",
    ]
    search_fields = ["action", "target_id", "target_kind"]
    sortable_fields = ["created_at", "action"]

    def can_create(self, request: Request) -> bool:
        return False

    def can_edit(self, request: Request) -> bool:
        return False


def mount_admin(app: FastAPI) -> None:
    """Create and mount the starlette-admin instance on *app*.

    Gated by ``SuperuserAuthProvider`` — only users with ``is_superuser=True``
    can sign in. Session cookies via ``SessionMiddleware`` (added in
    ``server/app.py``).
    """
    from invana.server.admin.auth import SuperuserAuthProvider

    admin = Admin(
        app.state.sync_engine,
        title="Invana Admin",
        base_url="/admin",
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
            ],
        ),
    )

    # ── Graph container + membership (Layer 2 — RFC-017) ─────────────────────
    admin.add_view(
        DropDown(
            label="Graphs",
            icon="fa fa-project-diagram",
            views=[
                GraphContainerView(Graph, label="Graphs", icon="fa fa-circle-nodes"),
                GraphConnectionView(GraphConnection, label="Graph connections", icon="fa fa-plug"),
                GraphMemberView(GraphMember, label="Graph members", icon="fa fa-users"),
                InvitationView(Invitation, label="Invitations", icon="fa fa-envelope"),
            ],
        ),
    )

    # ── Graph-scoped bindings (LLM / Skills / Instructions) ──────────────────
    admin.add_view(
        DropDown(
            label="Agent bindings",
            icon="fa fa-robot",
            views=[
                LLMProviderView(LLMProvider, label="LLM providers", icon="fa fa-sparkles"),
                SkillView(Skill, label="Skills", icon="fa fa-wand-magic-sparkles"),
                InstructionView(Instruction, label="Instructions", icon="fa fa-scroll"),
            ],
        ),
    )

    # ── Audit (RFC-018 — domain event log) ───────────────────────────────────
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
                GraphSchemaView(GraphSchema, label="Schemas"),
                SchemaVersionView(SchemaVersion, label="Schema versions"),
                NodeTypeDefinitionView(NodeTypeDefinition, label="Node types"),
                EdgeTypeDefinitionView(EdgeTypeDefinition, label="Edge types"),
                PropertyKeyDefinitionView(PropertyKeyDefinition, label="Property keys"),
                TypePropertyMappingView(TypePropertyMapping, label="Type-property mappings"),
                ConstraintDefinitionView(ConstraintDefinition, label="Constraints"),
                ValidationRuleView(ValidationRule, label="Validation rules"),
                IndexDefinitionView(IndexDefinition, label="Indexes"),
                SchemaProjectionView(SchemaProjection, label="Projections"),
            ],
        ),
    )
    admin.mount_to(app)
