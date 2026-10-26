/** Requests — the routes under `…/requests`. */

import { request } from "@invana-studio/core";
import type {
	ModelRequest,
	RequestKind,
	RequestPage,
	RequestResolve,
} from "./types";

function base(username: string, graphSlug: string): string {
	return `/api/v1/u/${username}/${graphSlug}/requests`;
}

export interface RequestListParams {
	status?: "open" | "done";
	kind?: RequestKind;
	limit?: number;
}

export const requestsApi = {
	list: (u: string, g: string, params: RequestListParams = {}) => {
		const qs = new URLSearchParams();
		if (params.status) qs.set("status", params.status);
		if (params.kind) qs.set("kind", params.kind);
		if (params.limit) qs.set("limit", String(params.limit));
		const s = qs.toString();
		return request<RequestPage>(`${base(u, g)}${s ? `?${s}` : ""}`);
	},

	get: (u: string, g: string, id: string) =>
		request<ModelRequest>(`${base(u, g)}/${id}`),

	create: (u: string, g: string, data: { title: string; detail?: string }) =>
		request<ModelRequest>(base(u, g), {
			method: "POST",
			body: JSON.stringify(data),
		}),

	resolve: (u: string, g: string, id: string, data: RequestResolve) =>
		request<ModelRequest>(`${base(u, g)}/${id}/resolve`, {
			method: "POST",
			body: JSON.stringify(data),
		}),
};
