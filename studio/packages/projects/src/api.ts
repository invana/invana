/**
 * The projects and Todos endpoints: projects (list, read, create, update, the
 * plan with its waves and critical path, assignment) and the Todos inside them
 * (list, read, create, update, dependencies, activity). The engine's routes are
 * `…/projects` and `…/tasks`. Each call is one `request` on the shared client.
 */

import { request } from "@invana-studio/core";
import type {
	Branch,
	BranchDetail,
	Decision,
	DecisionCreate,
	DerivedDatasetCreate,
	Finding,
	FindingCreate,
	LineageDataset,
	NeighbourRead,
	Project,
	ProjectAssignment,
	ProjectCreate,
	ProjectListResponse,
	ProjectPlan,
	ProjectUpdate,
	Proposal,
	Report,
	ReportVersion,
	Simulation,
	SimulationCreate,
	Simulator,
	Todo,
	TodoActivity,
	TodoCreate,
	TodoListResponse,
	TodoUpdate,
} from "./types";

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

/**
 * A project's records — branches, findings, decisions, proposals and its
 * report. Every one is addressed by its number inside the project.
 */
export const recordsApi = {
	branches: (username: string, graphSlug: string, key: string) =>
		request<{ items: Branch[]; total: number }>(
			`${base(username, graphSlug)}/projects/${key}/branches`,
		),

	branch: (username: string, graphSlug: string, key: string, n: number) =>
		request<BranchDetail>(
			`${base(username, graphSlug)}/projects/${key}/branches/${n}`,
		),

	fork: (
		username: string,
		graphSlug: string,
		key: string,
		n: number,
		titles: string[],
	) =>
		request<{ items: Branch[]; total: number }>(
			`${base(username, graphSlug)}/projects/${key}/branches/${n}/fork`,
			{ method: "POST", ...json({ titles }) },
		),

	addFinding: (
		username: string,
		graphSlug: string,
		key: string,
		n: number,
		data: FindingCreate,
	) =>
		request<Finding>(
			`${base(username, graphSlug)}/projects/${key}/branches/${n}/findings`,
			{ method: "POST", ...json(data) },
		),

	finding: (username: string, graphSlug: string, key: string, n: number) =>
		request<Finding>(
			`${base(username, graphSlug)}/projects/${key}/findings/${n}`,
		),

	review: (username: string, graphSlug: string, key: string, n: number) =>
		request<Finding>(
			`${base(username, graphSlug)}/projects/${key}/findings/${n}/review`,
			{ method: "POST" },
		),

	decide: (
		username: string,
		graphSlug: string,
		key: string,
		n: number,
		data: DecisionCreate,
	) =>
		request<Decision>(
			`${base(username, graphSlug)}/projects/${key}/branches/${n}/decisions`,
			{ method: "POST", ...json(data) },
		),

	decisions: (username: string, graphSlug: string, key: string) =>
		request<{ items: Decision[]; total: number }>(
			`${base(username, graphSlug)}/projects/${key}/decisions`,
		),

	/** Every decision on the Graph the reader may see, newest first. */
	graphDecisions: (username: string, graphSlug: string) =>
		request<{ items: Decision[]; total: number }>(
			`${base(username, graphSlug)}/decisions`,
		),

	resolveProposal: (
		username: string,
		graphSlug: string,
		key: string,
		n: number,
		act: "accept" | "reject",
	) =>
		request<Proposal>(
			`${base(username, graphSlug)}/projects/${key}/proposals/${n}/${act}`,
			{ method: "POST", ...json({ note: "" }) },
		),

	report: (username: string, graphSlug: string, key: string) =>
		request<Report>(`${base(username, graphSlug)}/projects/${key}/report`),

	saveDraft: (
		username: string,
		graphSlug: string,
		key: string,
		draft: string,
	) =>
		request<Report>(`${base(username, graphSlug)}/projects/${key}/report`, {
			method: "PUT",
			...json({ draft }),
		}),

	generate: (username: string, graphSlug: string, key: string) =>
		request<Report>(
			`${base(username, graphSlug)}/projects/${key}/report/generate`,
			{ method: "POST" },
		),

	publish: (username: string, graphSlug: string, key: string) =>
		request<ReportVersion>(
			`${base(username, graphSlug)}/projects/${key}/report/publish`,
			{ method: "POST" },
		),

	reportVersion: (
		username: string,
		graphSlug: string,
		key: string,
		version: number,
	) =>
		request<ReportVersion>(
			`${base(username, graphSlug)}/projects/${key}/report/versions/${version}`,
		),

	/**
	 * A cited dataset as lineage reads it — its origin and who wrote it. An
	 * install-wide record, read here rather than through the Datasets product,
	 * which this product may not import.
	 */
	dataset: (publisher: string, name: string) =>
		request<LineageDataset>(
			`/api/v1/datasets/${encodeURIComponent(publisher)}/${encodeURIComponent(name)}`,
		),
};

/**
 * Simulations on a project's branches, and the simulators installed
 * (simulation.md). A simulation opens a run and answers `202`; its result is
 * read back from `simulation` until the run settles.
 */
export const simulationsApi = {
	/** Every installed simulator — install-wide, not Graph-scoped. */
	simulators: () =>
		request<{ items: Simulator[]; total: number }>("/api/v1/simulators"),

	list: (
		username: string,
		graphSlug: string,
		key: string,
		branch?: number | null,
	) =>
		request<{ items: Simulation[]; total: number }>(
			`${base(username, graphSlug)}/projects/${key}/simulations${branch ? `?branch=${branch}` : ""}`,
		),

	get: (username: string, graphSlug: string, key: string, n: number) =>
		request<Simulation>(
			`${base(username, graphSlug)}/projects/${key}/simulations/${n}`,
		),

	simulate: (
		username: string,
		graphSlug: string,
		key: string,
		branch: number,
		data: SimulationCreate,
	) =>
		request<Simulation>(
			`${base(username, graphSlug)}/projects/${key}/branches/${branch}/simulations`,
			{ method: "POST", ...json(data) },
		),

	/**
	 * Save as dataset: the dataset, then its first version. Called directly —
	 * this product may not import Datasets.
	 */
	saveAsDataset: async (data: DerivedDatasetCreate) => {
		const made = await request<{ publisher: string; name: string }>(
			"/api/v1/datasets",
			{ method: "POST", ...json(data.dataset) },
		);
		await request<unknown>(
			`/api/v1/datasets/${encodeURIComponent(made.publisher)}/${encodeURIComponent(made.name)}/versions`,
			{ method: "POST", ...json(data.version) },
		);
		return made;
	},
};

/**
 * The graph reads Impact walks: one record's neighbours, through the
 * Explorer's expand (each read is a run under the Graph's lens). Called
 * directly — this product may not import the Explorer.
 */
export const reachApi = {
	neighbours: (
		username: string,
		graphSlug: string,
		vertexId: string,
		limit: number,
	) =>
		request<NeighbourRead>(
			`${base(username, graphSlug)}/explorer/expand/neighbors`,
			{
				method: "POST",
				...json({ vertex_id: vertexId, direction: "both", limit }),
			},
		),
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
