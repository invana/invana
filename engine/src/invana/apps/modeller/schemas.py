"""Pydantic request/response schemas for the Graph Modeller API."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field

from invana.core.metrics import Change

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
    #: The IRI it was imported from (ontology-import); provenance, not identity.
    source_iri: str | None = None


class PropertyKeyResponse(BaseModel):
    id: str
    name: str
    type: str
    value_cardinality: str
    description: str
    validation_rules: list[ValidationRuleResponse] = []
    source_iri: str | None = None

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
    #: The IRI it was imported from (ontology-import); provenance, not identity.
    source_iri: str | None = None


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
    source_iri: str | None = None

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
    #: The IRI it was imported from (ontology-import); provenance, not identity.
    source_iri: str | None = None


class EdgeTypeResponse(BaseModel):
    id: str
    name: str
    description: str
    source_node_types: list[str]
    target_node_types: list[str]
    multiplicity: str
    property_mappings: list[TypePropertyMappingResponse] = []
    source_iri: str | None = None

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
# Graph Model (docs/for-developers/modules/connect-and-model/features/domain-models.md)
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


class DeclaredAxes(BaseModel):
    """Which of this version's properties may be narrowed along.

    A published version declares which property carries **valid time**, which
    carries **geography**, and which named properties are selectable
    **dimensions** (docs/for-developers/modules/connect-and-model/features/domain-models.md
    DM6). A [world](../../../docs/for-developers/modules/govern/features/worlds.md)
    may slice along these and nothing else — asking for an axis a model never
    declared is refused naming the model and the axis (GV14).

    Empty is the default and means *nothing is selectable*: the model can still
    be allowed or denied whole, it simply cannot be narrowed. Nothing is
    inferred from a property's name or type, because that would make *which rows
    did this run see* depend on a guess (DM7).
    """

    #: ``{"property": "observed_at"}`` — the property carrying valid time.
    time: dict[str, str] = {}
    #: ``{"property": "country_iso", "vocab": "iso2"}`` — ``vocab`` names the
    #: code system, so a lens saying ``IE`` and a model storing ``IRL`` is a
    #: mismatch somebody can see rather than a slice that silently matches
    #: nothing.
    geo: dict[str, str] = {}
    #: Property names that may be sliced by value — ``["channel", "segment"]``.
    dims: list[str] = []


class SchemaExport(BaseModel):
    """Full JSON representation of a schema version for export/import."""

    schema_name: str
    schema_description: str = ""
    validation_mode: str = "strict"
    version: str | None = None
    #: What a world may slice this version along. Part of the shape, so it is
    #: inside the content hash: two Graphs whose models differ only in what they
    #: let a lens narrow are not running the same model.
    axes: DeclaredAxes = DeclaredAxes()
    property_keys: list[PropertyKeyCreate] = []
    node_types: list[NodeTypeCreate] = []
    edge_types: list[EdgeTypeCreate] = []
    constraints: list[ConstraintCreate] = []
    indexes: list[IndexCreate] = []


# ---------------------------------------------------------------------------
# The physical read — the model page's Database tab (the-model-page.md MP9)
# ---------------------------------------------------------------------------

Drift = Literal["in_both", "model_only", "database_only"]


class PhysicalType(BaseModel):
    """A label or relationship type, and which models declare it (MP17)."""

    name: str
    models: list[str] = []
    #: Live, from ``count-types`` (MP28); ``None`` where the connector cannot count.
    count: int | None = None
    drift: Drift


class PhysicalRule(BaseModel):
    """An index or a constraint, matched by what it covers (MP27)."""

    name: str
    label: str
    properties: list[str]
    type: str
    models: list[str] = []
    drift: Drift


class TypeTally(BaseModel):
    """A section's types: declared by some model, or by none."""

    modelled: int = 0
    unmodelled: int = 0


class PhysicalDrift(BaseModel):
    """How many rows disagree with the models, counted once for every tile and caption."""

    #: Rows not in both, across all four sections.
    total: int = 0
    #: Labels and relationship types not in both.
    types: int = 0
    #: Indexes and constraints not in both.
    rules: int = 0
    #: Labels and relationship types no model declares.
    unmodelled_types: int = 0
    #: Indexes and constraints a model declares and the database lacks.
    model_only_rules: int = 0
    #: Rows not in both per model (or stitch) name, among the rows it declares.
    by_model: dict[str, int] = {}


class PhysicalSchema(BaseModel):
    #: When the mirror was captured; ``None`` — never introspected.
    captured_at: datetime | None
    #: An import counted after the mirror was captured (MP34).
    stale: bool = False
    connector: str | None
    #: Whether the connector lists its indexes and constraints (MP26).
    lists_schema: bool
    #: What the scope's models declare — said even where nothing can be checked.
    declared_indexes: int = 0
    declared_constraints: int = 0
    labels: list[PhysicalType] = []
    relationship_types: list[PhysicalType] = []
    indexes: list[PhysicalRule] = []
    constraints: list[PhysicalRule] = []
    labels_tally: TypeTally = TypeTally()
    relationship_types_tally: TypeTally = TypeTally()
    #: Indexes and constraints the database holds (not ``model_only``).
    indexes_present: int = 0
    constraints_present: int = 0
    #: ``None`` until a mirror was captured.
    drift: PhysicalDrift | None = None


# ---------------------------------------------------------------------------
# Insights — the model page's measured tabs (the-model-page.md MP33)
# ---------------------------------------------------------------------------


class WrittenBy(BaseModel):
    source: Literal["introspect", "import", "stitch_commit"]
    source_id: str | None
    at: datetime


class GrowthSeries(BaseModel):
    key: str
    name: str
    kind: Literal["model", "node", "edge"]
    #: One per day of the window; ``None`` before anything was counted (MP32).
    values: list[int | None]


class GrowthMark(BaseModel):
    #: The day of the window the write fell on.
    index: int
    source: Literal["import", "stitch_commit"]
    source_id: str | None
    at: datetime


class GrowthRow(BaseModel):
    key: str
    name: str
    kind: Literal["model", "node", "edge"]
    start: int | None
    now: int | None
    change: int | None
    #: ``change`` against ``start``; ``None`` from nothing or before any count.
    change_rate: Change | None = None
    #: Counted at the start and the same now, or never counted.
    unchanged: bool = False
    last: WrittenBy | None


class GrowthWrites(BaseModel):
    imports: int = 0
    stitch_commits: int = 0
    total: int = 0


class Growth(BaseModel):
    labels: list[str]
    series: list[GrowthSeries]
    marks: list[GrowthMark]
    rows: list[GrowthRow]
    writes: GrowthWrites
    #: Records at the window's start; ``None`` when nothing was counted before it.
    start: int | None = None
    #: Records now, summed over the rows.
    now: int = 0
    #: ``now - start``; ``None`` when ``start`` is.
    change: int | None = None
    change_rate: Change | None = None
    #: The key of the row that grew the most, from nothing ranking first.
    fastest: str | None = None
    #: How many rows are unchanged.
    unchanged: int = 0
    #: Anything in scope was ever counted — else the never-imported state.
    counted: bool


CallerKind = Literal["agent", "plan", "explorer", "api"]
SignalKind = Literal["unused", "empty", "hot", "hot_and_slow", "supernode", "cold"]


class Signal(BaseModel):
    """A fixed rule that fired, and what it fired on (MP10)."""

    signal: SignalKind
    #: The type (or ``type.property``) it names.
    subject: str
    why: str


class CallerDay(BaseModel):
    label: str
    counts: dict[str, int]


class DayValue(BaseModel):
    label: str
    value: float | None


class OverviewRow(BaseModel):
    key: str
    share: float
    p95: float | None
    signals: list[Signal] = []


class Attention(BaseModel):
    signal: str
    subject: str
    why: str
    tab: Literal["usage", "performance", "growth", "database"]


class Overview(BaseModel):
    #: Queries in scope over the window.
    total: int = 0
    queries_a_day: float
    p50: float | None
    p95: float | None
    #: The Graph's p95, the line a scope's is read against.
    graph_p95: float | None
    #: The scope's p95 is at or above the Graph's.
    slow: bool = False
    by_caller_by_day: list[CallerDay]
    p95_by_day: list[DayValue]
    rows: list[OverviewRow]
    attention: list[Attention]


class UsageRow(BaseModel):
    key: str
    name: str
    kind: Literal["model", "node", "edge"]
    queries: int
    share: float
    by_caller: dict[str, int]
    last_touched: datetime | None
    signals: list[Signal] = []


class StitchUse(BaseModel):
    id: str
    pair: str
    kind: str
    queries: int
    share: float
    last_crossed: datetime | None


class PropertyUse(BaseModel):
    type: str
    property: str
    filtered: int
    returned: int
    ordered: int
    cold: bool


class Usage(BaseModel):
    total: int
    #: ``total`` over the window's days.
    per_day: float = 0.0
    #: Fewer than 50 queries on the Graph: counts, never signals (MP10).
    too_few: bool
    callers: dict[str, int]
    #: Each caller's fraction of ``total``.
    caller_share: dict[str, float] = {}
    #: Signals fired across the rows; zero below fifty queries.
    unused_types: int = 0
    hot_types: int = 0
    cold_properties: int = 0
    #: Active stitches some query crossed.
    stitches_crossed: int = 0
    rows: list[UsageRow]
    stitches: list[StitchUse] = []
    properties: list[PropertyUse] = []
    #: Some query in the window was explained — properties are known (MP12).
    explains: bool


class ShapeRow(BaseModel):
    hash: str
    text: str
    callers: list[str]
    calls: int
    p50: float | None
    p95: float | None
    rows: float | None
    types: list[str]
    touched_from: Literal["plan", "results"]
    has_advice: bool
    #: Its p95 is at or above the Graph's.
    slow: bool = False


class Performance(BaseModel):
    total: int
    p50: float | None
    p95: float | None
    #: The scope's p95 is at or above the Graph's.
    slow: bool = False
    errors: int
    #: ``errors`` over ``total``; 0 with no queries.
    error_rate: float = 0.0
    slow_shapes: int
    p95_by_day: list[DayValue]
    shapes: list[ShapeRow]


class Catalog(BaseModel):
    """How many models the page reads, and the types their published versions declare."""

    models: int
    published: int
    drafts: int
    node_types: int
    edge_types: int
    #: Each published model's declared types, by model id.
    types: dict[str, int]


class Insights(BaseModel):
    window: Literal["7d", "30d", "90d"]
    catalog: Catalog | None = None
    #: ``None`` — the engine does not measure this slice (MP33).
    growth: Growth | None = None
    overview: Overview | None = None
    usage: Usage | None = None
    performance: Performance | None = None


class SlowCall(BaseModel):
    at: datetime
    duration_ms: float
    caller_kind: CallerKind
    caller_id: str | None
    task_run_id: str | None


class Advice(BaseModel):
    kind: Literal["missing_index"]
    label: str
    property: str
    #: The model whose active version declares the label — where the index is staged (MP13).
    model_id: str | None
    model_name: str | None
    #: Calls in the window that filtered on it.
    calls: int


class ShapeCard(BaseModel):
    hash: str
    text: str
    language: str
    calls: int
    p50: float | None
    p95: float | None
    callers: dict[str, int]
    #: Each caller's fraction of ``calls``.
    caller_share: dict[str, float] = {}
    types: list[str]
    touched_from: Literal["plan", "results"]
    plan: list[str]
    slowest: list[SlowCall]
    advice: list[Advice]
    #: False — this connector cannot explain, and advice is *not available* (MP39).
    explains: bool


# ---------------------------------------------------------------------------
# Publish review (docs/for-developers/modules/connect-and-model/features/publish-review.md)
# ---------------------------------------------------------------------------

PublishClass = Literal["additive", "breaking"]
ReviewStatus = Literal["previewing", "pending", "migrating", "published", "failed", "declined", "expired", "stale"]


class ModelPublishChange(BaseModel):
    """One change in a draft against the published version, and whether it breaks."""

    kind: str
    target_kind: Literal["node_type", "edge_type", "property_key", "constraint", "index"]
    #: The node or edge type it is on; ``None`` for a property key or an index.
    type: str | None = None
    #: The property, the constraint's properties, or the endpoint types a narrowing removed.
    property: str | None = None
    breaking: bool
    reason: str


class ModelPublishClassification(BaseModel):
    classification: PublishClass
    #: The published version it was classified against; ``None`` before a first publish.
    base_version: str | None = None
    base_version_id: str | None = None
    draft_version_id: str
    changes: list[ModelPublishChange] = []
    #: ``changes`` by what they did: a ``*_added``, a ``*_removed``, and the rest.
    added: int = 0
    changed: int = 0
    removed: int = 0


class ModelPublishRequest(BaseModel):
    why: str = Field(default="", max_length=500)
    #: A SemVer to publish as, in place of the bump the classification implies.
    version: str | None = None
    #: Usernames; each an owner and not the requester. Empty means every other owner.
    approvers: list[str] = []
    deadline_s: int = Field(default=259200, ge=3600, le=30 * 86400)


class ModelPublishReviewRead(BaseModel):
    id: str
    model_id: str
    version_id: str
    base_version_id: str | None
    classification: PublishClass
    changes: list[ModelPublishChange]
    #: The preview run's scan — ``None`` while it runs.
    preview: dict[str, Any] | None
    #: The migration run's scan and what it published.
    result: dict[str, Any] | None
    why: str
    approver_ids: list[str]
    requested_by_id: str | None
    approval_id: str | None
    preview_run_id: str | None
    run_id: str | None
    published_version: str | None
    status: ReviewStatus
    reason: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ModelPublishOutcome(BaseModel):
    outcome: Literal["published", "review"]
    #: The published version, when ``outcome`` is ``published``.
    version: str | None = None
    version_id: str | None = None
    review: ModelPublishReviewRead | None = None


# ── data edits: what the Explorer board saves (4.7) ─────────────────────


class AddNode(BaseModel):
    op: Literal["add_node"]
    ref: str
    type: str
    properties: dict[str, Any] = {}


class AddEdge(BaseModel):
    op: Literal["add_edge"]
    ref: str
    type: str
    #: A database id, or the ``ref`` of a node added earlier in the batch.
    source: str
    target: str
    properties: dict[str, Any] = {}


class UpdateNode(BaseModel):
    op: Literal["update_node"]
    id: str
    #: The node's type after the edit.
    type: str
    #: Its type before, when the edit changes it.
    from_type: str | None = None
    set: dict[str, Any] = {}
    unset: list[str] = []


class UpdateEdge(BaseModel):
    op: Literal["update_edge"]
    id: str
    #: The relationship's type; it does not change.
    type: str
    set: dict[str, Any] = {}
    unset: list[str] = []


class DeleteNode(BaseModel):
    op: Literal["delete_node"]
    id: str
    type: str


class DeleteEdge(BaseModel):
    op: Literal["delete_edge"]
    id: str
    type: str


DataEdit = Annotated[AddNode | AddEdge | UpdateNode | UpdateEdge | DeleteNode | DeleteEdge, Field(discriminator="op")]


class DataEditBatch(BaseModel):
    """What the board's Save sends: its edits since the last save, in order."""

    #: The model version the editor read; the batch is checked against the active one.
    model_version_id: str | None = None
    edits: list[DataEdit] = Field(min_length=1, max_length=1000)


class DataEditResult(BaseModel):
    run_id: str
    #: Each added element's database id, by the board's id.
    ids: dict[str, str] = {}
    applied: int = 0


class ModelIndex(BaseModel):
    """A model version reduced to what a check needs: each type's keys and their data types."""

    version_id: str
    nodes: dict[str, dict[str, str]]
    edges: dict[str, dict[str, str]]
