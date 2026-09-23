// ─────────────────────────────────────────────────────────────────────────────
// Graph container types (docs/for-developers/modules/identity-and-access/spec.md)
//
// `Graph` is the primary container (was Workspace + Mission). It has a 1:1
// `GraphConnection` child. URLs: /u/{owner_username}/{slug}.
// ─────────────────────────────────────────────────────────────────────────────

export type GraphContainerStatus = "active" | "archived";

export interface SetupSectionState {
	/** Whether the thing the step asks for exists. The engine reads this off the
	 *  facts, not off a stored checklist
	 *  (docs/for-developers/modules/platform/features/setup.md SU1). */
	done: boolean;
	/** When the fact came into being, where a timestamp exists — the connection
	 *  row, the first published version, the first succeeded import. Null when
	 *  the schema records no time for it (instructions written before the stamp
	 *  existed). */
	completed_at?: string | null;
	/** Set only on an optional step a person chose to pass over (CM9). */
	skipped_at?: string | null;
	/** Whether the Graph is unready without it. The engine owns the answer;
	 *  Studio never re-decides which steps are required. */
	required?: boolean;
	/** Which gate this step holds shut — `null` on an optional one (SU3). */
	gate?: SetupGate | null;
	/** The step that has to land first, when this one cannot be started (SU12).
	 *  `datasets` waits on `model`, because every import path names one. */
	blocked_by?: SetupSection | null;
	/** A step that was done and stopped being true — an unreachable database, a
	 *  rejected key. Carries what the engine stored about the failure. */
	broken?: string | null;
}

export type SetupState = Partial<Record<SetupSection, SetupSectionState>>;

export interface Graph {
	id: string;
	slug: string;
	name: string;
	description: string | null;
	instructions: string | null;
	setup_state: SetupState;
	status: GraphContainerStatus;
	owner_id: string;
	owner_username: string;
	member_count: number;
	has_connection: boolean;
	/**
	 * The outermost bound
	 * (docs/for-developers/modules/agents/features/concurrency-and-contention.md).
	 *
	 * A budget bounds one agent's spend; this bounds the Graph. Ten agents, each
	 * inside its own ceiling, are still ten concurrent query loads and ten claims
	 * on one provider's rate limit.
	 */
	max_concurrent_runs: number;
	/** `queue` waits for a slot; `refuse` says so immediately. */
	concurrency_policy: "queue" | "refuse";
	created_at: string;
	updated_at: string;
}

/** What is running in a Graph and what is waiting behind it (C8). */
export interface GraphContention {
	ceiling: number;
	policy: "queue" | "refuse";
	running: string[];
	queued: {
		run_id: string;
		position: number;
		triggered_by: string;
		queued_at: string;
	}[];
	running_count: number;
	queued_count: number;
	/**
	 * Each **configured** pool, its size and what is in it right now (CC8).
	 * Configured on the Graph, in use in the process — so a pool nobody has
	 * touched still lists, with `in_use: 0`. The run ceiling says how many runs
	 * may proceed; these say how many crossings may be in flight.
	 */
	pools: { pool: string; size: number; in_use: number }[];
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
	status?: GraphContainerStatus;
	max_concurrent_runs?: number;
	concurrency_policy?: "queue" | "refuse";
}

export interface GraphListResponse {
	items: Graph[];
	total: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup — created to answering
// (docs/for-developers/modules/platform/features/setup.md)
//
// Mirrors `invana.graphs.schemas`. The engine decides what is required and what
// each step waits on; this file only names the shapes, and the labels live with
// the surface that draws them (`features/setup/setupSteps.ts`).
// ─────────────────────────────────────────────────────────────────────────────

export type SetupSection =
	| "graph_info"
	| "model"
	| "datasets"
	| "providers"
	| "instructions"
	| "skills";

/** In the order they are drawn. */
export const SETUP_SECTIONS: readonly SetupSection[] = [
	"graph_info",
	"model",
	"datasets",
	"providers",
	"instructions",
	"skills",
] as const;
export const SETUP_REQUIRED: readonly SetupSection[] = [
	"graph_info",
	"model",
	"datasets",
	"providers",
] as const;
export const SETUP_SKIPPABLE: readonly SetupSection[] = [
	"instructions",
	"skills",
] as const;

/** Setup is three gates, not one list (SU3). A gate is named for what it
 *  unlocks, so a surface waits on the one it needs rather than on all of them. */
export type SetupGate = "connected" | "grounded" | "answering";

export const SETUP_GATES: readonly {
	gate: SetupGate;
	sections: readonly SetupSection[];
}[] = [
	{ gate: "connected", sections: ["graph_info"] },
	{ gate: "grounded", sections: ["model", "datasets"] },
	{ gate: "answering", sections: ["providers"] },
] as const;

/** Where one setup step stands. `blocked` and `broken` are the two the engine
 *  now distinguishes: one has not been started because something else has to
 *  land first (SU12), the other was done and stopped being true. */
export type SetupSectionStatus =
	| "done"
	| "broken"
	| "skipped"
	| "blocked"
	| "todo";

export function setupSectionStatus(
	state: SetupSectionState | undefined,
): SetupSectionStatus {
	if (state?.done) return state.broken ? "broken" : "done";
	if (state?.skipped_at) return "skipped";
	if (state?.blocked_by) return "blocked";
	return "todo";
}

/**
 * Mirror of the engine's `is_setup_complete` (graphs/services.py): a graph is
 * **ready** — it can be asked a question — once every required step is done.
 */
export function isSetupComplete(graph: Graph): boolean {
	return SETUP_REQUIRED.every((s) => !!graph.setup_state?.[s]?.done);
}

/**
 * Mirror of the engine's `is_gate_open`. Ask this, not `isSetupComplete`, when
 * gating one surface: the Model panel needs `connected`, the Assistant needs
 * `answering`, and neither needs the other's steps.
 */
export function isGateOpen(graph: Graph, gate: SetupGate): boolean {
	const entry = SETUP_GATES.find((g) => g.gate === gate);
	return !!entry?.sections.every((s) => !!graph.setup_state?.[s]?.done);
}

/**
 * Whether setup still has anything to say — any step that is neither done nor
 * skipped, including one that is blocked or has broken.
 *
 * It is the *whole* sequence, not the required half: the board holds while an
 * optional step is outstanding, because skipping is how an offer is resolved and
 * a skip needs somewhere to be taken back (SU15 · G26).
 */
export function hasOutstandingSetup(graph: Graph | undefined): boolean {
	if (!graph) return false;
	return SETUP_SECTIONS.some((section) => {
		const status = setupSectionStatus(graph.setup_state?.[section]);
		return status === "todo" || status === "blocked" || status === "broken";
	});
}

/** The sections a gate is still waiting on — what a lock names back to the
 *  reader (SU13). */
export function missingForGate(graph: Graph, gate: SetupGate): SetupSection[] {
	const entry = SETUP_GATES.find((g) => g.gate === gate);
	return (entry?.sections ?? []).filter((s) => !graph.setup_state?.[s]?.done);
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
	// Which database on the server this Graph reads (docs/for-developers/modules/connect-and-model/features/connect-a-database.md CD8).
	// Null means the connector's own default — never an invented name.
	database: string | null;
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
	// Backend property-type capabilities + version compatibility (docs/for-developers/modules/graph-connectors/features/capabilities.md).
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
	// Blank/null means "the connector's default". Unlike `auth`, a blank value is
	// never read as "unchanged" — it clears the stored name (CD8).
	database?: string | null;
	// Empty object means "keep existing credentials" on PUT-edit (server treats
	// falsy auth as no-op). On create, send {username, password}.
	auth: { username: string; password: string } | Record<string, never>;
	read_only: boolean;
	// Optional manually-declared DB version (docs/for-developers/modules/graph-connectors/features/capabilities.md) — fallback when the backend
	// can't be auto-detected. Auto-detection on connect overrides it; omit/blank
	// to rely on detection.
	server_version?: string | null;
}
