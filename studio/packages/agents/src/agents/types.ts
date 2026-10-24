/**
 * The engine's agent records, as Studio reads them: an agent and its soul and
 * effort, the skills and callables it may use, its meters, its lineage, and the
 * preview of what a lifecycle act would change. Shapes mirror the engine's
 * agents schemas field for field; nothing here is derived.
 */

import type { Page } from "@invana-studio/core";

// ── Agents ───────────────────────────────────────────────────────────────────

type AgentKind = "seeded" | "authored" | "spawned";

/** `draft` is built but never offered work until *Create agent*. */
export type AgentStatus = "draft" | "active" | "paused" | "retired";

type AgentLifetime = "persistent" | "ephemeral";

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
	/** The unpublished `instructions.md`; null when no draft is open. */
	instructions_draft: string | null;
	/** The exact model version it thinks with; null lets the world's cast decide. */
	model_pin: string | null;
	/** The envelope: allow-list · pinned args · require · templates · budgets. */
	workflow_spec: Record<string, unknown>;
	/**
	 * The agent's own guardrail, scoped `agent:<id>`. An agent
	 * binds no world — the world comes with the work. Null is *none of
	 * its own*; the name rides with the id so a row draws it without a fetch.
	 */
	guardrail_id: string | null;
	guardrail_name: string | null;
	/** Read-only — the bindings live in `skill_bindings`; change it with bind/unbind. */
	skill_ids: string[];
	budget: Record<string, number>;
	/**
	 * How hard it tries — `max_steps` · `max_replans` · `max_clarifications` —
	 * as stored; a missing key is the default. `effective_effort` is what
	 * a run reads, defaults and the one-release fallbacks filled in.
	 */
	effort: Partial<Record<EffortKey, number>>;
	effective_effort: Record<EffortKey, number>;
	/** Whether an Explorer ask may run through it — decides *Make default*. */
	answers_asks: boolean;
	policy: Record<string, boolean>;
	/** Markdown. Empty is Invana's default voice, never no voice. */
	soul: string;
	/** The voice dials; a missing key is its default. */
	soul_traits: SoulTraits;
	parent_agent_id: string | null;
	spawned_in_run_id: string | null;
	version: number;
	created_by_kind: string;
	created_by_id: string | null;
	created_at: string;
	updated_at: string;
}

/**
 * The Agents list. Filters: `kind` · `status` (no status leaves out retired) ·
 * `ephemeral=shown` (else spawned helpers are left out). Sorts: `name` ·
 * `-created_at` · `-updated_at`.
 */
export interface AgentPage extends Page<Agent> {
	/** The Graph's agents that are not retired, by lifetime — not the page's. */
	persistent: number;
	/** Spawned helpers — hidden from the list by default, and counted. */
	ephemeral: number;
	default_agent_id: string | null;
	/**
	 * `{agent_id: tokens}` since the first of the month — what a row draws
	 * against `max_tokens_month`. An agent that ran nothing is absent; read it
	 * as `0`.
	 */
	tokens_this_month: Record<string, number>;
}

/** A new agent — written as a `draft`. */
export interface AgentCreate {
	name: string;
	description?: string;
	instructions?: string;
	/** Start from a seeded agent's envelope — an empty allow-list can do nothing. */
	envelope_from?: string;
	workflow_spec?: Record<string, unknown>;
	/** The skills this agent starts with, bound as part of creating it. */
	skill_ids?: string[];
	budget?: Record<string, number>;
	effort?: Partial<Record<EffortKey, number>>;
	policy?: Record<string, boolean>;
	/** `""` clears it back to the default voice. */
	soul?: string;
	soul_traits?: SoulTraits;
	/** `llm/<provider>/<model id>`; null lets the cast decide. */
	model_pin?: string | null;
}

/** No `skill_ids`: binding is its own write, so that a refusal can name the one
 *  skill it rejected rather than a whole list. */
export type AgentUpdate = Partial<
	Omit<AgentCreate, "envelope_from" | "skill_ids" | "model_pin">
> & {
	/** Moving it is gated by the agent's evals. */
	model_pin?: string | null;
	/** Kept in History; a warned eval run needs one. */
	why?: string;
};

type EffortKey = "max_steps" | "max_replans" | "max_clarifications";

/** The four voice dials (author-an-agent § Voice dials). */
export interface SoulTraits {
	humour?: "off" | "light" | "playful";
	formality?: "casual" | "neutral" | "formal";
	emoji?: "off" | "on";
	greeting?: "off" | "on";
}

/** One bound skill, and the callables its current plan names. */
export interface AgentSkillRow {
	skill_id: string;
	name: string;
	/** Null for a skill with no published version — offered nothing yet. */
	version: number | null;
	when_to_use: string;
	/** Derived from the plan, `uses` inlined, in plan order. */
	needs: string[];
	/** The library plans it inlined, `key@version`. */
	uses: string[];
	/** The needs the envelope does not allow. */
	missing: string[];
	offered: number;
	applied: number;
	enough_to_read: boolean;
}

/** One callable the envelope allows. */
export interface AgentCallableRow {
	step_key: string;
	/** `graph_read` · `llm` · `none` … or `unknown` for a retired key. */
	bound: string;
	pinned: Record<string, unknown>;
	/** Skill ids and base plans (`key@version`). Empty is *nothing bound*. */
	needed_by: string[];
}

export interface AgentSkillsAndCallables {
	agent_id: string;
	skills: AgentSkillRow[];
	callables: AgentCallableRow[];
	/** The base plans a Plan step may pick, `key@version`. */
	plans: string[];
	/** Σ offered and applied across the bound skills, this agent's runs. */
	offered: number;
	applied: number;
	/** Characters the published bound skills put in every ask. */
	prompt_chars: number;
}

/** What the agent is using now, each beside the limit that caps it. */
export interface AgentMeters {
	agent_id: string;
	/** Always counted; `0` when it ran nothing this month. */
	tokens_this_month: number;
	max_tokens_month?: number | null;
	max_tokens_run?: number | null;
	running: number;
	queued: number;
	max_concurrent_runs?: number | null;
	runs_this_month: number;
	/** Every session bound to the agent, whoever opened it — a count only. */
	sessions: number;
	spawned_this_month: number;
	depth: number;
	max_children?: number | null;
	max_depth?: number | null;
	max_fanout?: number | null;
}

/** One UTC calendar day of the Overview's window; a quiet day is zero. */
export interface AgentOverviewDay {
	date: string;
	runs: number;
	tokens: number;
}

/** How runs ended, one row per exit, the most frequent first. */
export interface AgentOverviewExit {
	/** The run's `outcome` when it has one, else its `status`. */
	exit: string;
	runs: number;
	/** The newest run that ended this way. */
	last_run_id: string;
	last_title: string;
}

/** One of the agent's newest root runs. */
export interface AgentOverviewRun {
	id: string;
	title: string;
	/** This agent plus each distinct agent its steps delegated to. */
	agents: number;
	/** The run's own spend plus its steps'. */
	tokens: number;
	duration_ms: number | null;
	exit: string;
	finished_at: string | null;
}

/** One model version the window's runs called. */
export interface AgentOverviewModel {
	model_version: string;
	/** The first run by this agent on it, all time. */
	first_at: string;
	runs: number;
	/** Served over the runs Verify gave a verdict; null when none did. */
	served_rate: number | null;
	p95_ms: number | null;
}

/** The windows the Overview takes. */
export type AgentOverviewWindow = "7d" | "30d" | "90d";

/**
 * A live agent's Overview over its root runs in the window — UTC days ending
 * today — and the same-length window before. Every number is the engine's.
 */
export interface AgentOverview {
	agent_id: string;
	days: number;
	/** Midnight UTC of the window's first day. */
	since: string;
	runs: number;
	runs_prior: number;
	/** Runs Verify said served. */
	served: number;
	served_rate: number | null;
	served_rate_prior: number | null;
	/** Queued-to-finished over settled runs. */
	p95_ms: number | null;
	p95_prior_ms: number | null;
	/** Since the first of this calendar month. */
	tokens_this_month: number;
	max_tokens_month: number | null;
	/** Agents this one spawned in the window. */
	spawned: number;
	/** One row per day of the window, oldest first. */
	daily: AgentOverviewDay[];
	exits: AgentOverviewExit[];
	/** The ten newest runs, whatever the window. */
	recent: AgentOverviewRun[];
	models: AgentOverviewModel[];
}

export interface SoulPreviewRequest {
	ask: string;
	soul: string;
	soul_traits: SoulTraits;
}

/** One ask, answered twice; neither reply read the graph. */
export interface SoulPreview {
	ask: string;
	current: string;
	draft: string;
	/** `llm/<provider>/<model>` — what spoke. */
	model: string | null;
}

/** A lineage node. Heterogeneous by design — docs/for-developers/modules/agents/features/lineage.md */
interface AgentNode {
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

/** The two acts that disturb open work. Resume takes nothing away. */
export type LifecycleAct = "pause" | "retire";

/**
 * What an act does to one piece of open work — a closed vocabulary, because a
 * sentence per row is a sentence nobody can compare.
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
 * One shape for both acts: the same open work, carrying the effect *this*
 * act would have on it. Named, not counted — a count is not enough to decide
 * with, and a todo in review is where the two acts part.
 */
export interface LifecyclePreview {
	agent_id: string;
	act: LifecycleAct;
	items: LifecycleItem[];
}

// ── Workflows ────────────────────────────────────────────────────────────────

export interface AgentChip {
	id: string;
	name: string;
	status: AgentStatus;
}
