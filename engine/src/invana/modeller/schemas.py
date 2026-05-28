"""Pydantic request/response schemas for the Graph Modeller API."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Validation Rules
# ---------------------------------------------------------------------------


class ValidationRuleSchema(BaseModel):
    rule_type: Literal["range", "pattern", "enum", "min_length", "max_length", "custom"]
    params: dict[str, Any] = {}


class ValidationRuleResponse(ValidationRuleSchema):
    id: str

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Property Keys (global per version)
# ---------------------------------------------------------------------------


class PropertyKeyCreate(BaseModel):
    name: str
    type: str = "string"
    value_cardinality: Literal["SINGLE", "LIST", "SET"] = "SINGLE"
    description: str = ""
    validation_rules: list[ValidationRuleSchema] = []


class PropertyKeyResponse(BaseModel):
    id: str
    name: str
    type: str
    value_cardinality: str
    description: str
    validation_rules: list[ValidationRuleResponse] = []

    model_config = {"from_attributes": True}


class PropertyKeyUpdate(BaseModel):
    name: str | None = None
    type: str | None = None
    value_cardinality: Literal["SINGLE", "LIST", "SET"] | None = None
    description: str | None = None
    validation_rules: list[ValidationRuleSchema] | None = None


# ---------------------------------------------------------------------------
# Type Property Mappings
# ---------------------------------------------------------------------------


class TypePropertyMappingCreate(BaseModel):
    property_key: str  # name of the global property key
    default_value: str | None = None
    sort_order: int = 0
    validation_rules: list[ValidationRuleSchema] = []


class TypePropertyMappingResponse(BaseModel):
    id: str
    property_key: PropertyKeyResponse
    default_value: str | None
    sort_order: int
    validation_rules: list[ValidationRuleResponse] = []
    inherited: bool = False

    model_config = {"from_attributes": True}


class TypePropertyMappingUpdate(BaseModel):
    default_value: str | None = None
    sort_order: int | None = None
    validation_rules: list[ValidationRuleSchema] | None = None


# ---------------------------------------------------------------------------
# Constraints
# ---------------------------------------------------------------------------


class ConstraintCreate(BaseModel):
    name: str
    target_kind: Literal["node_type", "edge_type"]
    target_label: str
    constraint_type: Literal["unique", "exists", "node_key", "relationship_unique", "relationship_exists"]
    properties: list[str]


class ConstraintResponse(BaseModel):
    id: str
    name: str
    target_kind: str
    target_label: str
    constraint_type: str
    properties: list[str]

    model_config = {"from_attributes": True}


class ConstraintUpdate(BaseModel):
    name: str | None = None
    properties: list[str] | None = None
    constraint_type: Literal["unique", "exists", "node_key", "relationship_unique", "relationship_exists"] | None = None


# ---------------------------------------------------------------------------
# Node Types
# ---------------------------------------------------------------------------


class NodeTypeCreate(BaseModel):
    name: str
    description: str = ""
    parent_type: str | None = None
    is_abstract: bool = False
    validation_mode: Literal["strict", "permissive"] | None = None
    property_mappings: list[TypePropertyMappingCreate] = []


class NodeTypeResponse(BaseModel):
    id: str
    name: str
    description: str
    parent_type: str | None
    is_abstract: bool
    validation_mode: str | None
    property_mappings: list[TypePropertyMappingResponse] = []
    effective_property_mappings: list[TypePropertyMappingResponse] = []
    hierarchy: list[str] = Field(default_factory=list, description="Parent chain from root to self")

    model_config = {"from_attributes": True}


class NodeTypeUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    parent_type: str | None = None
    is_abstract: bool | None = None
    validation_mode: Literal["strict", "permissive"] | None = None
    # When provided, full-replaces the type's property mappings ([] removes all).
    property_mappings: list[TypePropertyMappingCreate] | None = None


# ---------------------------------------------------------------------------
# Edge Types
# ---------------------------------------------------------------------------


class EdgeTypeCreate(BaseModel):
    name: str
    description: str = ""
    source_node_types: list[str] = []
    target_node_types: list[str] = []
    multiplicity: Literal["MULTI", "SIMPLE", "ONE2MANY", "MANY2ONE", "ONE2ONE"] = "MULTI"
    property_mappings: list[TypePropertyMappingCreate] = []


class EdgeTypeResponse(BaseModel):
    id: str
    name: str
    description: str
    source_node_types: list[str]
    target_node_types: list[str]
    multiplicity: str
    property_mappings: list[TypePropertyMappingResponse] = []

    model_config = {"from_attributes": True}


class EdgeTypeUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    source_node_types: list[str] | None = None
    target_node_types: list[str] | None = None
    multiplicity: Literal["MULTI", "SIMPLE", "ONE2MANY", "MANY2ONE", "ONE2ONE"] | None = None
    # When provided, full-replaces the type's property mappings ([] removes all).
    property_mappings: list[TypePropertyMappingCreate] | None = None


# ---------------------------------------------------------------------------
# Indexes
# ---------------------------------------------------------------------------


class IndexCreate(BaseModel):
    name: str
    target_kind: Literal["node_type", "edge_type"]
    target_label: str
    properties: list[str]
    index_type: Literal["range", "composite", "fulltext", "text", "point", "lookup"] = "range"
    index_options: dict[str, Any] | None = None


class IndexResponse(BaseModel):
    id: str
    name: str
    target_kind: str
    target_label: str
    properties: list[str]
    index_type: str
    index_options: dict[str, Any] | None

    model_config = {"from_attributes": True}


class IndexUpdate(BaseModel):
    name: str | None = None
    properties: list[str] | None = None
    index_type: Literal["range", "composite", "fulltext", "text", "point", "lookup"] | None = None
    index_options: dict[str, Any] | None = None


# ---------------------------------------------------------------------------
# Schema Versions
# ---------------------------------------------------------------------------


class VersionCreate(BaseModel):
    based_on: str | None = None


class VersionActivate(BaseModel):
    version: str | None = None


class VersionResponse(BaseModel):
    id: str
    model_id: str
    version: str | None
    status: str
    change_summary: str
    created_at: datetime
    activated_at: datetime | None
    property_keys: list[PropertyKeyResponse] = []
    node_types: list[NodeTypeResponse] = []
    edge_types: list[EdgeTypeResponse] = []
    constraints: list[ConstraintResponse] = []
    indexes: list[IndexResponse] = []

    model_config = {"from_attributes": True}


class VersionSummary(BaseModel):
    id: str
    model_id: str
    version: str | None
    status: str
    change_summary: str
    created_at: datetime
    activated_at: datetime | None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Graph Model (RFC-019)
# ---------------------------------------------------------------------------


class GraphModelCreate(BaseModel):
    name: str
    description: str = ""
    validation_mode: Literal["strict", "permissive"] = "strict"


class GraphModelResponse(BaseModel):
    id: str
    graph_id: str | None
    name: str
    description: str
    validation_mode: str
    status: str
    origin: str
    yaml_path: str | None
    created_at: datetime
    updated_at: datetime
    active_version: VersionSummary | None = None
    versions: list[VersionSummary] = []

    model_config = {"from_attributes": True}


class GraphModelSummary(BaseModel):
    """Lightweight model row for list views (no full version tree)."""

    id: str
    graph_id: str | None
    name: str
    description: str
    status: str
    origin: str
    updated_at: datetime
    active_version: VersionSummary | None = None

    model_config = {"from_attributes": True}


class GraphModelUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    validation_mode: Literal["strict", "permissive"] | None = None
    status: Literal["draft", "active", "archived"] | None = None


# ---------------------------------------------------------------------------
# Diffing
# ---------------------------------------------------------------------------


class PropertyKeyDiff(BaseModel):
    name: str
    changes: dict[str, tuple[Any, Any]] = {}


class NodeTypeDiff(BaseModel):
    name: str
    added_property_mappings: list[str] = []
    removed_property_mappings: list[str] = []
    metadata_changes: dict[str, tuple[Any, Any]] = {}


class EdgeTypeDiff(BaseModel):
    name: str
    added_property_mappings: list[str] = []
    removed_property_mappings: list[str] = []
    metadata_changes: dict[str, tuple[Any, Any]] = {}


class SchemaDiff(BaseModel):
    added_property_keys: list[str] = []
    removed_property_keys: list[str] = []
    modified_property_keys: list[PropertyKeyDiff] = []
    added_node_types: list[str] = []
    removed_node_types: list[str] = []
    modified_node_types: list[NodeTypeDiff] = []
    added_edge_types: list[str] = []
    removed_edge_types: list[str] = []
    modified_edge_types: list[EdgeTypeDiff] = []
    added_constraints: list[str] = []
    removed_constraints: list[str] = []
    added_indexes: list[str] = []
    removed_indexes: list[str] = []
    classification: Literal["major", "minor", "patch"] = "patch"


# ---------------------------------------------------------------------------
# Projection
# ---------------------------------------------------------------------------


class ProjectRequest(BaseModel):
    connector_id: str


class ProjectionResponse(BaseModel):
    id: str
    status: str
    operations: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    projected_at: datetime | None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Introspection
# ---------------------------------------------------------------------------


class IntrospectRequest(BaseModel):
    connector_id: str


class IntrospectResponse(BaseModel):
    version_id: str
    status: str = "draft"
    discovered: dict[str, int] = {}


# ---------------------------------------------------------------------------
# Reconciliation
# ---------------------------------------------------------------------------


class SchemaDrift(BaseModel):
    missing_indexes: list[dict[str, Any]] = []
    extra_indexes: list[dict[str, Any]] = []
    missing_constraints: list[dict[str, Any]] = []
    extra_constraints: list[dict[str, Any]] = []
    unknown_labels: list[str] = []


class ReconcileRequest(BaseModel):
    connector_id: str
    mode: Literal["strict", "auto_project", "auto_introspect", "warn"] = "strict"


class ReconcileResponse(BaseModel):
    connector_id: str
    model_id: str | None = None
    active_version: str | None = None
    status: Literal["in_sync", "projected", "draft_created", "drifted", "error"]
    drift: SchemaDrift | None = None
    new_draft_version_id: str | None = None
    projection: ProjectionResponse | None = None
    message: str = ""


# ---------------------------------------------------------------------------
# Export / Import
# ---------------------------------------------------------------------------


class ExportRequest(BaseModel):
    format: Literal["json"] = "json"


class SchemaExport(BaseModel):
    """Full JSON representation of a schema version for export/import."""

    schema_name: str
    schema_description: str = ""
    validation_mode: str = "strict"
    version: str | None = None
    property_keys: list[PropertyKeyCreate] = []
    node_types: list[NodeTypeCreate] = []
    edge_types: list[EdgeTypeCreate] = []
    constraints: list[ConstraintCreate] = []
    indexes: list[IndexCreate] = []
