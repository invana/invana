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
# Properties
# ---------------------------------------------------------------------------


class PropertyCreate(BaseModel):
    name: str
    type: str = "string"
    value_cardinality: Literal["SINGLE", "LIST", "SET"] = "SINGLE"
    required: bool = False
    unique: bool = False
    default_value: str | None = None
    sort_order: int = 0
    validation_rules: list[ValidationRuleSchema] = []


class PropertyResponse(BaseModel):
    id: str
    name: str
    type: str
    value_cardinality: str
    required: bool
    unique: bool
    default_value: str | None
    sort_order: int
    validation_rules: list[ValidationRuleResponse] = []
    inherited: bool = False

    model_config = {"from_attributes": True}


class PropertyUpdate(BaseModel):
    name: str | None = None
    type: str | None = None
    value_cardinality: Literal["SINGLE", "LIST", "SET"] | None = None
    required: bool | None = None
    unique: bool | None = None
    default_value: str | None = None
    sort_order: int | None = None
    validation_rules: list[ValidationRuleSchema] | None = None


# ---------------------------------------------------------------------------
# Node Types
# ---------------------------------------------------------------------------


class NodeTypeCreate(BaseModel):
    name: str
    description: str = ""
    parent_type: str | None = None
    is_abstract: bool = False
    validation_mode: Literal["strict", "permissive"] | None = None
    color: str | None = None
    icon: str | None = None
    properties: list[PropertyCreate] = []


class NodeTypeResponse(BaseModel):
    id: str
    name: str
    description: str
    parent_type: str | None
    is_abstract: bool
    validation_mode: str | None
    color: str | None
    icon: str | None
    properties: list[PropertyResponse] = []
    effective_properties: list[PropertyResponse] = []
    hierarchy: list[str] = Field(default_factory=list, description="Parent chain from root to self")

    model_config = {"from_attributes": True}


class NodeTypeUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    parent_type: str | None = None
    is_abstract: bool | None = None
    validation_mode: Literal["strict", "permissive"] | None = None
    color: str | None = None
    icon: str | None = None


# ---------------------------------------------------------------------------
# Edge Types
# ---------------------------------------------------------------------------


class EdgeTypeCreate(BaseModel):
    name: str
    description: str = ""
    source_node_types: list[str] = []
    target_node_types: list[str] = []
    multiplicity: Literal["MULTI", "SIMPLE", "ONE2MANY", "MANY2ONE", "ONE2ONE"] = "MULTI"
    allowed_properties: list[str] | None = None
    properties: list[PropertyCreate] = []


class EdgeTypeResponse(BaseModel):
    id: str
    name: str
    description: str
    source_node_types: list[str]
    target_node_types: list[str]
    multiplicity: str
    allowed_properties: list[str] | None
    properties: list[PropertyResponse] = []

    model_config = {"from_attributes": True}


class EdgeTypeUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    source_node_types: list[str] | None = None
    target_node_types: list[str] | None = None
    multiplicity: Literal["MULTI", "SIMPLE", "ONE2MANY", "MANY2ONE", "ONE2ONE"] | None = None
    allowed_properties: list[str] | None = None


# ---------------------------------------------------------------------------
# Indexes
# ---------------------------------------------------------------------------


class IndexCreate(BaseModel):
    name: str
    target_kind: Literal["node_type", "edge_type"]
    target_label: str
    properties: list[str]
    index_type: Literal["range", "composite", "fulltext", "text", "point", "lookup"] = "range"
    is_unique: bool = False
    index_options: dict[str, Any] | None = None


class IndexResponse(BaseModel):
    id: str
    name: str
    target_kind: str
    target_label: str
    properties: list[str]
    index_type: str
    is_unique: bool
    index_options: dict[str, Any] | None

    model_config = {"from_attributes": True}


class IndexUpdate(BaseModel):
    name: str | None = None
    properties: list[str] | None = None
    index_type: Literal["range", "composite", "fulltext", "text", "point", "lookup"] | None = None
    is_unique: bool | None = None
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
    schema_id: str
    version: str | None
    status: str
    change_summary: str
    created_at: datetime
    activated_at: datetime | None
    node_types: list[NodeTypeResponse] = []
    edge_types: list[EdgeTypeResponse] = []
    indexes: list[IndexResponse] = []

    model_config = {"from_attributes": True}


class VersionSummary(BaseModel):
    id: str
    schema_id: str
    version: str | None
    status: str
    change_summary: str
    created_at: datetime
    activated_at: datetime | None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Graph Schema
# ---------------------------------------------------------------------------


class SchemaCreate(BaseModel):
    name: str
    description: str = ""
    validation_mode: Literal["strict", "permissive"] = "strict"


class SchemaResponse(BaseModel):
    id: str
    name: str
    description: str
    validation_mode: str
    created_at: datetime
    updated_at: datetime
    active_version: VersionSummary | None = None
    versions: list[VersionSummary] = []

    model_config = {"from_attributes": True}


class SchemaUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    validation_mode: Literal["strict", "permissive"] | None = None


# ---------------------------------------------------------------------------
# Diffing
# ---------------------------------------------------------------------------


class PropertyDiff(BaseModel):
    name: str
    changes: dict[str, tuple[Any, Any]] = {}


class NodeTypeDiff(BaseModel):
    name: str
    added_properties: list[str] = []
    removed_properties: list[str] = []
    modified_properties: list[PropertyDiff] = []
    metadata_changes: dict[str, tuple[Any, Any]] = {}


class EdgeTypeDiff(BaseModel):
    name: str
    added_properties: list[str] = []
    removed_properties: list[str] = []
    modified_properties: list[PropertyDiff] = []
    metadata_changes: dict[str, tuple[Any, Any]] = {}


class SchemaDiff(BaseModel):
    added_node_types: list[str] = []
    removed_node_types: list[str] = []
    modified_node_types: list[NodeTypeDiff] = []
    added_edge_types: list[str] = []
    removed_edge_types: list[str] = []
    modified_edge_types: list[EdgeTypeDiff] = []
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
    schema_id: str | None = None
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
    node_types: list[NodeTypeCreate] = []
    edge_types: list[EdgeTypeCreate] = []
    indexes: list[IndexCreate] = []
