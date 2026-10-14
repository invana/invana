import { request } from "@invana-studio/core";
import type {
	PluginDetail,
	PluginListResponse,
	PluginSummary,
	TaskTypeRead,
} from "./types";

const PLUGINS = "/api/v1/plugins";

/**
 * The install's plugin registry. Enabling and disabling are an install
 * Admin's acts, and only on a plugin the engine marks `switchable`.
 */
export const pluginsApi = {
	list: () => request<PluginListResponse>(PLUGINS),

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
