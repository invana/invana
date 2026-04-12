// ── Status ────────────────────────────────────────────────────────────────────

export type GraphStatus = "CONNECTING" | "ACTIVE" | "ERROR" | "INACTIVE";

// ── Connector classes — dotted Python import paths ────────────────────────────

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

// ── API shapes — mirror engine Pydantic schemas exactly ───────────────────────

export interface GraphRead {
	id: string;
	name: string;
	description: string;
	uri: string;
	connector_class: string;
	read_only: boolean;
	status: GraphStatus;
	last_health_check_at: string | null;
	latency_ms: number | null;
	schema_id: string | null;
	created_at: string;
	updated_at: string;
}

export interface GraphCreate {
	name: string;
	description?: string;
	uri: string;
	connector_class: string;
	auth: { username: string; password: string };
	read_only: boolean;
}

export interface GraphUpdate {
	name?: string;
	description?: string;
	uri?: string;
	auth?: { username: string; password: string };
	read_only?: boolean;
	// connector_class intentionally excluded — immutable after creation
}

export interface GraphListResponse {
	items: GraphRead[];
	total: number;
}
