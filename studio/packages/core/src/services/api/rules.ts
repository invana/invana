import type {
	Rule,
	RuleCitationsResponse,
	RuleCreate,
	RuleListResponse,
	RuleUpdate,
	RuleVersionListResponse,
} from "../../types/rules";
import { request } from "./client";

/** Rules hang off the graph and off a project, so they take the bare prefix. */
function graphBase(username: string, graphSlug: string): string {
	return `/api/v1/u/${username}/${graphSlug}`;
}

export const rulesApi = {
	/** A Graph's invariants. */
	list: (username: string, graphSlug: string) =>
		request<RuleListResponse>(`${graphBase(username, graphSlug)}/rules`),

	/** A Project's working rules, with the invariants it inherits. */
	listForProject: (username: string, graphSlug: string, key: string) =>
		request<RuleListResponse>(
			`${graphBase(username, graphSlug)}/projects/${key}/rules`,
		),

	create: (username: string, graphSlug: string, data: RuleCreate) =>
		request<Rule>(`${graphBase(username, graphSlug)}/rules`, {
			method: "POST",
			body: JSON.stringify(data),
		}),

	createForProject: (
		username: string,
		graphSlug: string,
		key: string,
		data: RuleCreate,
	) =>
		request<Rule>(`${graphBase(username, graphSlug)}/projects/${key}/rules`, {
			method: "POST",
			body: JSON.stringify(data),
		}),

	/** A rewording publishes the next version; a reorder edits the row. */
	update: (username: string, graphSlug: string, id: string, data: RuleUpdate) =>
		request<Rule>(`${graphBase(username, graphSlug)}/rules/${id}`, {
			method: "PATCH",
			body: JSON.stringify(data),
		}),

	/** There is no delete: past citations must still resolve. */
	setActive: (
		username: string,
		graphSlug: string,
		id: string,
		active: boolean,
	) =>
		request<Rule>(
			`${graphBase(username, graphSlug)}/rules/${id}/${active ? "activate" : "deactivate"}`,
			{ method: "POST" },
		),

	versions: (username: string, graphSlug: string, id: string) =>
		request<RuleVersionListResponse>(
			`${graphBase(username, graphSlug)}/rules/${id}/versions`,
		),

	citations: (username: string, graphSlug: string, id: string) =>
		request<RuleCitationsResponse>(
			`${graphBase(username, graphSlug)}/rules/${id}/citations`,
		),
};
