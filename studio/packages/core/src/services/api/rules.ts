import { listQueryToApi } from "../../lib/listQuery";
import type { ListQuery, Page } from "../../types/list";
import type {
	Rule,
	RuleCitationsResponse,
	RuleCreate,
	RuleImpact,
	RuleImpactRequest,
	RuleListResponse,
	RuleUpdate,
	RuleVersionListResponse,
} from "../../types/rules";
import { request } from "./client";

/** Rules hang off the graph and off a project, so they take the bare prefix. */
function graphBase(username: string, graphSlug: string): string {
	return `/api/v1/u/${username}/${graphSlug}`;
}

/** The install's rules live above Graphs; writing one is an install Admin's. */
const INSTALL = "/api/v1/rules";

const post = (data: unknown) => ({
	method: "POST",
	body: JSON.stringify(data),
});

export const rulesApi = {
	/**
	 * Every rule in force in this Graph — install, Graph and each project's —
	 * in assembly order, filtered by `scope` and `act`.
	 */
	list: (username: string, graphSlug: string, query: ListQuery = {}) =>
		request<Page<Rule>>(
			`${graphBase(username, graphSlug)}/rules${listQueryToApi(query)}`,
		),

	/** A Graph or project rule by id; an install rule is absent here. */
	get: (username: string, graphSlug: string, id: string) =>
		request<Rule>(`${graphBase(username, graphSlug)}/rules/${id}`),

	/** A Project's working rules, with the invariants it inherits. */
	listForProject: (username: string, graphSlug: string, key: string) =>
		request<RuleListResponse>(
			`${graphBase(username, graphSlug)}/projects/${key}/rules`,
		),

	create: (username: string, graphSlug: string, data: RuleCreate) =>
		request<Rule>(`${graphBase(username, graphSlug)}/rules`, post(data)),

	createForProject: (
		username: string,
		graphSlug: string,
		key: string,
		data: RuleCreate,
	) =>
		request<Rule>(
			`${graphBase(username, graphSlug)}/projects/${key}/rules`,
			post(data),
		),

	/** A new statement, check, mode or reason publishes the next version. */
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

	/** What a check would have broken over the last 30 days, in this Graph. */
	impact: (username: string, graphSlug: string, data: RuleImpactRequest) =>
		request<RuleImpact>(
			`${graphBase(username, graphSlug)}/rules/impact`,
			post(data),
		),

	/** The projects a working rule may sit on — key and name only. */
	projects: (username: string, graphSlug: string) =>
		request<{ items: { key: string; name: string }[] }>(
			`${graphBase(username, graphSlug)}/projects`,
		),

	versions: (username: string, graphSlug: string, id: string) =>
		request<RuleVersionListResponse>(
			`${graphBase(username, graphSlug)}/rules/${id}/versions`,
		),

	citations: (username: string, graphSlug: string, id: string) =>
		request<RuleCitationsResponse>(
			`${graphBase(username, graphSlug)}/rules/${id}/citations`,
		),

	/** The install's rules — offered in every Graph. */
	install: {
		create: (data: RuleCreate) => request<Rule>(INSTALL, post(data)),
		update: (id: string, data: RuleUpdate) =>
			request<Rule>(`${INSTALL}/${id}`, {
				method: "PATCH",
				body: JSON.stringify(data),
			}),
		setActive: (id: string, active: boolean) =>
			request<Rule>(`${INSTALL}/${id}/${active ? "activate" : "deactivate"}`, {
				method: "POST",
			}),
		/** Read in every Graph. */
		impact: (data: RuleImpactRequest) =>
			request<RuleImpact>(`${INSTALL}/impact`, post(data)),
	},
};
