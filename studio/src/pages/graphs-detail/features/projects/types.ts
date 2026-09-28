/**
 * The engine's project and Todo records: a project and its assignment, the
 * Todos inside it with their plan (waves, dependencies, the critical path) and
 * activity tree. A *task* here is the unit of assignable work a person sees;
 * a runtime step inside a run is never called one. Shapes mirror the engine's
 * work schemas field for field.
 */

import type { OfferedRule } from "@/pages/graphs-detail/features/skills";

// ── Projects ─────────────────────────────────────────────────────────────────

export interface Project {
	id: string;
	graph_id: string;
	key: string;
	name: string;
	description: string;
	status: "active" | "archived";
	created_by_kind: string;
	created_by_id: string | null;
	/** Resolved by the engine — the heading says a name, never an id. */
	created_by_name: string | null;
	created_at: string;
	updated_at: string;
	task_count: number;
	open_task_count: number;
}

export interface ProjectListResponse {
	items: Project[];
	total: number;
}

export interface ProjectCreate {
	name: string;
	key?: string;
	description?: string;
}

export interface ProjectUpdate {
	name?: string;
	description?: string;
	status?: "active" | "archived";
}

export interface ProjectAssignment {
	id: string;
	project_id: string;
	principal_kind: "user" | "agent";
	principal_id: string;
	principal_name: string | null;
	assigned_at: string;
}

// ── Tasks ────────────────────────────────────────────────────────────────────

type TodoStatus =
	| "open"
	| "assigned"
	| "in_progress"
	| "needs_input"
	| "blocked"
	| "review"
	| "done"
	| "failed"
	| "cancelled";

export interface Todo {
	id: string;
	graph_id: string;
	project_id: string | null;
	parent_id: string | null;
	title: string;
	/** The goal as prose — the intent an agent plans from. */
	body: string;
	acceptance: string;
	status: TodoStatus;
	assignee_kind: "user" | "agent" | null;
	assignee_id: string | null;
	created_by_kind: string;
	created_by_id: string | null;
	result: {
		summary?: string;
		run_ids?: string[];
		emitted?: { run_id: string; kind: string }[];
	} | null;
	blocked_reason: string | null;
	due_at: string | null;
	closed_at: string | null;
	created_at: string;
	updated_at: string;
	project_key: string | null;
	assignee_name: string | null;
	depends_on: string[];
	blocks: string[];
	sub_task_ids: string[];
	run_ids: string[];
}

export interface TodoListResponse {
	items: Todo[];
	total: number;
}

export interface TodoCreate {
	title: string;
	body?: string;
	acceptance?: string;
	project_key?: string | null;
	parent_id?: string | null;
	assignee_kind?: "user" | "agent" | null;
	assignee_id?: string | null;
	due_at?: string | null;
}

export interface TodoUpdate {
	title?: string;
	body?: string;
	acceptance?: string;
	project_key?: string | null;
	/** `"none"` unassigns — distinct from omitting the field. */
	assignee_kind?: "user" | "agent" | "none" | null;
	assignee_id?: string | null;
	due_at?: string | null;
}

/** One task's derived position — the Plan tab's row and the Plan canvas's card. */
export interface PlanTodo {
	id: string;
	title: string;
	status: TodoStatus;
	assignee_kind: "user" | "agent" | null;
	assignee_id: string | null;
	assignee_name: string | null;
	due_at: string | null;
	/** 1 + max(wave of dependencies). Tasks in one wave can run in parallel. */
	wave: number;
	order: number;
	blocked_by: string[];
	critical: boolean;
	project_key: string | null;
}

export interface ProjectPlan {
	project_key: string | null;
	tasks: PlanTodo[];
	edges: { source: string; target: string }[];
	critical_path: string[];
}

/** One row of the activity tree (docs/for-developers/modules/work/spec.md). */
export interface ActivityNode {
	id: string;
	kind: "event" | "step";
	action: string;
	label: string;
	detail: string;
	actor_kind: string | null;
	actor_id: string | null;
	actor_name: string | null;
	/** The human an agent acted for. Set by the engine, never by task input. */
	on_behalf_of_name: string | null;
	run_id: string | null;
	status: string | null;
	/** A fact: this prose was in the prompt. */
	skills_offered: string[];
	/** A self-report: the model says it followed these. The badge says *reported*. */
	skills_applied: string[];
	/** A fact: these statements were in the prompt. */
	rules_offered: OfferedRule[];
	/** A self-report: the model says it followed these. A subset of the above. */
	rules_cited: OfferedRule[];
	tokens_in: number | null;
	tokens_out: number | null;
	at: string | null;
	children: ActivityNode[];
}

export interface TodoActivity {
	task_id: string;
	nodes: ActivityNode[];
}
