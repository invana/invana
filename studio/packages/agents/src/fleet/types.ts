import type { Change } from "@invana-studio/core";
// ─────────────────────────────────────────────────────────────────────────────
// The fleet — mirrors the fleet shapes in engine/src/invana/activity/schemas.py
// (fleet-performance.md).
//
// Every number is computed by the engine at read from the run rows. Run time is
// queued → finished, in milliseconds. Tokens, never currency.
// ─────────────────────────────────────────────────────────────────────────────

/** Performance's windows, in the `?window=` spelling. */
export type FleetWindow = "7d" | "30d" | "90d";

export const FLEET_WINDOWS: readonly FleetWindow[] = ["7d", "30d", "90d"];

/** One number over a window, the same number over the window before, and the change. */
export type { Change };

export interface FleetMeasure {
	value: number | null;
	prior: number | null;
	/** In points for success, a ratio otherwise; null with no prior. */
	change: Change | null;
}

export interface OverviewTiles {
	runs_today: number;
	/** Roots queued on the same weekday a week ago. */
	runs_week_ago: number;
	/** Today against that day; null when nothing ran then. */
	runs_change: Change | null;
	failed_today: number;
	/** The plan or agent of today's newest failed root. */
	failed_latest: string | null;
	/** Pending approvals plus roots paused on a question. */
	waiting: number;
	waiting_latest: string | null;
	/** The last 7 days against the 7 before. */
	p95_ms: FleetMeasure;
	tokens_this_month: number;
	/** Σ the live agents' effective month budgets; null when none is live. */
	max_tokens_month: number | null;
	/** Succeeded over settled, the last 7 days against the 7 before. */
	success: FleetMeasure;
}

type AttentionKind = "failing" | "waiting" | "degraded";

/** One thing to look at now, and the ids of what answers it. */
export interface AttentionItem {
	kind: AttentionKind;
	title: string;
	detail: string;
	run_id: string | null;
	approval_id: string | null;
	agent_id: string | null;
	at: string | null;
}

export interface DayCount {
	/** `YYYY-MM-DD`. */
	date: string;
	succeeded: number;
	failed: number;
}

/** One agent or skill version and what ran on it after. */
export interface RecentChange {
	record_kind: "agent" | "skill";
	record_id: string;
	name: string;
	version: string;
	/** Null for a first version. */
	previous: string | null;
	at: string | null;
	actor_name: string | null;
	summary: string;
	runs: number;
	failed: number;
	/** p95 against the version before; null with too few runs. */
	p95_change: Change | null;
}

export interface FleetOverview {
	agents: number;
	skills: number;
	tiles: OverviewTiles;
	attention: AttentionItem[];
	/** The last 30 days, oldest first, a row for every day. */
	daily: DayCount[];
	/** Newest first, at most 5. */
	changes: RecentChange[];
}

interface Degradation {
	p95_ms: number;
	baseline_p95_ms: number;
	/** When the first slow run queued. */
	since: string;
	/** The newest version published before it, of the agent or a skill it binds. */
	change: RecentChange | null;
}

type PerformanceSignal = "degraded" | "failing";

/** One agent, skill, plan or model over the window. */
export interface PerformanceRow {
	/** Agent id · skill id · plan ref · model version name. */
	id: string;
	name: string;
	/** The skill's or plan's current version; null for an agent or a model. */
	version: string | null;
	runs: number;
	success: number | null;
	p50_ms: number | null;
	p95_ms: number | null;
	/** The window before — for a skill, its previous version over this window. */
	p95_prior_ms: number | null;
	/** p95 against `p95_prior_ms`; null with no prior. */
	p95_change: Change | null;
	/** The version the prior was read off; null when it is the window before. */
	prior_version: string | null;
	tokens_per_run: number | null;
	tokens_per_run_prior: number | null;
	/** Latest settled runs that failed, counted back to one that did not. */
	failing: number;
	signal: PerformanceSignal | null;
	degradation: Degradation | null;
}

export interface FleetTiles {
	success: FleetMeasure;
	p50_ms: FleetMeasure;
	p95_ms: FleetMeasure;
	runs: FleetMeasure;
	tokens_per_run: FleetMeasure;
	degraded: number;
	failing: number;
}

interface TrendPoint {
	date: string;
	/** Null on a day nothing settled. */
	p95_ms: number | null;
}

interface TrendMark {
	date: string;
	/** `skill v8` · `agent v3`. */
	label: string;
}

/** p95 a day for one agent — the most degraded, else the busiest. */
export interface PerformanceTrend {
	subject_kind: "agent";
	subject_id: string;
	name: string;
	baseline_p95_ms: number | null;
	points: TrendPoint[];
	marks: TrendMark[];
}

export interface FleetPerformance {
	window_days: number;
	tiles: FleetTiles;
	agents: PerformanceRow[];
	skills: PerformanceRow[];
	plans: PerformanceRow[];
	models: PerformanceRow[];
	trend: PerformanceTrend | null;
}

interface PinnedAgent {
	id: string;
	name: string;
}

interface PinnedSkill {
	id: string;
	name: string;
	/** The published version that pins it. */
	version: number;
}

interface PinnedJudge {
	/** The eval set's subject: `skill` · `agent`. */
	subject_kind: string;
	subject_id: string;
	name: string;
}

/** Who pins one model address. */
export interface ModelPin {
	/** `llm/<provider name>/<model_id>`. */
	address: string;
	agents: PinnedAgent[];
	skills: PinnedSkill[];
	judges: PinnedJudge[];
}

export interface ModelPins {
	items: ModelPin[];
}
