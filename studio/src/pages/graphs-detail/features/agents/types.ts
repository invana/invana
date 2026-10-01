/**
 * The engine's agent records, as Studio reads them: an agent and its soul and
 * effort, the skills and callables it may use, its meters, its lineage, and the
 * preview of what a lifecycle act would change. Shapes mirror the engine's
 * agents schemas field for field; nothing here is derived.
 */

// ── Agents ───────────────────────────────────────────────────────────────────

type AgentKind = "seeded" | "authored" | "spawned";

type AgentStatus = "active" | "paused" | "retired";

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

export interface AgentListResponse {
	items: Agent[];
	total: number;
	default_agent_id: string | null;
	/**
	 * `{agent_id: usd}` since the first of the month — what a row draws against
	 * `max_cost_usd_month`. An agent with no **priced** run is absent, not
	 * zero: a subscription endpoint publishes no per-token rate, so *nothing
	 * spent* and *nothing known* are different facts.
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
	/** The skills this agent starts with, bound as part of creating it. */
	skill_ids?: string[];
	budget?: Record<string, number>;
	effort?: Partial<Record<EffortKey, number>>;
	policy?: Record<string, boolean>;
	/** `""` clears it back to the default voice. */
	soul?: string;
	soul_traits?: SoulTraits;
}

/** No `skill_ids`: binding is its own write, so that a refusal can name the one
 *  skill it rejected rather than a whole list. */
export type AgentUpdate = Partial<
	Omit<AgentCreate, "envelope_from" | "skill_ids">
>;

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
}

/**
 * What the agent is using now, each beside the limit that caps it.
 * `spend_this_month` absent is *nothing priced*, never zero.
 */
export interface AgentMeters {
	agent_id: string;
	spend_this_month?: number | null;
	max_cost_usd_month?: number | null;
	max_cost_usd_run?: number | null;
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
	max_tokens?: number | null;
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
