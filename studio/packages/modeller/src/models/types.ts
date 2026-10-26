import type { Change } from "@invana-studio/core";

// Graph models (modeller; docs/for-developers/modules/connect-and-model/features/domain-models.md). Response shapes for the version tree
// (node/edge types, property keys, constraints, indexes) live in ./schemas.

type VersionStatus = "draft" | "active" | "archived";

// How a model came to exist. `introspected` = the read-only system "global" model
// mirroring the physical DB; `studio` = authored in the Modeller; `yaml` = YAML-managed.
type ModelOrigin = "studio" | "yaml" | "introspected";

// ── Publish review (publish-review.md) ─────────────────────────────────────

export interface PublishChange {
	kind: string;
	target_kind:
		| "node_type"
		| "edge_type"
		| "property_key"
		| "constraint"
		| "index";
	/** The node or edge type it is on; null for a property key or an index. */
	type: string | null;
	property: string | null;
	breaking: boolean;
	/** `removed property`, `narrowed property`, `additive`. */
	reason: string;
}

export interface PublishClassification {
	classification: "additive" | "breaking";
	/** The published version it was read against; null before a first publish. */
	base_version: string | null;
	draft_version_id: string;
	changes: PublishChange[];
	/** `changes` counted by what they did — by the engine. */
	added: number;
	changed: number;
	removed: number;
}

export interface PublishRequest {
	why?: string;
	/** Usernames; each an owner other than the requester. Empty is every other owner. */
	approvers?: string[];
}

/** One touched type in a migration run's scan — counts of what was read. */
interface MigrationTypeScan {
	kind: "node" | "edge";
	type: string;
	total: number;
	scanned: number;
	affected: number;
	would_fail: number;
	removed: boolean;
	changes: string[];
}

interface MigrationScan {
	scan_limit: number;
	types: MigrationTypeScan[];
	affected: number;
	would_fail: number;
}

type PublishReviewStatus =
	| "previewing"
	| "pending"
	| "migrating"
	| "published"
	| "failed"
	| "declined"
	| "expired"
	| "stale";

export interface PublishReview {
	id: string;
	model_id: string;
	classification: "additive" | "breaking";
	changes: PublishChange[];
	/** The preview run's scan — null while it runs. */
	preview: MigrationScan | null;
	why: string;
	approval_id: string | null;
	preview_run_id: string | null;
	run_id: string | null;
	published_version: string | null;
	status: PublishReviewStatus;
	reason: string | null;
}

export interface PublishOutcome {
	outcome: "published" | "review";
	version: string | null;
	review: PublishReview | null;
}

/** The part of a dataset binding that says who reads a model. */
export interface DatasetBindingRef {
	id: string;
	model_id: string;
	type_name: string;
	/** `publisher/name@v`. */
	address: string;
}

export interface VersionSummary {
	id: string;
	model_id: string;
	version: string | null;
	status: VersionStatus;
	change_summary: string;
	created_at: string;
	activated_at: string | null;
}

export interface GraphModelSummary {
	id: string;
	graph_id: string | null;
	name: string;
	description: string;
	status: VersionStatus;
	origin: ModelOrigin;
	updated_at: string;
	active_version: VersionSummary | null;
	/** The open draft, if any. */
	draft_version: VersionSummary | null;
}

export interface GraphModelResponse {
	id: string;
	graph_id: string | null;
	name: string;
	description: string;
	validation_mode: string;
	status: VersionStatus;
	origin: ModelOrigin;
	yaml_path: string | null;
	created_at: string;
	updated_at: string;
	active_version: VersionSummary | null;
	versions: VersionSummary[];
}

export interface GraphModelCreate {
	name: string;
	description?: string;
	validation_mode?: "strict" | "permissive";
}

export interface GraphModelUpdate {
	name?: string;
	description?: string;
	validation_mode?: "strict" | "permissive";
	status?: VersionStatus;
}

// ── Version + type-authoring payloads ──────────────────────────────────────

export interface VersionCreate {
	based_on?: string | null;
}

export interface VersionActivate {
	version?: string | null;
}

interface ValidationRuleCreate {
	rule_type:
		| "range"
		| "pattern"
		| "enum"
		| "min_length"
		| "max_length"
		| "custom";
	params?: Record<string, unknown>;
}

export interface TypePropertyMappingCreate {
	property_key: string;
	default_value?: string | null;
	sort_order?: number;
	validation_rules?: ValidationRuleCreate[];
}

export interface NodeTypeCreate {
	name: string;
	description?: string;
	parent_type?: string | null;
	is_abstract?: boolean;
	validation_mode?: "strict" | "permissive" | null;
	property_mappings?: TypePropertyMappingCreate[];
}

export interface NodeTypeUpdate {
	name?: string;
	description?: string;
	parent_type?: string | null;
	is_abstract?: boolean;
	validation_mode?: "strict" | "permissive" | null;
	// When provided, full-replaces the type's property mappings ([] removes all).
	property_mappings?: TypePropertyMappingCreate[];
}

export type Multiplicity =
	| "MULTI"
	| "SIMPLE"
	| "ONE2MANY"
	| "MANY2ONE"
	| "ONE2ONE";

export interface EdgeTypeCreate {
	name: string;
	description?: string;
	source_node_types?: string[];
	target_node_types?: string[];
	multiplicity?: Multiplicity;
	property_mappings?: TypePropertyMappingCreate[];
}

export interface EdgeTypeUpdate {
	name?: string;
	description?: string;
	source_node_types?: string[];
	target_node_types?: string[];
	multiplicity?: Multiplicity;
	// When provided, full-replaces the type's property mappings ([] removes all).
	property_mappings?: TypePropertyMappingCreate[];
}

export interface PropertyKeyCreate {
	name: string;
	type?: string;
	value_cardinality?: "SINGLE" | "LIST" | "SET";
	description?: string;
	validation_rules?: ValidationRuleCreate[];
}

export interface PropertyKeyUpdate {
	name?: string;
	type?: string;
	value_cardinality?: "SINGLE" | "LIST" | "SET";
	description?: string;
	validation_rules?: ValidationRuleCreate[];
}

type ConstraintType =
	| "unique"
	| "exists"
	| "node_key"
	| "relationship_unique"
	| "relationship_exists";

export interface ConstraintCreate {
	name: string;
	target_kind: "node_type" | "edge_type";
	target_label: string;
	constraint_type: ConstraintType;
	properties: string[];
}

type IndexType =
	| "range"
	| "composite"
	| "fulltext"
	| "text"
	| "point"
	| "lookup";

export interface IndexCreate {
	name: string;
	target_kind: "node_type" | "edge_type";
	target_label: string;
	properties: string[];
	index_type?: IndexType;
	index_options?: Record<string, unknown> | null;
}

// ── The staged set (docs/for-developers/modules/connect-and-model/features/model-editor.md) ──
//
// The draft *is* the staged set: what is staged is the difference
// between the draft and the version it replaces, which is why it survives a
// reload and reads the same to everyone who opens the model.

type StagedOp = "added" | "removed" | "modified";
type StagedKind =
	| "node_type"
	| "edge_type"
	| "property_key"
	| "constraint"
	| "index";

interface StagedChange {
	id: string;
	op: StagedOp;
	kind: StagedKind;
	name: string;
	/** field → [was, now], for a modification. */
	changes: Record<string, unknown[]>;
	/** Named before the commit, never after (model-editor.md seams). */
	dependents: string[];
}

export interface StagedSet {
	version_id: string;
	based_on: string | null;
	count: number;
	changes: StagedChange[];
	can_commit: boolean;
	/** Why the commit is unavailable — the action says this rather than going quiet. */
	reason: string | null;
}

/** One operation a projection would push (the-model-page.md). */
interface ProjectionOperation {
	action: "create_index" | "create_constraint";
	name: string;
	label: string;
	properties: string[];
	kind: string;
	/** Neutral DDL — the vendor's own statement is its schema writer's. */
	statement: string;
	supported: boolean;
}

export interface ProjectionPlan {
	/** `live` — against what the database reports; `active_version` — against the published version. */
	against: "live" | "active_version";
	operations: ProjectionOperation[];
}

/** A stitch that keeps a model from being archived. */
export interface BindingStitch {
	id: string;
	kind: LinkKind;
	source: string;
	target: string;
}

export interface CommitResult {
	version: GraphVersionResponse;
	committed: number;
	content_hash: string | null;
}

// ── Portability (share-a-model.md) ──────────────────────────────────────────

export interface ModelArtefact {
	format: string;
	package_id: string;
	content_hash: string;
	name: string;
	description: string;
	version: string | null;
	model: Record<string, unknown>;
	links: unknown[];
}

/** A property type the bound database cannot hold — named, never dropped. */
interface UnsupportedPropertyType {
	property_key: string;
	type: string;
}

export interface ModelImportResult {
	model: GraphModelResponse;
	version: GraphVersionResponse;
	unsupported_property_types: UnsupportedPropertyType[];
	publishable: boolean;
}

// ── Ontology import (ontology-import.md) ────────────────────────────────────

type RdfFormat = "turtle" | "json-ld" | "rdf-xml";

/** One thing an import skipped, or did in a way worth saying. */
interface ImportNote {
	iri?: string | null;
	subject: string;
	/** `restriction` · `no_domain` · `flattened` … */
	kind: string;
	message: string;
}

export interface MappedType {
	name: string;
	iri: string;
	kind: "node" | "edge";
	/** `Person.birthPlace` — the property that brought an unpicked type in. */
	came_with?: string | null;
	properties: string[];
	inherited: { property: string; from_type: string }[];
}

interface StitchSuggestion {
	kind: "same_as" | "equivalent_class" | "equivalent_property";
	name: string;
	iri: string;
	target_iri: string;
}

export interface OntologyReport {
	format: RdfFormat;
	triples: number;
	mapped: { node_types: number; edge_types: number; property_keys: number };
	types: MappedType[];
	skipped: ImportNote[];
	skipped_count: number;
	notes: ImportNote[];
	notes_count: number;
	suggestions: StitchSuggestion[];
}

/** The draft an ontology import creates — or would; the artefact's model shape. */
interface OntologyDraft {
	schema_name: string;
	schema_description?: string | null;
	property_keys: {
		name: string;
		type: string;
		description?: string | null;
		source_iri?: string | null;
	}[];
	node_types: {
		name: string;
		description?: string | null;
		property_mappings: { property_key: string; sort_order?: number }[];
		source_iri?: string | null;
	}[];
	edge_types: {
		name: string;
		description?: string | null;
		source_node_types: string[];
		target_node_types: string[];
		source_iri?: string | null;
	}[];
}

export interface OntologyImportRequest {
	content: string;
	format?: RdfFormat;
	/** Class names, local names or IRIs; omitted, every class (at most 500). */
	types?: string[];
	/** The model's name in this Graph; omitted, the ontology's label. */
	name?: string;
	lang?: string;
	dry_run?: boolean;
}

export interface OntologyImportResult {
	/** Absent on a dry run. */
	model?: GraphModelResponse | null;
	version?: GraphVersionResponse | null;
	draft: OntologyDraft;
	report: OntologyReport;
	unsupported_property_types: UnsupportedPropertyType[];
	publishable: boolean;
}

export interface SchemaDiff {
	added_property_keys: string[];
	removed_property_keys: string[];
	added_node_types: string[];
	removed_node_types: string[];
	modified_node_types: { name: string }[];
	added_edge_types: string[];
	removed_edge_types: string[];
	modified_edge_types: { name: string }[];
	added_constraints: string[];
	removed_constraints: string[];
	added_indexes: string[];
	removed_indexes: string[];
	classification: "major" | "minor" | "patch";
}

export interface ModelUpgradeResult extends ModelImportResult {
	diff: SchemaDiff;
}

export interface StarterSummary {
	slug: string;
	name: string;
	description: string;
	version: string | null;
	package_id: string;
	node_types: string[];
	edge_types: string[];
}

// ── Links and the global model (stitch-models.md) ───────────────────────────

export type LinkKind = "anchor" | "relationship";
/** A stitch is declared staged and reaches the union on a commit. */
type LinkStatus = "staged" | "active";
export type IdentityMatch = "exact" | "case_insensitive";

export interface ModelLink {
	id: string;
	kind: LinkKind;
	status: LinkStatus;
	source_version_id: string;
	source_type: string;
	source_model: string | null;
	source_version: string | null;
	target_version_id: string;
	target_type: string;
	target_model: string | null;
	target_version: string | null;
	/** A key on each side — the two models rarely spell the fact alike. */
	source_property: string | null;
	target_property: string | null;
	identity_match: IdentityMatch;
	edge_type: string | null;
	/** Relationship only — the model whose records ship this edge's rows. */
	source_model_id: string | null;
	/** Where it came from — a bundle applied by the CLI says so here. */
	description: string;
	/** What committing this stitch wrote. Present on a commit's reply only. */
	edges_written?: number | null;
	/** Edges the stitch holds in the graph now; null before it first solves. */
	edges: number | null;
}

/** One event in a stitch's history — its declare and its commit. */
export interface StitchEvent {
	action: string;
	at: string;
	actor: string | null;
}

/** One stitch read whole: who declared it, each end's records, its history. */
export interface StitchDetail extends ModelLink {
	declared_by: string | null;
	declared_at: string | null;
	/** Each end type's latest counted records; null when never counted. */
	source_records: number | null;
	target_records: number | null;
	history: StitchEvent[];
}

/** A removed stitch, read from its removal event — the row itself is gone. */
export interface RemovedStitch {
	/** The removed stitch's id. */
	id: string;
	kind: LinkKind;
	source_model: string | null;
	source_type: string;
	target_model: string | null;
	target_type: string;
	source_property: string | null;
	target_property: string | null;
	edge_type: string | null;
	edges_withdrawn: number;
	removed_by: string | null;
	removed_at: string;
}

export interface ModelLinkDeclare {
	kind: LinkKind;
	source_version_id: string;
	source_type: string;
	target_version_id: string;
	target_type: string;
	source_property?: string | null;
	target_property?: string | null;
	identity_match?: IdentityMatch;
	edge_type?: string | null;
	source_model_id?: string | null;
	description?: string;
}

/** Where a relationship's endpoints come from — one or the other, never both. */
export type EndpointSource = "keys" | "records";

/** How many the rule resolves, counted *before* the stitch is declared. */
export interface StitchPreview {
	source_total: number;
	target_total: number;
	resolved: number;
	unresolved_source: number;
	unresolved_target: number;
	/** The first few source keys that match nothing — what "Show the N" opens. */
	unresolved_sample: string[];
	/**
	 * Whether there was anything to judge. A side with no rows carrying the key
	 * cannot say a rule is wrong — models are authored before data lands.
	 */
	countable: boolean;
	verdict: string;
}

/** The rule a stitch already on this pair carries — what the refusal card states. */
export interface AlreadyStitched {
	error: "link_already_declared";
	link_id: string;
	kind: LinkKind;
	source_type: string;
	target_type: string;
	source_property: string | null;
	target_property: string | null;
	identity_match: IdentityMatch;
	edge_type: string | null;
}

export interface GlobalType {
	name: string;
	models: string[];
	anchored: boolean;
}

/** The union of the Graph's published models plus its links — derived on read. */
export interface GlobalModel {
	node_types: GlobalType[];
	edge_types: GlobalType[];
	model_count: number;
	link_count: number;
	anchor_count: number;
	relationship_count: number;
	/** Declared but not committed — counted beside the union, never into it. */
	staged_count: number;
	collapsed: string[];
	/** What the database actually holds — beside the derived counts, never in them. */
	mirror_label_count: number;
}

// ── Insights — the model page's measured tabs (the-model-page.md) ─────

export type InsightsWindow = "7d" | "30d" | "90d";
type WriteSource = "introspect" | "import" | "stitch_commit";

export interface WrittenBy {
	source: WriteSource;
	source_id: string | null;
	at: string;
}

interface GrowthSeries {
	key: string;
	name: string;
	kind: "model" | "node" | "edge";
	/** One per day; `null` before anything was counted. */
	values: (number | null)[];
}

export interface GrowthMark {
	index: number;
	source: Exclude<WriteSource, "introspect">;
	source_id: string | null;
	at: string;
}

export interface GrowthRow {
	key: string;
	name: string;
	kind: "model" | "node" | "edge";
	start: number | null;
	now: number | null;
	change: number | null;
	/** `change` against `start`; null from nothing or before any count. */
	change_rate: Change | null;
	/** Counted at the start and the same now, or never counted. */
	unchanged: boolean;
	last: WrittenBy | null;
}

export interface Growth {
	/** ISO days, oldest first. */
	labels: string[];
	series: GrowthSeries[];
	marks: GrowthMark[];
	rows: GrowthRow[];
	writes: { imports: number; stitch_commits: number; total: number };
	/** Anything in scope was ever counted — else the never-imported state. */
	counted: boolean;
	/** Records at the window's start; null when nothing was counted before it. */
	start: number | null;
	now: number;
	/** `now − start`; null when `start` is. */
	change: number | null;
	change_rate: Change | null;
	/** The key of the row that grew the most. */
	fastest: string | null;
	/** How many rows are unchanged. */
	unchanged: number;
}

export type CallerKind = "agent" | "plan" | "explorer" | "api";
export type SignalKind =
	| "unused"
	| "empty"
	| "hot"
	| "hot_and_slow"
	| "supernode"
	| "cold";

/** A fixed rule that fired. */
export interface Signal {
	signal: SignalKind;
	subject: string;
	why: string;
}

interface DayValue {
	label: string;
	value: number | null;
}

export interface Overview {
	/** Queries in scope over the window. */
	total: number;
	queries_a_day: number;
	p50: number | null;
	p95: number | null;
	graph_p95: number | null;
	/** The scope's p95 is at or above the Graph's. */
	slow: boolean;
	by_caller_by_day: { label: string; counts: Record<CallerKind, number> }[];
	p95_by_day: DayValue[];
	rows: { key: string; share: number; p95: number | null; signals: Signal[] }[];
	attention: {
		signal: string;
		subject: string;
		why: string;
		tab: "usage" | "performance" | "growth" | "database";
	}[];
}

export interface UsageRow {
	key: string;
	name: string;
	kind: "model" | "node" | "edge";
	queries: number;
	share: number;
	by_caller: Record<CallerKind, number>;
	last_touched: string | null;
	signals: Signal[];
}

export interface Usage {
	total: number;
	per_day: number;
	/** Fewer than 50 queries on the Graph — counts, never signals. */
	too_few: boolean;
	callers: Record<CallerKind, number>;
	/** Each caller's fraction of `total`. */
	caller_share: Record<CallerKind, number>;
	unused_types: number;
	hot_types: number;
	cold_properties: number;
	stitches_crossed: number;
	rows: UsageRow[];
	stitches: {
		id: string;
		pair: string;
		kind: string;
		queries: number;
		share: number;
		last_crossed: string | null;
	}[];
	properties: {
		type: string;
		property: string;
		filtered: number;
		returned: number;
		ordered: number;
		cold: boolean;
	}[];
	explains: boolean;
}

export interface ShapeRow {
	hash: string;
	text: string;
	callers: CallerKind[];
	calls: number;
	p50: number | null;
	p95: number | null;
	rows: number | null;
	types: string[];
	touched_from: "plan" | "results";
	has_advice: boolean;
	/** Its p95 is at or above the Graph's. */
	slow: boolean;
}

export interface Performance {
	total: number;
	p50: number | null;
	p95: number | null;
	/** The scope's p95 is at or above the Graph's. */
	slow: boolean;
	errors: number;
	/** `errors` over `total`. */
	error_rate: number;
	slow_shapes: number;
	p95_by_day: DayValue[];
	shapes: ShapeRow[];
}

/** The page's model and type counts, counted by the engine. */
interface Catalog {
	models: number;
	published: number;
	drafts: number;
	node_types: number;
	edge_types: number;
	/** Each published model's declared types, by model id. */
	types: Record<string, number>;
}

export interface Insights {
	window: InsightsWindow;
	catalog: Catalog | null;
	/** `null` — the engine does not measure this slice. */
	growth: Growth | null;
	overview: Overview | null;
	usage: Usage | null;
	performance: Performance | null;
}

/** An index the plan says is missing, and the model it would be staged on. */
export interface Advice {
	kind: "missing_index";
	label: string;
	property: string;
	model_id: string | null;
	model_name: string | null;
	calls: number;
}

export interface ShapeCard {
	hash: string;
	text: string;
	language: string;
	calls: number;
	p50: number | null;
	p95: number | null;
	callers: Partial<Record<CallerKind, number>>;
	caller_share: Partial<Record<CallerKind, number>>;
	types: string[];
	touched_from: "plan" | "results";
	plan: string[];
	slowest: {
		at: string;
		duration_ms: number;
		caller_kind: CallerKind;
		caller_id: string | null;
		task_run_id: string | null;
	}[];
	advice: Advice[];
	/** False — this connector cannot explain; advice is not available. */
	explains: boolean;
}

// ── Validation Rules ───────────────────────────────────────────────────────

interface ValidationRuleResponse {
	id: string;
	rule_type:
		| "range"
		| "pattern"
		| "enum"
		| "min_length"
		| "max_length"
		| "custom";
	params: Record<string, unknown>;
}

// ── Property Keys ──────────────────────────────────────────────────────────

export interface PropertyKeyResponse {
	id: string;
	name: string;
	type: string;
	value_cardinality: "SINGLE" | "LIST" | "SET";
	description: string;
	validation_rules: ValidationRuleResponse[];
}

// ── Type Property Mappings ─────────────────────────────────────────────────

export interface TypePropertyMappingResponse {
	id: string;
	property_key: PropertyKeyResponse;
	default_value: string | null;
	sort_order: number;
	validation_rules: ValidationRuleResponse[];
	inherited: boolean;
}

// ── Node Types ─────────────────────────────────────────────────────────────

export interface NodeTypeResponse {
	id: string;
	name: string;
	description: string;
	parent_type: string | null;
	is_abstract: boolean;
	validation_mode: string | null;
	property_mappings: TypePropertyMappingResponse[];
	effective_property_mappings: TypePropertyMappingResponse[];
	hierarchy: string[];
}

// ── Edge Types ─────────────────────────────────────────────────────────────

export interface EdgeTypeResponse {
	id: string;
	name: string;
	description: string;
	source_node_types: string[];
	target_node_types: string[];
	multiplicity: "MULTI" | "SIMPLE" | "ONE2MANY" | "MANY2ONE" | "ONE2ONE";
	property_mappings: TypePropertyMappingResponse[];
}

// ── Constraints ───────────────────────────────────────────────────────────

export interface ConstraintResponse {
	id: string;
	name: string;
	target_kind: "node_type" | "edge_type";
	target_label: string;
	constraint_type: string;
	properties: string[];
}

// ── Indexes ───────────────────────────────────────────────────────────────

export interface IndexResponse {
	id: string;
	name: string;
	target_kind: "node_type" | "edge_type";
	target_label: string;
	properties: string[];
	index_type: string;
	index_options: Record<string, unknown> | null;
}

// ── Schema Version (full payload for Modeller) ────────────────────────────

export interface GraphVersionResponse {
	id: string;
	model_id: string;
	version: string | null;
	status: string;
	change_summary: string;
	created_at: string;
	activated_at: string | null;
	property_keys: PropertyKeyResponse[];
	node_types: NodeTypeResponse[];
	edge_types: EdgeTypeResponse[];
	constraints: ConstraintResponse[];
	indexes: IndexResponse[];
}

// ── The physical read — the model page's Database tab ───────────────

/** How a row stands against the models (the-model-page.md). */
export type Drift = "in_both" | "model_only" | "database_only";

/** A label or relationship type, and which models declare it. */
export interface PhysicalType {
	name: string;
	models: string[];
	/** Live; `null` where the connector cannot count. */
	count: number | null;
	drift: Drift;
}

/** An index or constraint, matched by what it covers. */
export interface PhysicalRule {
	name: string;
	label: string;
	properties: string[];
	type: string;
	models: string[];
	drift: Drift;
}

export interface PhysicalSchema {
	/** `null` — never introspected. */
	captured_at: string | null;
	/** An import counted after the mirror was captured. */
	stale: boolean;
	connector: string | null;
	/** Whether the connector lists its indexes and constraints. */
	lists_schema: boolean;
	/** What the scope's models declare — said even where nothing can check them. */
	declared_indexes: number;
	declared_constraints: number;
	labels: PhysicalType[];
	relationship_types: PhysicalType[];
	indexes: PhysicalRule[];
	constraints: PhysicalRule[];
	labels_tally: TypeTally;
	relationship_types_tally: TypeTally;
	/** Indexes and constraints the database holds. */
	indexes_present: number;
	constraints_present: number;
	/** Null until a mirror was captured. */
	drift: PhysicalDrift | null;
}

interface TypeTally {
	modelled: number;
	unmodelled: number;
}

/** Rows that disagree with the models, counted by the engine. */
interface PhysicalDrift {
	total: number;
	types: number;
	rules: number;
	unmodelled_types: number;
	model_only_rules: number;
	/** Rows not in both, per model name, among the rows it declares. */
	by_model: Record<string, number>;
}
