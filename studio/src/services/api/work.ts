import { request } from "@/services/api/client";
import type {
	Agent,
	AgentCreate,
	AgentLineage,
	AgentListResponse,
	AgentUpdate,
	Project,
	ProjectAssignment,
	ProjectCreate,
	ProjectListResponse,
	ProjectPlan,
	ProjectUpdate,
	RetirePreview,
	SkillUsage,
	Task,
	TaskActivity,
	TaskCreate,
	TaskListResponse,
	TaskPlanDetail,
	TaskPlanListResponse,
	TaskUpdate,
} from "@/types/work";

function base(username: string, graphSlug: string): string {
	return `/api/v1/u/${username}/${graphSlug}`;
}

const json = (body: unknown) => ({ body: JSON.stringify(body) });

export const agentsApi = {
	list: (
		username: string,
		graphSlug: string,
		opts: { includeEphemeral?: boolean; includeRetired?: boolean } = {},
	) => {
		const params = new URLSearchParams();
		// Spawned helpers are hidden by default — they are still fully present
		// in lineage and the trace (docs/for-developers/modules/work/spec.md).
		if (opts.includeEphemeral) params.set("include_ephemeral", "true");
		if (opts.includeRetired) params.set("include_retired", "true");
		const q = params.toString();
		return request<AgentListResponse>(
			`${base(username, graphSlug)}/agents${q ? `?${q}` : ""}`,
		);
	},

	get: (username: string, graphSlug: string, id: string) =>
		request<Agent>(`${base(username, graphSlug)}/agents/${id}`),

	create: (username: string, graphSlug: string, data: AgentCreate) =>
		request<Agent>(`${base(username, graphSlug)}/agents`, {
			method: "POST",
			...json(data),
		}),

	update: (
		username: string,
		graphSlug: string,
		id: string,
		data: AgentUpdate,
	) =>
		request<Agent>(`${base(username, graphSlug)}/agents/${id}`, {
			method: "PATCH",
			...json(data),
		}),

	remove: (username: string, graphSlug: string, id: string) =>
		request<void>(`${base(username, graphSlug)}/agents/${id}`, {
			method: "DELETE",
		}),

	/** Offer a skill to this agent. One skill, one agent — so a refusal names it. */
	bindSkill: (
		username: string,
		graphSlug: string,
		id: string,
		skillId: string,
	) =>
		request<Agent>(
			`${base(username, graphSlug)}/agents/${id}/skills/${skillId}`,
			{ method: "POST" },
		),

	/** Stop offering it. The next run is not offered it; one in flight is unaffected. */
	unbindSkill: (
		username: string,
		graphSlug: string,
		id: string,
		skillId: string,
	) =>
		request<Agent>(
			`${base(username, graphSlug)}/agents/${id}/skills/${skillId}`,
			{ method: "DELETE" },
		),

	pause: (username: string, graphSlug: string, id: string) =>
		request<Agent>(`${base(username, graphSlug)}/agents/${id}/pause`, {
			method: "POST",
		}),

	resume: (username: string, graphSlug: string, id: string) =>
		request<Agent>(`${base(username, graphSlug)}/agents/${id}/resume`, {
			method: "POST",
		}),

	/** What retiring would do — the confirm dialog names the open tasks. */
	retirePreview: (username: string, graphSlug: string, id: string) =>
		request<RetirePreview>(`${base(username, graphSlug)}/agents/${id}/retire`),

	retire: (
		username: string,
		graphSlug: string,
		id: string,
		reassign?: { reassign_to_kind: string; reassign_to_id: string },
	) =>
		request<Agent>(`${base(username, graphSlug)}/agents/${id}/retire`, {
			method: "POST",
			...json(reassign ?? {}),
		}),

	lineage: (username: string, graphSlug: string, id: string) =>
		request<AgentLineage>(`${base(username, graphSlug)}/agents/${id}/lineage`),

	setDefault: (username: string, graphSlug: string, agentId: string) =>
		request<Agent>(`${base(username, graphSlug)}/default-agent`, {
			method: "POST",
			...json({ agent_id: agentId }),
		}),
};

export const projectsApi = {
	list: (username: string, graphSlug: string) =>
		request<ProjectListResponse>(`${base(username, graphSlug)}/projects`),

	get: (username: string, graphSlug: string, key: string) =>
		request<Project>(`${base(username, graphSlug)}/projects/${key}`),

	create: (username: string, graphSlug: string, data: ProjectCreate) =>
		request<Project>(`${base(username, graphSlug)}/projects`, {
			method: "POST",
			...json(data),
		}),

	update: (
		username: string,
		graphSlug: string,
		key: string,
		data: ProjectUpdate,
	) =>
		request<Project>(`${base(username, graphSlug)}/projects/${key}`, {
			method: "PATCH",
			...json(data),
		}),

	remove: (username: string, graphSlug: string, key: string) =>
		request<void>(`${base(username, graphSlug)}/projects/${key}`, {
			method: "DELETE",
		}),

	assignments: (username: string, graphSlug: string, key: string) =>
		request<{ items: ProjectAssignment[]; total: number }>(
			`${base(username, graphSlug)}/projects/${key}/assignments`,
		),

	staff: (
		username: string,
		graphSlug: string,
		key: string,
		data: { principal_kind: "user" | "agent"; principal_id: string },
	) =>
		request<ProjectAssignment>(
			`${base(username, graphSlug)}/projects/${key}/assignments`,
			{ method: "POST", ...json(data) },
		),

	unstaff: (username: string, graphSlug: string, key: string, id: string) =>
		request<void>(
			`${base(username, graphSlug)}/projects/${key}/assignments/${id}`,
			{ method: "DELETE" },
		),

	/** The Plan tab and the Plan canvas are two renderings of this one call. */
	plan: (username: string, graphSlug: string, key: string) =>
		request<ProjectPlan>(`${base(username, graphSlug)}/projects/${key}/plan`),
};

export const tasksApi = {
	list: (
		username: string,
		graphSlug: string,
		filters: { project?: string; assignee?: string; status?: string[] } = {},
	) => {
		const params = new URLSearchParams();
		if (filters.project) params.set("project", filters.project);
		if (filters.assignee) params.set("assignee", filters.assignee);
		for (const s of filters.status ?? []) params.append("status", s);
		const q = params.toString();
		return request<TaskListResponse>(
			`${base(username, graphSlug)}/tasks${q ? `?${q}` : ""}`,
		);
	},

	get: (username: string, graphSlug: string, id: string) =>
		request<Task>(`${base(username, graphSlug)}/tasks/${id}`),

	create: (username: string, graphSlug: string, data: TaskCreate) =>
		request<Task>(`${base(username, graphSlug)}/tasks`, {
			method: "POST",
			...json(data),
		}),

	update: (username: string, graphSlug: string, id: string, data: TaskUpdate) =>
		request<Task>(`${base(username, graphSlug)}/tasks/${id}`, {
			method: "PATCH",
			...json(data),
		}),

	remove: (username: string, graphSlug: string, id: string) =>
		request<void>(`${base(username, graphSlug)}/tasks/${id}`, {
			method: "DELETE",
		}),

	start: (username: string, graphSlug: string, id: string) =>
		request<Task>(`${base(username, graphSlug)}/tasks/${id}/start`, {
			method: "POST",
		}),

	postResult: (
		username: string,
		graphSlug: string,
		id: string,
		summary: string,
	) =>
		request<Task>(`${base(username, graphSlug)}/tasks/${id}/result`, {
			method: "POST",
			...json({ summary }),
		}),

	accept: (username: string, graphSlug: string, id: string) =>
		request<Task>(`${base(username, graphSlug)}/tasks/${id}/accept`, {
			method: "POST",
		}),

	/** The note becomes a new Ask on the same task — append-only. */
	reject: (username: string, graphSlug: string, id: string, note: string) =>
		request<Task>(`${base(username, graphSlug)}/tasks/${id}/reject`, {
			method: "POST",
			...json({ note }),
		}),

	cancel: (username: string, graphSlug: string, id: string) =>
		request<Task>(`${base(username, graphSlug)}/tasks/${id}/cancel`, {
			method: "POST",
		}),

	/** The Plan canvas's one write. A cycle comes back as a 422 naming the loop. */
	addDependency: (
		username: string,
		graphSlug: string,
		id: string,
		dependsOnId: string,
	) =>
		request<Task>(`${base(username, graphSlug)}/tasks/${id}/dependencies`, {
			method: "POST",
			...json({ depends_on_id: dependsOnId }),
		}),

	removeDependency: (
		username: string,
		graphSlug: string,
		id: string,
		dependsOnId: string,
	) =>
		request<Task>(
			`${base(username, graphSlug)}/tasks/${id}/dependencies/${dependsOnId}`,
			{ method: "DELETE" },
		),

	activity: (username: string, graphSlug: string, id: string) =>
		request<TaskActivity>(`${base(username, graphSlug)}/tasks/${id}/activity`),
};

/** The plan library — `task_plans` where `reusable` (SR5 · LB5). */
export const workflowsApi = {
	list: (username: string, graphSlug: string) =>
		request<TaskPlanListResponse>(`${base(username, graphSlug)}/task-plans`),

	get: (username: string, graphSlug: string, key: string) =>
		request<TaskPlanDetail>(`${base(username, graphSlug)}/task-plans/${key}`),

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
	) =>
		request<TaskPlanDetail>(`${base(username, graphSlug)}/task-plans/promote`, {
			method: "POST",
			...json(data),
		}),
};

export const skillUsageApi = {
	get: (username: string, graphSlug: string, skillId: string) =>
		request<SkillUsage>(`${base(username, graphSlug)}/skills/${skillId}/usage`),
};
