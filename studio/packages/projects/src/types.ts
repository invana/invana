/**
 * The engine's project and Todo records: a project and its assignment, the
 * Todos inside it with their plan (waves, dependencies, the critical path) and
 * activity tree. A *task* here is the unit of assignable work a person sees;
 * a runtime step inside a run is never called one. Shapes mirror the engine's
 * work schemas field for field.
 */

import type { OfferedRule } from "@invana-studio/core";

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
	type: ProjectType;
	/** The one thing the project decides. */
	question: string;
	visibility: Visibility;
	/** The type's words for branches, evidence, verdicts and decisions. */
	words: ProjectWords | null;
}

/** Every type the engine knows; only `LAUNCHED_TYPES` can be created. */
export type ProjectType =
	| "research"
	| "investment"
	| "policy"
	| "market"
	| "investigation"
	| "general";

export type Visibility = "graph" | "private";

interface ProjectWords {
	branch: string;
	evidence: string;
	verdicts: Record<Verdict, string>;
	choices: Record<Choice, string>;
	opens_first: string[];
}

export interface ProjectListResponse {
	items: Project[];
	total: number;
}

export interface ProjectCreate {
	name: string;
	key?: string;
	description?: string;
	type?: ProjectType;
	question?: string;
	/** The first branch's title — the question as asked when empty. */
	first_branch?: string | null;
	visibility?: Visibility;
}

export interface ProjectUpdate {
	name?: string;
	description?: string;
	status?: "active" | "archived";
	question?: string;
	visibility?: Visibility;
}

// ── Branches, findings, decisions ────────────────────────────────────────────

export type BranchStatus =
	| "open"
	| "pursuing"
	| "parked"
	| "dropped"
	| "merged";
export type Stance = "supports" | "contradicts" | "context";
export type Verdict = "supported" | "refuted" | "inconclusive";
export type Choice = "pursue" | "park" | "drop" | "merge";

export interface Branch {
	id: string;
	project_id: string;
	/** One counter per project — what people type (`b3`). */
	number: number;
	parent_number: number | null;
	title: string;
	/** The hypothesis, option or lead, in the author's words. */
	body: string;
	status: BranchStatus;
	merged_into_number: number | null;
	current_decision: number | null;
	supports: number;
	contradicts: number;
	context: number;
	created_by_kind: string;
	created_by_id: string | null;
	created_at: string;
}

export interface Cite {
	kind: "record" | "dataset" | "run";
	/** A record id, `publisher/name@v`, or a run id. */
	ref: string;
	version_id?: string | null;
}

export interface Finding {
	id: string;
	project_id: string;
	number: number;
	/** The branch it was added on. */
	branch_number: number | null;
	statement: string;
	stance: Stance;
	cites: Cite[];
	added_by_kind: "user" | "agent";
	added_by_id: string | null;
	reviewed_by_id: string | null;
	reviewed_at: string | null;
	/** How it reached the branch being read: `own`, `fork` or `merge`. */
	via: "own" | "fork" | "merge" | null;
	created_at: string;
}

interface DecisionCheck {
	rule_id: string;
	version: number;
	statement: string;
	mode: string;
	passed: boolean;
	reason: string | null;
}

export interface Decision {
	id: string;
	project_id: string;
	project_key: string | null;
	number: number;
	branch_number: number | null;
	verdict: Verdict;
	verdict_label: string | null;
	choice: Choice;
	choice_label: string | null;
	rationale: string;
	/** Finding numbers. */
	cites: number[];
	addresses: number[];
	into_number: number | null;
	supersedes_number: number | null;
	superseded_by_number: number | null;
	checks: DecisionCheck[];
	warnings: string[];
	decided_by_id: string | null;
	created_at: string;
}

export interface Proposal {
	id: string;
	project_id: string;
	number: number;
	branch_number: number | null;
	kind: "fork" | "decision";
	payload: {
		titles?: string[];
		decision?: Partial<DecisionCreate>;
	} & Record<string, unknown>;
	rationale: string;
	status: "open" | "accepted" | "rejected";
	agent_id: string | null;
	submitted_by_id: string | null;
	resolved_by_id: string | null;
	resolved_at: string | null;
	note: string;
	created_at: string;
}

export interface BranchDetail {
	branch: Branch;
	children: number[];
	findings: Finding[];
	decisions: Decision[];
	proposals: Proposal[];
}

export interface FindingCreate {
	statement: string;
	stance: Stance;
	cites?: Cite[];
}

export interface DecisionCreate {
	verdict: Verdict;
	choice: Choice;
	rationale: string;
	cites?: number[] | null;
	addresses?: number[];
	supersedes?: number | null;
	into?: number | null;
	carry?: number[] | null;
}

/** The part of a dataset read lineage needs: what it is, and who wrote it. */
export interface LineageDataset {
	publisher: string;
	name: string;
	title: string;
	origin: string;
	licence: string | null;
	author_chain: {
		role: "original" | "collected_by" | "modified_by" | "validated_by";
		kind: "organisation" | "page" | "person" | "agent" | "run";
		name: string;
		ref?: string | null;
	}[];
}

// ── Simulation ───────────────────────────────────────────────────────────────

/** One field a simulator's spec takes; `type` is `int · float · str · bool · list · obj`. */
export interface SpecField {
	name: string;
	type: string;
	required: boolean;
	default: unknown;
	label: string;
}

/** One installed simulator, as `GET /simulators` lists it. */
export interface Simulator {
	key: string;
	version: string;
	plugin: string;
	plugin_version: string;
	/** The plugin's short name. */
	handle: string;
	title: string;
	summary: string;
	spec: SpecField[];
}

export interface SimulationCreate {
	/** A simulator key, `key@version`, or its plugin's short name. */
	simulator: string;
	spec: Record<string, unknown>;
	/** `publisher/name@v` of each dataset version it reads. */
	inputs: string[];
	seed?: number | null;
}

/** One trait's figures on a ranked row. */
interface TraitFigures {
	mean?: number;
	sd?: number;
	/** Share of progeny meeting the trait's target, 0–1. */
	meets?: number;
}

/**
 * One ranked row. The simulator's own shape: a label (`cross`), `meets_all`
 * (0–1) and per-trait figures; any other key is a plain figure.
 */
export type RankedRow = Record<string, unknown> & {
	cross?: string;
	meets_all?: number;
	traits?: Record<string, TraitFigures>;
};

export interface Simulation {
	number: number;
	branch: number;
	simulator: {
		key: string;
		version: string;
		plugin: string;
		plugin_version: string;
		title: string;
	};
	spec: Record<string, unknown>;
	seed: number;
	inputs: {
		ref: string;
		dataset_id: string;
		version_id: string;
		content_hash: string;
	}[];
	origin: "derived";
	run_id: string | null;
	/** The run's: `queued · running · succeeded · failed · cancelled`. */
	status: string | null;
	outcome: string | null;
	error: string | null;
	result: { ranked: RankedRow[]; summary: Record<string, unknown> } | null;
	tokens: number;
	created_by_id: string | null;
	created_at: string;
	started_at: string | null;
	finished_at: string | null;
	/** The engine's stored `started → finished`; null until it has finished. */
	duration_ms: number | null;
}

/** What Save as dataset writes: the dataset, then its first version. */
export interface DerivedDatasetCreate {
	dataset: {
		name: string;
		title: string;
		description: string;
		origin: "derived";
		key_column: string;
	};
	version: {
		licence: string;
		records: Record<string, unknown>[];
		derived_from: string[];
		author_chain: LineageDataset["author_chain"];
		why?: string;
	};
}

// ── Impact ───────────────────────────────────────────────────────────────────

/** A graph record as the Explorer's expand reads it. */
export interface ReachVertex {
	id: string;
	label: string;
	properties: Record<string, unknown>;
}

export interface ReachEdge {
	id: string;
	label: string;
	source: string;
	target: string;
}

/** One expand read — a record's neighbours, and how many it has in all. */
export interface NeighbourRead {
	data: { nodes: ReachVertex[]; edges: ReachEdge[] };
	total: number;
	returned: number;
	has_more: boolean;
	run_id: string | null;
}

// ── Reports ──────────────────────────────────────────────────────────────────

export interface Report {
	project_key: string;
	draft: string;
	draft_updated_at: string | null;
	draft_updated_by_id: string | null;
	versions: {
		version: number;
		published_at: string;
		published_by_id: string | null;
	}[];
}

export interface ReportVersion {
	version: number;
	body: string;
	cites: { ref: string; version_id: string }[];
	/** Cited dataset refs whose version was retracted since publishing. */
	retracted: string[];
	published_at: string;
	published_by_id: string | null;
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
	/** The branch of its project it was filed on, if any. */
	branch_id: string | null;
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
	/** A branch number of `project_key`'s project. */
	branch?: number | null;
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
