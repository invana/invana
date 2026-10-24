/**
 * The task-plan and catalogue endpoints: the catalogue a plan is composed from,
 * and the plans themselves — list, read, a version, diffs, export, performance
 * and runs over a window, promotion. The engine's route for plans is
 * `…/flows`. Each call is one `request` on the shared client.
 */

import type { Interaction } from "@invana-studio/core";
import { type ListQuery, listQueryToApi, request } from "@invana-studio/core";
import type {
	CataloguePage,
	FlowDetail,
	FlowPage,
	PlanPerformance,
	PlanRunsPage,
	PlanVersionDiff,
	PlanWindow,
} from "./types";

function base(username: string, graphSlug: string): string {
	return `/api/v1/u/${username}/${graphSlug}`;
}

const json = (body: unknown) => ({ body: JSON.stringify(body) });

/** The catalogue — the closed set a plan may name, read-only (7.6). */
export const catalogueApi = {
	list: (username: string, graphSlug: string, query: ListQuery = {}) =>
		request<CataloguePage>(
			`${base(username, graphSlug)}/catalogue${listQueryToApi(query)}`,
		),
};

/** The plan library — `flows` where `reusable`. */
export const flowsApi = {
	/** One page of the library — searched, filtered and sorted by the engine. */
	list: (username: string, graphSlug: string, query: ListQuery = {}) =>
		request<FlowPage>(
			`${base(username, graphSlug)}/flows${listQueryToApi(query)}`,
		),

	get: (username: string, graphSlug: string, key: string, version?: number) =>
		request<FlowDetail>(
			`${base(username, graphSlug)}/flows/${key}${version ? `?version=${version}` : ""}`,
		),

	/** How it has behaved over a window — Overview · Layers · Flow. */
	performance: (
		username: string,
		graphSlug: string,
		key: string,
		q: { version: number; window: PlanWindow },
	) =>
		request<PlanPerformance>(
			`${base(username, graphSlug)}/flows/${key}/performance?version=${q.version}&window=${q.window}`,
		),

	/** What changed against the version before it. */
	diff: (username: string, graphSlug: string, key: string, version: number) =>
		request<PlanVersionDiff>(
			`${base(username, graphSlug)}/flows/${key}/diff?version=${version}`,
		),

	/** Every run of it, newest first — Activity. */
	runs: (
		username: string,
		graphSlug: string,
		key: string,
		q: {
			version: number;
			window: PlanWindow;
			status?: string;
			calledBy?: string;
			agentId?: string;
			cursor?: string;
		},
	) => {
		const params = new URLSearchParams({
			version: String(q.version),
			window: q.window,
		});
		if (q.status) params.set("status", q.status);
		if (q.calledBy) params.set("called_by", q.calledBy);
		if (q.agentId) params.set("agent_id", q.agentId);
		if (q.cursor) params.set("cursor", q.cursor);
		return request<PlanRunsPage>(
			`${base(username, graphSlug)}/flows/${key}/runs?${params}`,
		);
	},

	/** The version as the engine holds it, as text — `Export YAML`. */
	exportText: (
		username: string,
		graphSlug: string,
		key: string,
		version: number,
	) =>
		request<string>(
			`${base(username, graphSlug)}/flows/${key}/export?version=${version}`,
		),

	exportUrl: (username: string, graphSlug: string, key: string) =>
		`${base(username, graphSlug)}/flows/${key}/export`,

	/** The one write in MVP — authoring a workflow stays post-1.0. */
	promote: (
		username: string,
		graphSlug: string,
		data: {
			run_id: string;
			key: string;
			description?: string;
			intents?: string[];
		},
		action?: Interaction,
	) =>
		request<FlowDetail>(`${base(username, graphSlug)}/flows/promote`, {
			method: "POST",
			...json(data),
			action,
		}),
};
