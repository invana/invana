import { request } from "@/services/api/client";
import type {
	LLMModel,
	LLMModelCreate,
	LLMModelListResponse,
	LLMPingResponse,
	LLMProvider,
	LLMProviderCreate,
	LLMProviderListResponse,
	LLMProviderUpdate,
} from "@/types/llm";

function base(username: string, graphSlug: string): string {
	return `/api/v1/u/${username}/${graphSlug}/llm`;
}

/**
 * The endpoints a Graph is configured with, and the models each one offers.
 *
 * **There is no `setDefault`.** `POST …/{id}/set-default` is retired: the lens
 * `cast` answers *which model when nobody said* (PM4), so a default here would
 * be a second mechanism picking a model. Removing a model a cast names is
 * refused by the engine, naming the worlds (PM11).
 */
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

	listModels: (username: string, graphSlug: string, id: string) =>
		request<LLMModelListResponse>(`${base(username, graphSlug)}/${id}/models`),

	addModel: (
		username: string,
		graphSlug: string,
		id: string,
		data: LLMModelCreate,
	) =>
		request<LLMModel>(`${base(username, graphSlug)}/${id}/models`, {
			method: "POST",
			body: JSON.stringify(data),
		}),

	/** Refused while a world casts it — the refusal names the worlds (PM11). */
	removeModel: (
		username: string,
		graphSlug: string,
		id: string,
		modelRowId: string,
	) =>
		request<void>(`${base(username, graphSlug)}/${id}/models/${modelRowId}`, {
			method: "DELETE",
		}),
};
