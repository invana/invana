// ── Query request ─────────────────────────────────────────────────────────────

export interface QueryRequest {
	query: string;
	parameters?: Record<string, unknown>;
}

// ── Graph data types (mirrors engine's Vertex / Edge / GraphResponse) ─────────

export interface GraphVertex {
	id: string;
	label: string;
	properties: Record<string, unknown>;
}

export interface GraphEdge {
	id: string;
	label: string;
	source: string;
	target: string;
	properties: Record<string, unknown>;
}

export interface GraphData {
	nodes: GraphVertex[];
	edges: GraphEdge[];
	records: Record<string, unknown>[];
}

// ── Local canvas item (adds type discriminator for rendering) ─────────────────

export interface QueryResultItem {
	id: string;
	label: string;
	type: "vertex" | "edge";
	properties: Record<string, unknown>;
	source?: string; // edge only
	target?: string; // edge only
}

// ── Query response ────────────────────────────────────────────────────────────

export interface QueryResponse {
	result_type: "graph" | "tabular";
	query_language: "cypher" | "gremlin";
	data: GraphData | null; // when result_type === "graph"
	rows: Record<string, unknown>[] | null; // when result_type === "tabular"
	execution_time_ms: number;
	row_count: number;
}

// ── Session history entry ─────────────────────────────────────────────────────

export interface QueryHistoryEntry {
	id: string;
	query: string;
	language: "cypher" | "gremlin";
	executedAt: Date;
	rowCount: number;
	executionTimeMs: number;
}
