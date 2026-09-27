// ── Validation Rules ───────────────────────────────────────────────────────

export interface ValidationRuleResponse {
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
