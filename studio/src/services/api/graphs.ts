import type {
	Graph,
	GraphConnectionCreate,
	GraphConnectionRead,
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

	get: (username: string, graphSlug: string) =>
		request<Graph>(`/api/v1/u/${username}/${graphSlug}`),

	create: (data: GraphCreate) =>
		request<Graph>("/api/v1/graphs", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	update: (username: string, graphSlug: string, data: GraphUpdate) =>
		request<Graph>(`/api/v1/u/${username}/${graphSlug}`, {
			method: "PATCH",
			body: JSON.stringify(data),
		}),

	remove: (username: string, graphSlug: string) =>
		request<void>(`/api/v1/u/${username}/${graphSlug}`, { method: "DELETE" }),

	setSetupSection: (
		username: string,
		graphSlug: string,
		section: SetupSection,
		action: "complete" | "skip" | "reset",
	) =>
		request<Graph>(`/api/v1/u/${username}/${graphSlug}/setup/${section}`, {
			method: "POST",
			body: JSON.stringify({ action }),
		}),

	// Connection sub-resource — 1:1 child of the Graph.
	getConnection: (username: string, graphSlug: string) =>
		request<GraphConnectionRead | null>(
			`/api/v1/u/${username}/${graphSlug}/connection`,
		),

	putConnection: (
		username: string,
		graphSlug: string,
		data: GraphConnectionCreate,
	) =>
		request<GraphConnectionRead>(
			`/api/v1/u/${username}/${graphSlug}/connection`,
			{
				method: "PUT",
				body: JSON.stringify(data),
			},
		),

	deleteConnection: (username: string, graphSlug: string) =>
		request<void>(`/api/v1/u/${username}/${graphSlug}/connection`, {
			method: "DELETE",
		}),

	pingConnection: (username: string, graphSlug: string) =>
		request<{ detail: string }>(
			`/api/v1/u/${username}/${graphSlug}/connection/ping`,
			{ method: "POST" },
		),

	introspectConnection: (username: string, graphSlug: string) =>
		request<{ detail: string }>(
			`/api/v1/u/${username}/${graphSlug}/connection/introspect`,
			{ method: "POST" },
		),

	testConnection: (
		username: string,
		graphSlug: string,
		data: GraphConnectionCreate,
	) =>
		request<{ ok: boolean; latency_ms?: number; error?: string }>(
			`/api/v1/u/${username}/${graphSlug}/connection/test`,
			{ method: "POST", body: JSON.stringify(data) },
		),

	query: (username: string, graphSlug: string, body: QueryRequest) =>
		request<QueryResponse>(`/api/v1/u/${username}/${graphSlug}/query`, {
			method: "POST",
			body: JSON.stringify(body),
		}),
};
