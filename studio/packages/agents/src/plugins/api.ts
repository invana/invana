import { type ListQuery, listQueryToApi, request } from "@invana-studio/core";
import type {
	PluginDetail,
	PluginPage,
	PluginSummary,
	TaskTypeRead,
} from "./types";

const PLUGINS = "/api/v1/plugins";

/**
 * The install's plugin registry. Enabling and disabling are an install
 * Admin's acts, and only on a plugin the engine marks `switchable`.
 */
export const pluginsApi = {
	/** One page of the registry — searched, filtered and sorted by the engine. */
	list: (query: ListQuery = {}) =>
		request<PluginPage>(`${PLUGINS}${listQueryToApi(query)}`),

	get: (name: string) =>
		request<PluginDetail>(`${PLUGINS}/${encodeURIComponent(name)}`),

	setEnabled: (name: string, enabled: boolean) =>
		request<PluginSummary>(
			`${PLUGINS}/${encodeURIComponent(name)}/${enabled ? "enable" : "disable"}`,
			{ method: "POST" },
		),

	taskType: (ref: string) =>
		request<TaskTypeRead>(`/api/v1/task-types/${encodeURIComponent(ref)}`),
};
