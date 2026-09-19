// Graph models (modeller; docs/for-developers/modules/connect-and-model/features/domain-models.md). Response shapes for the version tree
// (node/edge types, property keys, constraints, indexes) live in ./schemas.

export type VersionStatus = "draft" | "active" | "archived";

// How a model came to exist. `introspected` = the read-only system "global" model
// mirroring the physical DB; `studio` = authored in the Modeller; `yaml` = YAML-managed.
export type ModelOrigin = "studio" | "yaml" | "introspected";

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

export interface ValidationRuleCreate {
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

export type ConstraintType =
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

export type IndexType =
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

export type StagedOp = "added" | "removed" | "modified";
export type StagedKind =
	| "node_type"
	| "edge_type"
	| "property_key"
	| "constraint"
	| "index";

export interface StagedChange {
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

export interface CommitResult {
	version: import("@/types/schemas").GraphVersionResponse;
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
export interface UnsupportedPropertyType {
	property_key: string;
	type: string;
}

export interface ModelImportResult {
	model: GraphModelResponse;
	version: import("@/types/schemas").GraphVersionResponse;
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
export type LinkStatus = "staged" | "active";
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
