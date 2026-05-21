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
	Record<"graph_info" | "intent" | "skills" | "datasets", SetupSectionState>
>;

export interface Graph {
	id: string;
	slug: string;
	name: string;
	description: string | null;
	intent: string | null;
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
	intent?: string | null;
}

export interface GraphUpdate {
	name?: string;
	description?: string | null;
	intent?: string | null;
	objectives?: string | null;
	success_criteria?: string | null;
	status?: GraphContainerStatus;
}

export interface GraphListResponse {
	items: Graph[];
	total: number;
}

export type SetupSection = "graph_info" | "intent" | "skills" | "datasets";
export const SETUP_SECTIONS: readonly SetupSection[] = [
	"graph_info",
	"intent",
	"skills",
	"datasets",
] as const;
export const SETUP_REQUIRED: readonly SetupSection[] = [
	"graph_info",
	"intent",
] as const;
export const SETUP_SKIPPABLE: readonly SetupSection[] = [
	"skills",
	"datasets",
] as const;

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

export interface GraphConnectionRead {
	id: string;
	graph_id: string | null;
	uri: string;
	connector_class: string;
	read_only: boolean;
	status: GraphConnectionStatus;
	last_health_check_at: string | null;
	latency_ms: number | null;
	schema_id: string | null;
	created_at: string;
	updated_at: string;
}

export interface GraphConnectionCreate {
	uri: string;
	connector_class: string;
	// Empty object means "keep existing credentials" on PUT-edit (server treats
	// falsy auth as no-op). On create, send {username, password}.
	auth: { username: string; password: string } | Record<string, never>;
	read_only: boolean;
}
