"""starlette-admin model views for the graph modeller."""

from __future__ import annotations

from fastapi import FastAPI
from starlette_admin import StringField
from starlette_admin.contrib.sqla import Admin, ModelView

from invana.modeller.models import (
    EdgeTypeDefinition,
    GraphSchema,
    IndexDefinition,
    NodeTypeDefinition,
    PropertyDefinition,
    SchemaProjection,
    SchemaVersion,
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
    fields = ["id", "version_id", "name", "description", "parent_type", "is_abstract", "color", "icon"]
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


class PropertyDefinitionView(ModelView):
    fields = [
        "id",
        "node_type_id",
        "edge_type_id",
        "name",
        "type",
        StringField("value_cardinality", label="Value Cardinality"),
        "required",
        "unique",
    ]
    search_fields = ["name"]


class ValidationRuleView(ModelView):
    fields = [
        "id",
        "property_id",
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
        "is_unique",
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


def mount_admin(app: FastAPI) -> None:
    """Create and mount the starlette-admin instance on *app*."""
    admin = Admin(
        app.state.sync_engine,
        title="Invana Admin",
        base_url="/admin",
    )
    admin.add_view(GraphSchemaView(GraphSchema))
    admin.add_view(SchemaVersionView(SchemaVersion))
    admin.add_view(NodeTypeDefinitionView(NodeTypeDefinition))
    admin.add_view(EdgeTypeDefinitionView(EdgeTypeDefinition))
    admin.add_view(PropertyDefinitionView(PropertyDefinition))
    admin.add_view(ValidationRuleView(ValidationRule))
    admin.add_view(IndexDefinitionView(IndexDefinition))
    admin.add_view(SchemaProjectionView(SchemaProjection))
    admin.mount_to(app)
