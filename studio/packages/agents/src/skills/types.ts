// ─────────────────────────────────────────────────────────────────────────────
// Skill types — mirrors engine/src/invana/apps/skills/schemas.py
//
// What a run is **given** before it runs. A **skill** is a playbook that may be
// offered; a **rule** is a statement that is always true in its scope. Neither
// is enforced (skills/spec.md § 2). The rule records are in
// `@invana-studio/core`.
// ─────────────────────────────────────────────────────────────────────────────

import type { Page } from "@invana-studio/core";
import type { BindRefusal } from "@invana-studio/ui";

/**
 * A skill, with the text of its current version flattened onto it.
 *
 * `description` · `content` · `when_to_use` read through the head, so a caller
 * renders a skill without knowing versions exist; `version` and
 * `current_version_id` say *which* text it got.
 */
export interface Skill {
	id: string;
	graph_id: string;
	name: string;
	version: number;
	current_version_id: string | null;
	description: string;
	content: string;
	when_to_use: string;
	created_at: string;
	updated_at: string;
	/** `builtin` ships with Invana: editable, re-seeded by name, never deleted. */
	origin: string;
	/** Never published — nothing is offered it, and the section says so. */
	is_draft: boolean;
	/** An unpublished row waiting to be published, head or no head. */
	draft_version_id: string | null;
	/** The plan that is **offered** — the head's, or the draft's if nothing is published. */
	plan: SkillPlaybookSummary | null;
}

export interface SkillCreate {
	name: string;
	description?: string;
	content?: string;
	when_to_use?: string;
}

/**
 * The Skills list. Filters: `status` (published · draft) · `origin` (builtin ·
 * authored). Sorts: `name` · `-updated_at` · `-created_at`.
 */
export type SkillPage = Page<Skill>;

// ── the plan a version owns ─────────────────────────────────────────────────

/** The six bands a playbook can touch. `cache` is drawn dark — no catalogue
 *  entry spends it yet. */
export type SkillLayer =
	| "graph data"
	| "llm"
	| "third party"
	| "cache"
	| "human"
	| "agent";

/** What the section row and the Flow tab's badge need without a second call. */
interface SkillPlaybookSummary {
	plan_id: string;
	/** `generated` · `packaged` · `promoted`; `authored` on rows written before. */
	origin: string;
	step_count: number;
	layers: SkillLayer[];
}

export interface SkillPlaybookNode {
	id: string;
	/** The catalogue entry, or `""` on a `human` node. */
	task: string;
	label: string;
	args: Record<string, unknown>;
	depth: number;
	/** `callable` · `composite` · `human` */
	form: string;
	layer: SkillLayer;
	/** The sentence this step was drawn from. */
	source_span: string | null;
	/**
	 * `nl-single@1` when this row was inlined from a library plan, null when
	 * somebody wrote it. What the editor groups consecutive rows by, so five
	 * inlined steps read as the one plan they came from.
	 */
	source_plan_key: string | null;
}

interface SkillPlaybookEdge {
	source: string;
	target: string;
	/** `order` · `binding` */
	kind: string;
	label: string;
}

export interface SkillPlaybookRead {
	plan_id: string;
	origin: string;
	nodes: SkillPlaybookNode[];
	edges: SkillPlaybookEdge[];
	layers: SkillLayer[];
	/** The library plans this plan inlined, and what it tuned on each. */
	uses: PlanUse[];
}

/** One composition: which plan, which version, and the arguments it tuned. */
export interface PlanUse {
	key: string;
	version: number;
	args: Record<string, unknown>;
	/**
	 * The newest version of that key the Graph holds. Greater than `version`
	 * means the library has moved on — which the Flow tab **says** and never
	 * acts on: re-inlining is a thing somebody asks for.
	 */
	latest_version: number;
}

/** One declared argument — what it is, and what it is unless a caller says. */
export interface PlanArg {
	type: "str" | "int" | "bool";
	default?: unknown;
	label?: string;
}

// ── the draft, and the question it is waiting on ────────────────────────────

/** One reading the planner offered, naming the step it would write. */
interface SkillClarificationOption {
	step_key: string;
	label: string;
	why: string;
}

export interface SkillClarification {
	id: string;
	skill_version_id: string;
	/** The sentence, verbatim — what the card quotes. */
	span: string;
	question: string;
	options: SkillClarificationOption[];
	answer: string | null;
	answered_at: string | null;
}

/**
 * The version being written, the plan being drawn, and the question waiting on
 * an answer. A draft is a version row with no `published_at`.
 */
export interface SkillDraft {
	version: SkillVersion;
	plan: SkillPlaybookRead;
	clarifications: SkillClarification[];
	open_clarification: SkillClarification | null;
	drawing_run_id: string | null;
	/** Whether the plan was drawn from the text as it reads now — publish needs it. */
	drawn: boolean;
	/**
	 * Why the last draw wrote nothing. A refusal settles rather than fails,
	 * so it is read here — where the flow would have been — and not in
	 * a run that died. The next draw that writes rows clears it.
	 */
	refusal: SkillDrawRefusal | null;
}

/**
 * Where this skill stands with one agent — the Bindings tab's three sections.
 *
 * `refusal` is the refusal a bind **would** raise, run as a dry run by the
 * engine. Studio never re-reads the rules to predict one: a second
 * reading of a bound is a copy to keep in step, and the copy goes stale.
 */
export interface SkillAgentStanding {
	agent_id: string;
	agent_name: string;
	bound: boolean;
	refusal: BindRefusal | null;
}

/** What a bind refused on — declared beside the card that draws it. */
export type { BindRefusal };

/** What the last draw refused, in the validator's own words. */
interface SkillDrawRefusal {
	run_id: string;
	reasons: string[];
}

/** The `role = plan` run that is drawing the draft, and where to watch it. */
export interface SkillDrawStarted {
	run_id: string;
	stream_url: string;
}

// ── versions ─────────────────────────────────────────────────────────────────

/** One published version. **Immutable** — editing publishes the next one. */
export interface SkillVersion {
	id: string;
	skill_id: string;
	version: number;
	description: string;
	content: string;
	when_to_use: string;
	published_by_id: string | null;
	/** **Null is the draft** — the one mutable version row. */
	published_at: string | null;
	/** One version, exactly one plan. Never null. */
	plan_id: string;
	is_draft: boolean;
	model_pin: string | null;
	/** The version this one restored, when it is a rollback. */
	restored_from_version: number | null;
}

/** The next version's text. Anything omitted carries over from the head. */
export interface SkillVersionPublish {
	description?: string;
	content?: string;
	when_to_use?: string;
	/** The exact model version this skill pins; omitted keeps the current one. */
	model_pin?: string | null;
	/** Kept in History; a warned eval run needs one. */
	why?: string;
}

interface SkillVersionFieldDiff {
	field: string;
	changed: boolean;
	/** Unified diff lines, computed by the engine so every surface agrees. */
	lines: string[];
}

export interface SkillVersionDiff {
	skill_id: string;
	version: number;
	/** Null on v1 — a first version is compared against nothing. */
	against_version: number | null;
	fields: SkillVersionFieldDiff[];
}

// ── usage ────────────────────────────────────────────────────────────────────

/**
 * `enough_to_read` is false below a floor the engine owns. Below it the surface
 * says *too few to read* rather than drawing a percentage.
 */
export interface SkillUsageVersion {
	skill_version_id: string;
	version: number;
	offered: number;
	applied: number;
	gap: number;
	enough_to_read: boolean;
	/** Applied over offered; null below the floor. */
	applied_rate: number | null;
}

interface SkillUsageByAgent {
	agent_id: string | null;
	agent_name: string | null;
	offered: number;
	applied: number;
	gap: number;
	enough_to_read: boolean;
}

interface SkillUsageByOutcome {
	/** The **run's** outcome — answered · cannot_answer · failed · cancelled. */
	outcome: string | null;
	offered: number;
	applied: number;
	gap: number;
	enough_to_read: boolean;
}

interface SkillUsageStep {
	run_id: string | null;
	step_id: string;
	label: string;
	task_key: string;
	skill_version_id: string;
	version: number;
	/** The model's own claim that it followed the prose. Never *used*. */
	reported: boolean;
	finished_at: string | null;
}

export interface SkillUsageResponse {
	skill_id: string;
	current_version_id: string | null;
	versions: SkillUsageVersion[];
	by_agent: SkillUsageByAgent[];
	by_outcome: SkillUsageByOutcome[];
	used_by: { id: string; name: string; status: string }[];
	recent_steps: SkillUsageStep[];
}

/** The Bindings tab's one read. */
export interface SkillAgentsResponse {
	items: SkillAgentStanding[];
}
