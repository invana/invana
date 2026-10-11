/**
 * The projects and Todos endpoints: projects (list, read, create, update, the
 * plan with its waves and critical path, assignment) and the Todos inside them
 * (list, read, create, update, dependencies, activity). The engine's routes are
 * `…/projects` and `…/tasks`. Each call is one `request` on the shared client.
 */

import type {
	Project,
	ProjectAssignment,
	ProjectCreate,
	ProjectListResponse,
	ProjectPlan,
	ProjectUpdate,
	Todo,
	TodoActivity,
	TodoCreate,
	TodoListResponse,
	TodoUpdate,
} from "@/pages/graphs-detail/features/projects/types";
import { request } from "@/services/api/client";

function base(username: string, graphSlug: string): string {
	return `/api/v1/u/${username}/${graphSlug}`;
}

const json = (body: unknown) => ({ body: JSON.stringify(body) });

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

export const todosApi = {
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
		return request<TodoListResponse>(
			`${base(username, graphSlug)}/tasks${q ? `?${q}` : ""}`,
		);
	},

	get: (username: string, graphSlug: string, id: string) =>
		request<Todo>(`${base(username, graphSlug)}/tasks/${id}`),

	create: (username: string, graphSlug: string, data: TodoCreate) =>
		request<Todo>(`${base(username, graphSlug)}/tasks`, {
			method: "POST",
			...json(data),
		}),

	update: (username: string, graphSlug: string, id: string, data: TodoUpdate) =>
		request<Todo>(`${base(username, graphSlug)}/tasks/${id}`, {
			method: "PATCH",
			...json(data),
		}),

	remove: (username: string, graphSlug: string, id: string) =>
		request<void>(`${base(username, graphSlug)}/tasks/${id}`, {
			method: "DELETE",
		}),

	start: (username: string, graphSlug: string, id: string) =>
		request<Todo>(`${base(username, graphSlug)}/tasks/${id}/start`, {
			method: "POST",
		}),

	postResult: (
		username: string,
		graphSlug: string,
		id: string,
		summary: string,
	) =>
		request<Todo>(`${base(username, graphSlug)}/tasks/${id}/result`, {
			method: "POST",
			...json({ summary }),
		}),

	accept: (username: string, graphSlug: string, id: string) =>
		request<Todo>(`${base(username, graphSlug)}/tasks/${id}/accept`, {
			method: "POST",
		}),

	/** The note becomes a new Ask on the same task — append-only. */
	reject: (username: string, graphSlug: string, id: string, note: string) =>
		request<Todo>(`${base(username, graphSlug)}/tasks/${id}/reject`, {
			method: "POST",
			...json({ note }),
		}),

	cancel: (username: string, graphSlug: string, id: string) =>
		request<Todo>(`${base(username, graphSlug)}/tasks/${id}/cancel`, {
			method: "POST",
		}),

	/** The Plan canvas's one write. A cycle comes back as a 422 naming the loop. */
	addDependency: (
		username: string,
		graphSlug: string,
		id: string,
		dependsOnId: string,
	) =>
		request<Todo>(`${base(username, graphSlug)}/tasks/${id}/dependencies`, {
			method: "POST",
			...json({ depends_on_id: dependsOnId }),
		}),

	removeDependency: (
		username: string,
		graphSlug: string,
		id: string,
		dependsOnId: string,
	) =>
		request<Todo>(
			`${base(username, graphSlug)}/tasks/${id}/dependencies/${dependsOnId}`,
			{ method: "DELETE" },
		),

	activity: (username: string, graphSlug: string, id: string) =>
		request<TodoActivity>(`${base(username, graphSlug)}/tasks/${id}/activity`),
};
