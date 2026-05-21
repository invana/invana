import type {
	LLMPingResponse,
	LLMProvider,
	LLMProviderCreate,
	LLMProviderListResponse,
	LLMProviderUpdate,
} from "../../types/llm";
import { request } from "./client";

function base(username: string, graphSlug: string): string {
	return `/api/v1/u/${username}/${graphSlug}/llm`;
}

export const llmProvidersApi = {
	list: (username: string, graphSlug: string) =>
		request<LLMProviderListResponse>(base(username, graphSlug)),

	get: (username: string, graphSlug: string, id: string) =>
		request<LLMProvider>(`${base(username, graphSlug)}/${id}`),

	create: (username: string, graphSlug: string, data: LLMProviderCreate) =>
		request<LLMProvider>(base(username, graphSlug), {
			method: "POST",
			body: JSON.stringify(data),
		}),

	update: (
		username: string,
		graphSlug: string,
		id: string,
		data: LLMProviderUpdate,
	) =>
		request<LLMProvider>(`${base(username, graphSlug)}/${id}`, {
			method: "PATCH",
			body: JSON.stringify(data),
		}),

	remove: (username: string, graphSlug: string, id: string) =>
		request<void>(`${base(username, graphSlug)}/${id}`, {
			method: "DELETE",
		}),

	ping: (username: string, graphSlug: string, id: string) =>
		request<LLMPingResponse>(`${base(username, graphSlug)}/${id}/ping`, {
			method: "POST",
		}),

	setDefault: (username: string, graphSlug: string, id: string) =>
		request<LLMProvider>(`${base(username, graphSlug)}/${id}/set-default`, {
			method: "POST",
		}),
};
