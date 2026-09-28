/**
 * The engine's task-plan and catalogue records: a plan's summary and detail
 * (its steps as a DAG, the layers it declares, who may call it), its
 * performance and runs over a window, a diff between two versions, and the
 * catalogue of callables a plan is composed from. Shapes mirror the engine's
 * task-plan schemas field for field.
 */

import type { AgentChip } from "@/pages/graphs-detail/features/agents";
import type {
	PlanArg,
	SkillLayer,
} from "@/pages/graphs-detail/features/skills";

/**
 * One governed band, and what a plan declares in it — the panel's *Layers it
 * declares* ([LB22](docs/for-developers/modules/workflows/features/the-library.md)).
 *
 * All five arrive, touched or not: *this plan reads no graph data* is the fact
 * a reader is checking for, and a band that vanished when empty would be
 * indistinguishable from one that failed to load.
 */
interface TaskPlanLayer {
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

interface TaskPlanStepSpec {
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

interface TaskPlanDagEdge {
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

// ── How a plan has behaved (LB33 · LB34 · LB36) ─────────────────────────────

/** The plan page's three windows — every number on it is read over one. */
export type PlanWindow = "7d" | "30d" | "90d";

/** A number over the window, beside the same number over the window before. */
export interface Measure {
	value: number | null;
	prior: number | null;
}

export interface PlanPerformance {
	window_days: number;
	version: number;
	tiles: {
		runs: Measure;
		/** Of verified runs; `null` when none was verified. */
		served: Measure;
		elapsed_p50_ms: Measure;
		work_p50_ms: Measure;
		/** `null` when no run is priced — unknown, never free. */
		cost_per_run: Measure;
		failed: Measure;
	};
	daily: {
		date: string;
		served: number;
		failed: number;
		work_p50_ms: number | null;
	}[];
	publishes: { version: number; published_at: string }[];
	/** In plan order. Measures are `null` when the step was never reached. */
	steps: {
		step_key: string;
		layer: SkillLayer;
		ran_in: number | null;
		p50_ms: number | null;
		p95_ms: number | null;
		failed: number;
		retried: number | null;
		cost_per_run: number | null;
		share_of_work: number | null;
	}[];
	failures: {
		step_key: string;
		cause: string;
		count: number;
		last_run_id: string;
	}[];
	bounds: {
		step_key: string;
		bound: string;
		limit: number;
		used: number;
		exhausted: number;
	}[];
	slowest: Record<string, { run_id: string; ms: number; when: string }[]>;
}

export interface PlanRunRow {
	run_id: string;
	/** The run page's words: `running` · `succeeded` · `failed` · `at a gate` · `cancelled`. */
	status: string;
	when: string;
	asked: string;
	called_by: { kind: string; name: string; person: string | null };
	agent: AgentChip | null;
	version: number | null;
	elapsed_ms: number | null;
	cost: number | null;
	failed_at: { step_key: string; cause: string; message: string } | null;
}

/** A version against the one before it (LB37). `against_version` is null for v1. */
export interface PlanVersionDiff {
	key: string;
	version: number;
	against_version: number | null;
	/** The one line the section prints — `+await_reply · fetch changed`. */
	summary: string;
	added: string[];
	removed: string[];
	moved: string[];
	changed: {
		step_key: string;
		fields: { field: string; before: unknown; after: unknown }[];
	}[];
	unchanged: string[];
	arguments: {
		name: string;
		change: "added" | "removed" | "changed";
		before: unknown;
		after: unknown;
	}[];
}

export interface PlanRunsPage {
	items: PlanRunRow[];
	next_cursor: string | null;
	live: { running: number; at_gate: number; called_by: number; agents: number };
}

export interface TaskPlanListResponse {
	items: TaskPlanSummary[];
	total: number;
	/** Rendered verbatim in the panel's status bar. Stating the deferral is the design. */
	authoring: string;
}

// ── Catalogue (the-catalogue.md 7.6) ────────────────────────────────────────

interface CatalogueArg {
	name: string;
	type: string;
	required: boolean;
	default: unknown;
}

interface CatalogueOutput {
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
