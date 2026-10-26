import { type ListQuery, listQueryToApi, request } from "@invana-studio/core";
import type {
	McpCallPage,
	McpServerInfo,
	ServedKind,
	ServedPage,
	ServedRead,
} from "./types";

const server = (username: string, graphSlug: string) =>
	`/api/v1/u/${username}/${graphSlug}/connections/server`;

/**
 * This Graph's MCP server: the endpoint card, what it serves and its recent
 * calls are any member's reads; flipping a Served switch is the *build* area.
 */
export const mcpServerApi = {
	info: (username: string, graphSlug: string) =>
		request<McpServerInfo>(server(username, graphSlug)),

	/** Every candidate with its switch; `f.kind` narrows to agents or functions. */
	served: (username: string, graphSlug: string, query: ListQuery = {}) =>
		request<ServedPage>(
			`${server(username, graphSlug)}/served${listQueryToApi(query)}`,
		),

	setServed: (
		username: string,
		graphSlug: string,
		kind: ServedKind,
		ref: string,
		served: boolean,
	) =>
		request<ServedRead>(
			`${server(username, graphSlug)}/served/${kind}/${encodeURIComponent(ref)}`,
			{ method: "PUT", body: JSON.stringify({ served }) },
		),

	/** The newest calls; `total` counts every call the Graph has had. */
	calls: (username: string, graphSlug: string, limit = 20) =>
		request<McpCallPage>(`${server(username, graphSlug)}/calls?limit=${limit}`),
};
