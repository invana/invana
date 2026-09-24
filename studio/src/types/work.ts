// ─────────────────────────────────────────────────────────────────────────────
// Agents · Projects · Tasks · Workflows — mirrors the engine's S12 schemas
// (docs/for-developers/modules/work/spec.md). Four nouns, one shape: each opens in the left panel and paints
// something on the canvas.
//
// The vocabulary is load-bearing (docs/for-developers/modules/work/spec.md):
//   Task  — a unit of assignable work. The user-facing word.
//   Step  — one attempt of one runtime callable inside a run. `task_key`
//           in code; the word *task* never means this in the UI.
// ─────────────────────────────────────────────────────────────────────────────

import type { OfferedRule, PlanArg, SkillLayer } from "@/types/skills";

// ── Agents ───────────────────────────────────────────────────────────────────

export type AgentKind = "seeded" | "authored" | "spawned";
export type AgentStatus = "active" | "paused" | "retired";
export type AgentLifetime = "persistent" | "ephemeral";

export interface Agent {
	id: string;
	graph_id: string;
	key: string | null;
	name: string;
	description: string;
	kind: AgentKind;
	status: AgentStatus;
	lifetime: AgentLifetime;
	instructions: string;
	/** The envelope: allow-list · pinned args · require · templates · budgets. */
	workflow_spec: Record<string, unknown>;
	/**
	 * The third bound: the world this agent works inside (AG2). **Null reads
	 * *Everything*, inside the guardrails** — never a blank (AG5). `lens_name`
	 * rides with the id so a row can draw a chip without a second fetch (AG8).
	 */
	lens_id: string | null;
	lens_name: string | null;
	/** Read-only — the bindings live in `skill_bindings`; change it with bind/unbind. */
	skill_ids: string[];
	budget: Record<string, number>;
	policy: Record<string, boolean>;
	parent_agent_id: string | null;
	spawned_in_run_id: string | null;
	version: number;
	created_by_kind: string;
	created_by_id: string | null;
	created_at: string;
	updated_at: string;
}

export interface AgentListResponse {
	items: Agent[];
	total: number;
	default_agent_id: string | null;
	/**
	 * `{agent_id: usd}` since the first of the month — what a row draws against
	 * `max_cost_usd_month` (C10). An agent with no **priced** run is absent, not
	 * zero: a subscription endpoint publishes no per-token rate, so *nothing
	 * spent* and *nothing known* are different facts (OB4).
	 */
	spend_this_month: Record<string, number>;
}

export interface AgentCreate {
	name: string;
	description?: string;
	instructions?: string;
	/** Start from a seeded agent's envelope — an empty allow-list can do nothing. */
	envelope_from?: string;
	workflow_spec?: Record<string, unknown>;
	/** Null is *Everything*, chosen — on update, omitting it keeps what is set (AG9). */
	lens_id?: string | null;
	/** The skills this agent starts with, bound as part of creating it. */
	skill_ids?: string[];
	budget?: Record<string, number>;
	policy?: Record<string, boolean>;
}

/** No `skill_ids`: binding is its own write, so that a refusal can name the one
 *  skill it rejected rather than a whole list. */
export type AgentUpdate = Partial<
	Omit<AgentCreate, "envelope_from" | "skill_ids">
>;

/** A lineage node. Heterogeneous by design — docs/for-developers/modules/agents/features/lineage.md */
export interface AgentNode {
	id: string;
	kind: "agent" | "user" | "task";
	label: string;
	agent_kind?: AgentKind | null;
	status?: string | null;
	lifetime?: AgentLifetime | null;
}

/** A causal hop. Selecting one is the point of the trace (docs/for-developers/modules/agents/features/lineage.md). */
export interface AgentEdge {
	id: string;
	source: string;
	target: string;
	kind: "authored" | "spawned" | "delegated_for" | "assigned";
	label: string;
	event_id?: string | null;
}

export interface AgentLineage {
	agent_id: string;
	nodes: AgentNode[];
	edges: AgentEdge[];
}

/** The two acts that disturb open work. Resume takes nothing away (LC10). */
export type LifecycleAct = "pause" | "retire";

/**
 * What an act does to one piece of open work — a closed vocabulary, because a
 * sentence per row is a sentence nobody can compare (LC9).
 */
export type LifecycleEffect = "finishes" | "blocked" | "unchanged" | "refused";

export interface LifecycleItem {
	kind: "run" | "task" | "session";
	id: string;
	title: string;
	effect: LifecycleEffect;
	/** The effect in a reader's words, about this item. */
	note: string;
}

/**
 * One shape for both acts (LC8): the same open work, carrying the effect *this*
 * act would have on it. Named, not counted — a count is not enough to decide
 * with, and a todo in review is where the two acts part.
 */
export interface LifecyclePreview {
	agent_id: string;
	act: LifecycleAct;
	items: LifecycleItem[];
}

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

export type TaskStatus =
	| "open"
	| "assigned"
	| "in_progress"
	| "needs_input"
	| "blocked"
	| "review"
	| "done"
	| "failed"
	| "cancelled";

export interface Task {
	id: string;
	graph_id: string;
	project_id: string | null;
	parent_id: string | null;
	title: string;
	/** The goal as prose — the intent an agent plans from. */
	body: string;
	acceptance: string;
	status: TaskStatus;
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

export interface TaskListResponse {
	items: Task[];
	total: number;
}

export interface TaskCreate {
	title: string;
	body?: string;
	acceptance?: string;
	project_key?: string | null;
	parent_id?: string | null;
	assignee_kind?: "user" | "agent" | null;
	assignee_id?: string | null;
	due_at?: string | null;
}

export interface TaskUpdate {
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
export interface PlanTask {
	id: string;
	title: string;
	status: TaskStatus;
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
	tasks: PlanTask[];
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
	/** A fact: these statements were in the prompt (RU7). */
	rules_offered: OfferedRule[];
	/** A self-report: the model says it followed these. A subset of the above (RU12). */
	rules_cited: OfferedRule[];
	tokens_in: number | null;
	tokens_out: number | null;
	at: string | null;
	children: ActivityNode[];
}

export interface TaskActivity {
	task_id: string;
	nodes: ActivityNode[];
}

// ── Workflows ────────────────────────────────────────────────────────────────

export interface AgentChip {
	id: string;
	name: string;
	status: AgentStatus;
}

/**
 * One governed band, and what a plan declares in it — the panel's *Layers it
 * declares* ([LB22](docs/for-developers/modules/workflows/features/the-library.md)).
 *
 * All five arrive, touched or not: *this plan reads no graph data* is the fact
 * a reader is checking for, and a band that vanished when empty would be
 * indistinguishable from one that failed to load.
 */
export interface TaskPlanLayer {
	layer: SkillLayer;
	declared: boolean;
	steps: number;
	/** `2 steps` · `1 crossing` · `—`. Phrased by the engine, like the band. */
	summary: string;
}

/** A caller that inlined this plan, and what it tuned (LB19). */
export interface TaskPlanCaller {
	/** `skill` when a skill version owns the calling plan, `plan` when none does. */
	kind: string;
	name: string;
	skill_id: string | null;
	/** The version of *this* plan it inlined — below the current one means the
	 *  library has moved on, which the panel says and never acts on (SK32). */
	version: number;
	args: Record<string, unknown>;
}

export interface TaskPlanSummary {
	id: string;
	/** Null unless reusable — a one-off plan is named by the Todo it serves. */
	key: string | null;
	version: number;
	name: string;
	description: string;
	/** The plan's subject: `ask · import · bulk · stitch · model · enrich`. */
	kind: string;
	/**
	 * How the plan got here. `builtin · authored · promoted` are the library's
	 * badge; `generated` is never listed — a one-off belongs to its Todo
	 * (the-library.md LB5 · LB6).
	 */
	origin: "builtin" | "authored" | "generated" | "promoted";
	intent: string[];
	reusable: boolean;
	todo_id: string | null;
	promoted_from_run_id: string | null;
	used_by: AgentChip[];
	step_count: number;
	/** Runs of this entry, and of the verified ones the share that served. */
	runs: number;
	/** `null` when nothing has been verified yet — never 0%: "never asked" and
	 * "asked and failed" are different facts. */
	served_rate: number | null;
	last_run_at: string | null;
	/** The bands this plan touches, in the strip's order — the row's chips. */
	layers: SkillLayer[];
	/** How many callers inline it. The row reads *used by 2 skills* where there
	 *  are callers, and falls back to how often it ran where there are none. */
	caller_count: number;
}

export interface TaskPlanStepSpec {
	id: string;
	task: string;
	label: string;
	args: Record<string, unknown>;
}

export interface TaskPlanDagNode extends TaskPlanStepSpec {
	/** `callable` · `composite` · `human`. */
	form: string;
	/** The band this node sits in — sent by the engine, never derived here,
	 *  which would be a second copy of the catalogue's `bound`. */
	layer: SkillLayer;
	/**
	 * Longest path from a root — the canvas column. Two steps at the same
	 * depth wait on the same thing, not on each other; the stored list order
	 * is not a dependency and is not drawn as one.
	 */
	depth: number;
	pinned: string[];
	/**
	 * A **count**, never a claim: a pin lives on one agent's envelope and a
	 * library entry is used by N, so `pinned` alone would be false as soon as
	 * N > 1 (docs/for-developers/modules/explore/features/selection-and-the-panel.md).
	 */
	pinned_by_count: number;
	pinned_by: AgentChip[];
}

export interface TaskPlanDagEdge {
	source: string;
	target: string;
	/** `order` = required sequence; `binding` = this step consumes that output. */
	kind: "order" | "binding";
	label: string;
}

export interface TaskPlanDetail extends TaskPlanSummary {
	nodes: TaskPlanDagNode[];
	edges: TaskPlanDagEdge[];
	/** The five governed bands, each with what this plan declares in it. */
	declared_layers: TaskPlanLayer[];
	/** Who inlines it, and what each tuned. */
	callers: TaskPlanCaller[];
	/** What a caller may tune (LB20). */
	args_schema: Record<string, PlanArg>;
}

export interface TaskPlanListResponse {
	items: TaskPlanSummary[];
	total: number;
	/** Rendered verbatim in the panel's status bar. Stating the deferral is the design. */
	authoring: string;
}

// ── Thinkings as list rows ───────────────────────────────────────────────────

/**
 * One run, as a list row — the plan and its verdict, without the steps.
 *
 * Two surfaces read this: an agent's **Recent plans** and the Workflows
 * library's **candidates**. `served` is `null` when the run never reached
 * Verify, which is *not* the same fact as "did not serve".
 */
export interface TaskRunSummary {
	id: string;
	workflow_key: string;
	status: string;
	/** What kind of work — `ask` · `import` · `bulk`. Null on a child run. */
	kind: string | null;
	/** What it was about, as the opener wrote it — `Import news-tv`. */
	body: string | null;
	/** `template:<key>@<v>` · `generated` · `envelope` · `promoted:<key>`. */
	plan_origin: string | null;
	plan_revision: number;
	replans: number;
	agent_id: string | null;
	/** `execute` · `plan` · `evaluate` — what the run was for (SR10). */
	role: string;
	task_id: string | null;
	task_title: string | null;
	queued_at: string | null;
	/** When it actually began — what elapsed is measured from (SR45). */
	started_at: string | null;
	finished_at: string | null;
	step_count: number;
	/** The furthest step that is not merely queued — the `Execute` in `Execute 5/7`. */
	step_label: string | null;
	steps_done: number;
	steps_total: number;
	served: "yes" | "partial" | "no" | null;
	promoted: boolean;
	/** What the run spent, summed over its tasks (SR45). */
	tokens_in: number;
	tokens_out: number;
}

export interface ThinkingListResponse {
	items: TaskRunSummary[];
	total: number;
}

// ── Catalogue (the-catalogue.md 7.6) ────────────────────────────────────────

export interface CatalogueArg {
	name: string;
	type: string;
	required: boolean;
	default: unknown;
}

export interface CatalogueOutput {
	name: string;
	type: string;
	/** How lanes roll up on a fan-out; `null` — per lane only (C3). */
	rollup: "sum" | "concat" | null;
}

/** One entry, rendered from `runtime/catalogue/registry.py` — never re-described (CA2). */
export interface CatalogueEntry {
	step_key: string;
	bound: string;
	summary: string;
	args: CatalogueArg[];
	outputs: CatalogueOutput[];
	requires: string[];
	/** Reusable plans in this Graph naming it (C9). */
	used_by: number;
}

export interface CatalogueResponse {
	/** Grouped by bound in the runtime's order, then by key (CA3). */
	items: CatalogueEntry[];
	total: number;
}
