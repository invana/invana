// ─────────────────────────────────────────────────────────────────────────────
// Graph container types (RFC-017)
//
// `Graph` is the primary container (was Workspace + Mission). It has a 1:1
// `GraphConnection` child. URLs: /u/{owner_username}/{slug}.
// ─────────────────────────────────────────────────────────────────────────────

export type GraphContainerStatus = "active" | "archived";

export interface SetupSectionState {
	completed_at?: string;
	skipped_at?: string;
}

export type SetupState = Partial<
	Record<
		"graph_info" | "instructions" | "skills" | "datasets",
		SetupSectionState
	>
>;

export interface Graph {
	id: string;
	slug: string;
	name: string;
	description: string | null;
	instructions: string | null;
	objectives: string | null;
	success_criteria: string | null;
	setup_state: SetupState;
	status: GraphContainerStatus;
	owner_id: string;
	owner_username: string;
	member_count: number;
	has_connection: boolean;
	created_at: string;
	updated_at: string;
}

export interface GraphCreate {
	name: string;
	slug: string;
	instructions?: string | null;
}

export interface GraphUpdate {
	name?: string;
	description?: string | null;
	instructions?: string | null;
	objectives?: string | null;
	success_criteria?: string | null;
	status?: GraphContainerStatus;
}

export interface GraphListResponse {
	items: Graph[];
	total: number;
}

export type SetupSection =
	| "graph_info"
	| "instructions"
	| "skills"
	| "datasets";
export const SETUP_SECTIONS: readonly SetupSection[] = [
	"graph_info",
	"instructions",
	"skills",
	"datasets",
] as const;
export const SETUP_REQUIRED: readonly SetupSection[] = [
	"graph_info",
	"instructions",
] as const;
export const SETUP_SKIPPABLE: readonly SetupSection[] = [
	"skills",
	"datasets",
] as const;

/**
 * Mirror of the engine's `is_setup_complete` guard (graphs/services.py): a
 * graph is query-ready only once every REQUIRED section carries a
 * `completed_at`. Surfaces (Explorer, Modeller) use this to gate before the
 * engine 409s with `graph_setup_incomplete`.
 */
export function isSetupComplete(graph: Graph): boolean {
	return SETUP_REQUIRED.every((s) => !!graph.setup_state?.[s]?.completed_at);
}

// ─────────────────────────────────────────────────────────────────────────────
// GraphConnection types
//
// 1:1 child of `Graph`. Carries DB binding details (URI, driver, encrypted
// auth) and runtime health. Edited via /u/:username/:graphSlug/connection.
// ─────────────────────────────────────────────────────────────────────────────

export type GraphConnectionStatus =
	| "CONNECTING"
	| "ACTIVE"
	| "ERROR"
	| "INACTIVE";

export const CONNECTOR_OPTIONS = [
	{ label: "Neo4j", value: "invana_neo4j.connector.Neo4jConnector" },
	{ label: "Memgraph", value: "invana_memgraph.connector.MemgraphConnector" },
	{
		label: "ArcadeDB (Cypher)",
		value: "invana_arcadedb.connector.ArcadeDBCypherConnector",
	},
	{
		label: "JanusGraph",
		value: "invana_janusgraph.connector.JanusGraphConnector",
	},
	{
		label: "Amazon Neptune",
		value: "invana_neptune.connector.NeptuneConnector",
	},
	{
		label: "TinkerGraph",
		value: "invana_tinkergraph.connector.TinkerGraphConnector",
	},
] as const;

export type ConnectorClass = (typeof CONNECTOR_OPTIONS)[number]["value"];

// "cypher" | "gremlin" — the subset of capabilities Studio's query-language
// selector understands. Empty/missing means "no constraint reported"; UI
// falls back to allowing all supported languages.
export type QueryLanguage = "cypher" | "gremlin";

export interface GraphConnectionRead {
	id: string;
	graph_id: string | null;
	uri: string;
	connector_class: string;
	read_only: boolean;
	status: GraphConnectionStatus;
	last_health_check_at: string | null;
	latency_ms: number | null;
	model_id: string | null;
	created_at: string;
	updated_at: string;
	// Connector-reported capabilities resolved server-side. `capabilities`
	// is the full set (cypher, gremlin, vector_search, fulltext_index, …);
	// `query_languages` is the cypher/gremlin subset used to drive the
	// Explorer's language picker.
	capabilities: string[];
	query_languages: QueryLanguage[];
	// Backend property-type capabilities + version compatibility (RFC-022).
	// `supported_property_types` drives the modeller's property-type dropdowns;
	// the version/compatibility fields drive the read-only safety valve + banner.
	supported_property_types: string[];
	server_version: string | null;
	server_version_source: "detected" | "declared" | null;
	compatibility_status: CompatibilityStatus;
	version_acknowledged: boolean;
	tested_version_range: string | null;
	effective_read_only: boolean;
}

// How the detected/declared DB version relates to the connector's tested window.
export type CompatibilityStatus =
	| "supported"
	| "untested"
	| "unsupported"
	| "unknown";

export interface GraphConnectionCreate {
	uri: string;
	connector_class: string;
	// Empty object means "keep existing credentials" on PUT-edit (server treats
	// falsy auth as no-op). On create, send {username, password}.
	auth: { username: string; password: string } | Record<string, never>;
	read_only: boolean;
	// Optional manually-declared DB version (RFC-022) — fallback when the backend
	// can't be auto-detected. Auto-detection on connect overrides it; omit/blank
	// to rely on detection.
	server_version?: string | null;
}
