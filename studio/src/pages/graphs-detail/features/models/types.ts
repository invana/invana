// Graph models (modeller; docs/for-developers/modules/connect-and-model/features/domain-models.md). Response shapes for the version tree
// (node/edge types, property keys, constraints, indexes) live in ./schemas.

type VersionStatus = "draft" | "active" | "archived";

// How a model came to exist. `introspected` = the read-only system "global" model
// mirroring the physical DB; `studio` = authored in the Modeller; `yaml` = YAML-managed.
type ModelOrigin = "studio" | "yaml" | "introspected";

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
// The draft *is* the staged set (ME2, ME4): what is staged is the difference
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

/** One operation a projection would push (the-model-page.md MP20). */
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

/** A stitch that keeps a model from being archived (MP7). */
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

/** A property type the bound database cannot hold — named, never dropped (SM4). */
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
/** A stitch is declared staged and reaches the union on a commit (ST21). */
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
	/** A key on each side (ST26) — the two models rarely spell the fact alike. */
	source_property: string | null;
	target_property: string | null;
	identity_match: IdentityMatch;
	edge_type: string | null;
	/** Relationship only — the model whose records ship this edge's rows (ST27). */
	source_model_id: string | null;
	/** Where it came from — a bundle applied by the CLI says so here (ST50). */
	description: string;
	/** What committing this stitch wrote. Present on a commit's reply only (ST44). */
	edges_written?: number | null;
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

/** Where a relationship's endpoints come from — one or the other, never both (ST27). */
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

/** The union of the Graph's published models plus its links — derived on read (ST3). */
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
	/** What the database actually holds — beside the derived counts, never in them (ST7). */
	mirror_label_count: number;
}

// ── Insights — the model page's measured tabs (the-model-page.md MP33) ─────

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
	/** One per day; `null` before anything was counted (MP32). */
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
	last: WrittenBy | null;
}

export interface Growth {
	/** ISO days, oldest first. */
	labels: string[];
	series: GrowthSeries[];
	marks: GrowthMark[];
	rows: GrowthRow[];
	writes: { imports: number; stitch_commits: number };
	/** Anything in scope was ever counted — else the never-imported state. */
	counted: boolean;
}

export type CallerKind = "agent" | "plan" | "explorer" | "api";
export type SignalKind =
	| "unused"
	| "empty"
	| "hot"
	| "hot_and_slow"
	| "supernode"
	| "cold";

/** A fixed rule that fired (MP10). */
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
	queries_a_day: number;
	p50: number | null;
	p95: number | null;
	graph_p95: number | null;
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
	/** Fewer than 50 queries on the Graph — counts, never signals (MP10). */
	too_few: boolean;
	callers: Record<CallerKind, number>;
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
}

export interface Performance {
	total: number;
	p50: number | null;
	p95: number | null;
	errors: number;
	slow_shapes: number;
	p95_by_day: DayValue[];
	shapes: ShapeRow[];
}

export interface Insights {
	window: InsightsWindow;
	/** `null` — the engine does not measure this slice (MP33). */
	growth: Growth | null;
	overview: Overview | null;
	usage: Usage | null;
	performance: Performance | null;
}

/** An index the plan says is missing, and the model it would be staged on (MP13 · MP39). */
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
	/** False — this connector cannot explain; advice is not available (MP39). */
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

// ── The physical read — the model page's Database tab (MP9) ───────────────

/** How a row stands against the models (the-model-page.md MP9). */
export type Drift = "in_both" | "model_only" | "database_only";

/** A label or relationship type, and which models declare it (MP17). */
export interface PhysicalType {
	name: string;
	models: string[];
	/** Live; `null` where the connector cannot count (MP28). */
	count: number | null;
	drift: Drift;
}

/** An index or constraint, matched by what it covers (MP27). */
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
	/** An import counted after the mirror was captured (MP34). */
	stale: boolean;
	connector: string | null;
	/** Whether the connector lists its indexes and constraints (MP26). */
	lists_schema: boolean;
	/** What the scope's models declare — said even where nothing can check them. */
	declared_indexes: number;
	declared_constraints: number;
	labels: PhysicalType[];
	relationship_types: PhysicalType[];
	indexes: PhysicalRule[];
	constraints: PhysicalRule[];
}
