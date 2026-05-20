import type {
	GraphCreate,
	GraphListResponse,
	GraphRead,
	GraphUpdate,
} from "../../types/graphs";
import type { QueryRequest, QueryResponse } from "../../types/query";
import { request } from "./client";

export const graphsApi = {
	list: () => request<GraphListResponse>("/api/v1/graph-connections"),

	get: (id: string) => request<GraphRead>(`/api/v1/graph-connections/${id}`),

	create: (data: GraphCreate) =>
		request<GraphRead>("/api/v1/graph-connections", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	update: (id: string, data: GraphUpdate) =>
		request<GraphRead>(`/api/v1/graph-connections/${id}`, {
			method: "PATCH",
			body: JSON.stringify(data),
		}),

	remove: (id: string) =>
		request<void>(`/api/v1/graph-connections/${id}`, { method: "DELETE" }),

	reconnect: (id: string) =>
		request<GraphRead>(`/api/v1/graph-connections/${id}/reconnect`, {
			method: "POST",
		}),

	// Query route still lives at /api/v1/graphs/{id}/query on the engine
	// (server/routes/query.py); S5 will move it under /u/:username/:slug/query.
	query: (id: string, body: QueryRequest) =>
		request<QueryResponse>(`/api/v1/graphs/${id}/query`, {
			method: "POST",
			body: JSON.stringify(body),
		}),
};
