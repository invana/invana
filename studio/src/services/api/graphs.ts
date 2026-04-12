import type {
	GraphCreate,
	GraphListResponse,
	GraphRead,
	GraphUpdate,
} from "../../types/graphs";
import { request } from "./client";

export const graphsApi = {
	list: () => request<GraphListResponse>("/api/v1/graphs"),

	get: (id: string) => request<GraphRead>(`/api/v1/graphs/${id}`),

	create: (data: GraphCreate) =>
		request<GraphRead>("/api/v1/graphs", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	update: (id: string, data: GraphUpdate) =>
		request<GraphRead>(`/api/v1/graphs/${id}`, {
			method: "PATCH",
			body: JSON.stringify(data),
		}),

	remove: (id: string) =>
		request<void>(`/api/v1/graphs/${id}`, { method: "DELETE" }),

	reconnect: (id: string) =>
		request<GraphRead>(`/api/v1/graphs/${id}/reconnect`, { method: "POST" }),
};
