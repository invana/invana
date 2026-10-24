import { type ListQuery, listQueryToApi, request } from "@invana-studio/core";
import type {
	FunctionCallsPage,
	FunctionRead,
	McpServerRead,
	PluginDetail,
	PluginPage,
	PluginSummary,
} from "./types";

const PLUGINS = "/api/v1/plugins";

/**
 * The install's plugin registry. Enabling and disabling are an install
 * Admin's acts, and only on a plugin the engine marks `switchable`; so are
 * adding an MCP server and refreshing its frozen tools.
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

	/** Add an MCP server by name and URL; it is stored disabled, its tools frozen. */
	addMcp: (body: { name: string; url: string }) =>
		request<McpServerRead>(`${PLUGINS}/mcp`, {
			method: "POST",
			body: JSON.stringify(body),
		}),

	/** List a server's tools again, as its next revision. */
	refreshMcp: (server: string) =>
		request<McpServerRead>(
			`${PLUGINS}/mcp/${encodeURIComponent(server)}/refresh`,
			{ method: "POST" },
		),
};

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
