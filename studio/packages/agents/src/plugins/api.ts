import { type ListQuery, listQueryToApi, request } from "@invana-studio/core";
import type { FunctionCallsPage, FunctionRead } from "./types";

const catalogue = (username: string, graphSlug: string, key: string) =>
	`/api/v1/u/${username}/${graphSlug}/catalogue/${encodeURIComponent(key)}`;

/**
 * A function's page, read in a Graph: its contract, the plans and skills
 * naming it, and its calls — the numbers are the engine's.
 */
export const functionsApi = {
	get: (username: string, graphSlug: string, key: string) =>
		request<FunctionRead>(catalogue(username, graphSlug, key)),

	/** One page of the run steps that called it, newest first. */
	calls: (
		username: string,
		graphSlug: string,
		key: string,
		query: ListQuery = {},
	) =>
		request<FunctionCallsPage>(
			`${catalogue(username, graphSlug, key)}/calls${listQueryToApi(query)}`,
		),
};
