/**
 * The task-plan and catalogue endpoints: the catalogue a plan is composed from,
 * and the plans themselves — list, read, a version, diffs, export, performance
 * and runs over a window, promotion. The engine's route for plans is
 * `…/workflows`. Each call is one `request` on the shared client.
 */

import type {
	CatalogueResponse,
	PlanPerformance,
	PlanRunsPage,
	PlanVersionDiff,
	PlanWindow,
	TaskPlanDetail,
	TaskPlanListResponse,
} from "@/pages/graphs-detail/features/plans/types";
import { request } from "@/services/api/client";
import type { Interaction } from "@/services/telemetry/tracer";

function base(username: string, graphSlug: string): string {
	return `/api/v1/u/${username}/${graphSlug}`;
}

const json = (body: unknown) => ({ body: JSON.stringify(body) });

/** The catalogue — the closed set a plan may name, read-only (7.6 · CA1). */
export const catalogueApi = {
	list: (username: string, graphSlug: string) =>
		request<CatalogueResponse>(`${base(username, graphSlug)}/catalogue`),
};

/** The plan library — `task_plans` where `reusable` (SR5 · LB5). */
export const taskPlansApi = {
	list: (username: string, graphSlug: string) =>
		request<TaskPlanListResponse>(`${base(username, graphSlug)}/task-plans`),

	get: (username: string, graphSlug: string, key: string, version?: number) =>
		request<TaskPlanDetail>(
			`${base(username, graphSlug)}/task-plans/${key}${version ? `?version=${version}` : ""}`,
		),

	/** How it has behaved over a window — Overview · Layers · Flow (LB33 · LB36). */
	performance: (
		username: string,
		graphSlug: string,
		key: string,
		q: { version: number; window: PlanWindow },
	) =>
		request<PlanPerformance>(
			`${base(username, graphSlug)}/task-plans/${key}/performance?version=${q.version}&window=${q.window}`,
		),

	/** What changed against the version before it (LB37). */
	diff: (username: string, graphSlug: string, key: string, version: number) =>
		request<PlanVersionDiff>(
			`${base(username, graphSlug)}/task-plans/${key}/diff?version=${version}`,
		),

	/** Every run of it, newest first — Activity (LB34). */
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
			`${base(username, graphSlug)}/task-plans/${key}/runs?${params}`,
		);
	},

	/** The version as the engine holds it, as text — `Export YAML` (LB38). */
	exportText: (
		username: string,
		graphSlug: string,
		key: string,
		version: number,
	) =>
		request<string>(
			`${base(username, graphSlug)}/task-plans/${key}/export?version=${version}`,
		),

	exportUrl: (username: string, graphSlug: string, key: string) =>
		`${base(username, graphSlug)}/task-plans/${key}/export`,

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
		request<TaskPlanDetail>(`${base(username, graphSlug)}/task-plans/promote`, {
			method: "POST",
			...json(data),
			action,
		}),
};
