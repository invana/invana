import type {
	Graph,
	GraphConnectionCreate,
	GraphConnectionListResponse,
	GraphConnectionRead,
	GraphConnectionUpdate,
	GraphCreate,
	GraphListResponse,
	GraphUpdate,
	SetupSection,
} from "../../types/graphs";
import type { QueryRequest, QueryResponse } from "../../types/query";
import { request } from "./client";

// ─────────────────────────────────────────────────────────────────────────────
// Graph container API (RFC-017)
// ─────────────────────────────────────────────────────────────────────────────

export const graphsApi = {
	list: () => request<GraphListResponse>("/api/v1/graphs"),

	get: (username: string, slug: string) =>
		request<Graph>(`/api/v1/u/${username}/${slug}`),

	create: (data: GraphCreate) =>
		request<Graph>("/api/v1/graphs", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	update: (username: string, slug: string, data: GraphUpdate) =>
		request<Graph>(`/api/v1/u/${username}/${slug}`, {
			method: "PATCH",
			body: JSON.stringify(data),
		}),

	remove: (username: string, slug: string) =>
		request<void>(`/api/v1/u/${username}/${slug}`, { method: "DELETE" }),

	setSetupSection: (
		username: string,
		slug: string,
		section: SetupSection,
		action: "complete" | "skip" | "reset",
	) =>
		request<Graph>(`/api/v1/u/${username}/${slug}/setup/${section}`, {
			method: "POST",
			body: JSON.stringify({ action }),
		}),

	// Connection sub-resource — 1:1 child of the Graph.
	getConnection: (username: string, slug: string) =>
		request<GraphConnectionRead | null>(
			`/api/v1/u/${username}/${slug}/connection`,
		),

	putConnection: (
		username: string,
		slug: string,
		data: GraphConnectionCreate,
	) =>
		request<GraphConnectionRead>(`/api/v1/u/${username}/${slug}/connection`, {
			method: "PUT",
			body: JSON.stringify(data),
		}),

	deleteConnection: (username: string, slug: string) =>
		request<void>(`/api/v1/u/${username}/${slug}/connection`, {
			method: "DELETE",
		}),

	pingConnection: (username: string, slug: string) =>
		request<{ detail: string }>(
			`/api/v1/u/${username}/${slug}/connection/ping`,
			{
				method: "POST",
			},
		),

	testConnection: (
		username: string,
		slug: string,
		data: GraphConnectionCreate,
	) =>
		request<{ ok: boolean; latency_ms?: number; error?: string }>(
			`/api/v1/u/${username}/${slug}/connection/test`,
			{ method: "POST", body: JSON.stringify(data) },
		),

	// Query — graph-scoped (S2 re-prefix).
	query: (username: string, slug: string, body: QueryRequest) =>
		request<QueryResponse>(`/api/v1/u/${username}/${slug}/query`, {
			method: "POST",
			body: JSON.stringify(body),
		}),
};

// ─────────────────────────────────────────────────────────────────────────────
// GraphConnection API (legacy /api/v1/graph-connections surface)
//
// To be retired once every Studio call site moves to graphsApi.*Connection.
// ─────────────────────────────────────────────────────────────────────────────

export const graphConnectionsApi = {
	list: () => request<GraphConnectionListResponse>("/api/v1/graph-connections"),

	get: (id: string) =>
		request<GraphConnectionRead>(`/api/v1/graph-connections/${id}`),

	create: (data: GraphConnectionCreate) =>
		request<GraphConnectionRead>("/api/v1/graph-connections", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	update: (id: string, data: GraphConnectionUpdate) =>
		request<GraphConnectionRead>(`/api/v1/graph-connections/${id}`, {
			method: "PATCH",
			body: JSON.stringify(data),
		}),

	remove: (id: string) =>
		request<void>(`/api/v1/graph-connections/${id}`, { method: "DELETE" }),

	reconnect: (id: string) =>
		request<GraphConnectionRead>(`/api/v1/graph-connections/${id}/reconnect`, {
			method: "POST",
		}),

	// Legacy query shim — Explorer/Modeller now live at /u/:username/:slug/* but
	// still call /api/v1/graphs/{connection_id}/query under the hood. Retire
	// once the graph-scoped /u/.../query path replaces it end-to-end.
	query: (connectionId: string, body: QueryRequest) =>
		request<QueryResponse>(`/api/v1/graphs/${connectionId}/query`, {
			method: "POST",
			body: JSON.stringify(body),
		}),
};
