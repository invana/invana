"""starlette-admin model views for the graph modeller."""

from __future__ import annotations

from fastapi import FastAPI
from starlette_admin import StringField
from starlette_admin.contrib.sqla import Admin, ModelView

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
