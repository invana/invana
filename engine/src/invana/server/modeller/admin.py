"""starlette-admin views for the modeller (migration-plan §4.1).

Beside the code they describe, rather than in one 39-class file.
"""

from __future__ import annotations

from starlette_admin import StringField
from starlette_admin.contrib.sqla import ModelView


class GraphModelView(ModelView):
    fields = [
        "id",
        "graph_id",
        "name",
        "description",
        StringField("validation_mode", label="Validation Mode"),
        StringField("status", label="Status"),
        "yaml_path",
        "created_at",
        "updated_at",
    ]
    search_fields = ["name"]


class GraphVersionView(ModelView):
    fields = [
        "id",
        "model_id",
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


class ModelLinkView(ModelView):
    """Declared anchors and relationship links
    (docs/for-developers/modules/connect-and-model/features/stitch-models.md)."""

    fields = [
        "id",
        "graph_id",
        StringField("kind", label="Kind"),
        "source_version_id",
        "source_type",
        "target_version_id",
        "target_type",
        "source_property",
        "target_property",
        StringField("identity_match", label="Identity Match"),
        "edge_type",
        "source_model_id",
        "description",
        "created_at",
    ]
    search_fields = ["source_type", "target_type", "edge_type"]


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
