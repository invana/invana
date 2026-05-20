"""starlette-admin model views for the graph modeller."""

from __future__ import annotations

from fastapi import FastAPI
from starlette.requests import Request
from starlette_admin import StringField
from starlette_admin.contrib.sqla import Admin, ModelView

from invana.auth.models import (
    Invitation,
    RefreshToken,
    User,
    Workspace,
    WorkspaceMember,
)
from invana.graphs.models import Graph
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
        "first_name",
        "last_name",
        "is_superuser",
        "is_active",
        "created_at",
        "updated_at",
    ]
    search_fields = ["email", "first_name", "last_name"]
    sortable_fields = ["email", "created_at", "updated_at"]

    # Users come from `invana init` (root) or workspace invitations — not admin UI.
    def can_create(self, request: Request) -> bool:
        return False


class WorkspaceView(ModelView):
    label = "Workspaces"
    icon = "fa fa-folder"
    fields = [
        "id",
        "name",
        "slug",
        "created_by_id",
        "created_at",
        "updated_at",
    ]
    search_fields = ["name", "slug"]
    sortable_fields = ["name", "slug", "created_at"]


class WorkspaceMemberView(ModelView):
    label = "Workspace members"
    icon = "fa fa-users"
    fields = [
        "workspace_id",
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
        "workspace_id",
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


class GraphView(ModelView):
    fields = [
        "id",
        "name",
        "description",
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
    search_fields = ["name", "uri"]


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
    # Auth (Layer 1)
    admin.add_view(UserView(User, label="Users", icon="fa fa-user"))
    admin.add_view(WorkspaceView(Workspace, label="Workspaces", icon="fa fa-folder"))
    admin.add_view(WorkspaceMemberView(WorkspaceMember, label="Workspace members", icon="fa fa-users"))
    admin.add_view(InvitationView(Invitation, label="Invitations", icon="fa fa-envelope"))
    admin.add_view(RefreshTokenView(RefreshToken, label="Refresh tokens", icon="fa fa-key"))

    # Graphs + modeller (existing)
    admin.add_view(GraphView(Graph))
    admin.add_view(GraphSchemaView(GraphSchema))
    admin.add_view(SchemaVersionView(SchemaVersion))
    admin.add_view(NodeTypeDefinitionView(NodeTypeDefinition))
    admin.add_view(EdgeTypeDefinitionView(EdgeTypeDefinition))
    admin.add_view(PropertyKeyDefinitionView(PropertyKeyDefinition))
    admin.add_view(TypePropertyMappingView(TypePropertyMapping))
    admin.add_view(ConstraintDefinitionView(ConstraintDefinition))
    admin.add_view(ValidationRuleView(ValidationRule))
    admin.add_view(IndexDefinitionView(IndexDefinition))
    admin.add_view(SchemaProjectionView(SchemaProjection))
    admin.mount_to(app)
