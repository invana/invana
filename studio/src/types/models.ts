// Graph models (modeller; RFC-019). Response shapes for the version tree
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
