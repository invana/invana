// ─────────────────────────────────────────────────────────────────────────────
// Skill and Rule types — mirrors engine/src/invana/apps/skills/schemas.py
//
// What a run is **given** before it runs. A **skill** is a playbook that may be
// offered; a **rule** is a statement that is always true in its scope. Neither
// is enforced (skills/spec.md § 2).
// ─────────────────────────────────────────────────────────────────────────────

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
	/** `builtin` ships with Invana: editable, re-seeded by name, never deleted (SK25). */
	origin: string;
	/** Never published — nothing is offered it, and the drawer says so (SK21). */
	is_draft: boolean;
	/** An unpublished row waiting to be published, head or no head. */
	draft_version_id: string | null;
	/** The plan that is **offered** — the head's, or the draft's if nothing is published. */
	plan: SkillPlanSummary | null;
}

export interface SkillCreate {
	name: string;
	description?: string;
	content?: string;
	when_to_use?: string;
}

/**
 * A rename, a republish, or both. Changing any text field publishes the next
 * version; changing only the name does not (SK2).
 */
export interface SkillUpdate {
	name?: string;
	description?: string;
	content?: string;
	when_to_use?: string;
}

export interface SkillListResponse {
	items: Skill[];
	total: number;
}

// ── the plan a version owns ─────────────────────────────────────────────────

/** The six bands a playbook can touch. `cache` is drawn dark — no catalogue
 *  entry spends it yet (SK16). */
export type SkillLayer =
	| "graph data"
	| "llm"
	| "third party"
	| "cache"
	| "human"
	| "agent";

/** What the drawer row and the Flow tab's badge need without a second call. */
export interface SkillPlanSummary {
	plan_id: string;
	/** `generated` when the planner drew it, `authored` after a hand-edit (SK7). */
	origin: string;
	step_count: number;
	layers: SkillLayer[];
}

export interface SkillPlanNode {
	id: string;
	/** The catalogue entry, or `""` on a `human` node. */
	task: string;
	label: string;
	args: Record<string, unknown>;
	depth: number;
	/** `callable` · `composite` · `human` */
	form: string;
	layer: SkillLayer;
	/** The sentence this step was drawn from (C11). */
	source_span: string | null;
	/**
	 * `nl-single@1` when this row was inlined from a library plan, null when
	 * somebody wrote it. What the editor groups consecutive rows by, so five
	 * inlined steps read as the one plan they came from (SK33).
	 */
	source_plan_key: string | null;
}

export interface SkillPlanEdge {
	source: string;
	target: string;
	/** `order` · `binding` */
	kind: string;
	label: string;
}

export interface SkillPlanRead {
	plan_id: string;
	origin: string;
	nodes: SkillPlanNode[];
	edges: SkillPlanEdge[];
	layers: SkillLayer[];
	/** The library plans this plan inlined, and what it tuned on each (LB19). */
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
	 * acts on: re-inlining is a thing somebody asks for (SK32).
	 */
	latest_version: number;
}

/** A library plan a skill may inline, and what it offers a caller (LB19). */
export interface InlinablePlan {
	key: string;
	version: number;
	/** `nl-single@1` — what a `uses` row names. */
	ref: string;
	name: string;
	description: string;
	kind: string;
	step_count: number;
	layers: SkillLayer[];
	args_schema: Record<string, PlanArg>;
}

/** One declared argument — what it is, and what it is unless a caller says. */
export interface PlanArg {
	type: "str" | "int" | "bool";
	default?: unknown;
	label?: string;
}

export interface InlinablePlanListResponse {
	items: InlinablePlan[];
}

// ── the draft, and the question it is waiting on ────────────────────────────

/** One reading the planner offered, naming the step it would write. */
export interface SkillClarificationOption {
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
 * One step a hand-edit may name. The engine sends the set with the draft: the
 * catalogue is closed and Studio cannot see it, so a list of step keys written
 * here would be a second copy to keep in step (SK28).
 */
export interface SkillStepChoice {
	step_key: string;
	label: string;
	bound: string;
	layer: SkillLayer;
	/** Steps that must be ordered before it. */
	requires: string[];
}

/**
 * One row of a hand-edited plan. Row-level, not a flow editor: which step, what
 * it is called, what it takes. The edges are materialised by the engine from
 * the bindings and the catalogue's `requires`.
 */
export interface SkillDraftTaskWrite {
	key?: string | null;
	/**
	 * `callable` names a catalogue entry; `human` names none (SK15); `uses`
	 * names a library **plan**, whose rows the engine copies in before it
	 * validates anything (SK32).
	 */
	form: "callable" | "human" | "uses";
	step_key?: string | null;
	title?: string;
	args?: Record<string, unknown>;
	/** Kept so the Playbook tab still maps prose to steps after an edit (C11). */
	source_span?: string | null;
	/** `uses` rows only: which plan, and what this composition tunes. */
	uses?: string | null;
	uses_args?: Record<string, unknown>;
}

/**
 * The version being written, the plan being drawn, and the question waiting on
 * an answer. A draft is a version row with no `published_at` (SK20).
 */
export interface SkillDraft {
	version: SkillVersion;
	plan: SkillPlanRead;
	clarifications: SkillClarification[];
	open_clarification: SkillClarification | null;
	drawing_run_id: string | null;
	/**
	 * Why the last draw wrote nothing. A refusal settles rather than fails
	 * (SK31), so it is read here — where the flow would have been — and not in
	 * a run that died. The next draw that writes rows clears it.
	 */
	refusal: SkillDrawRefusal | null;
	/** What a hand-edit may name — the catalogue, in the drawer's words (SK28). */
	vocabulary: SkillStepChoice[];
}

/**
 * Where this skill stands with one agent — the Bindings tab's three sections.
 *
 * `refusal` is the refusal a bind **would** raise, run as a dry run by the
 * engine (BN10). Studio never re-reads the rules to predict one: a second
 * reading of a bound is a copy to keep in step, and the copy goes stale.
 */
export interface SkillAgentStanding {
	agent_id: string;
	agent_name: string;
	/**
	 * The world the agent carries by default. **Context on the row, never a
	 * ground for a refusal** — the check reads guardrails and never worlds
	 * (BN12 · BN10) — and absent when the agent carries none.
	 */
	world: string | null;
	bound: boolean;
	refusal: BindRefusal | null;
}

/**
 * What a bind refused on, and what it did **not** check.
 *
 * The engine sends the facts unflattened, so the card draws them rather than
 * printing a sentence. The envelope half names a `step_key` and its `bound`;
 * the lens half names the `layer`, one `participant` it checked and the `rule`
 * that denied it (BN10).
 */
export interface BindRefusal {
	check: string;
	message?: string;
	checked?: string[];
	not_checked?: string[];
	/** The envelope half. */
	step_key?: string;
	bound?: string;
	/** The lens half. */
	layer?: string;
	/**
	 * Every band the version's plan declares, in the plan's own order — the
	 * strip the card draws with `layer` struck through (BN13). Absent on an
	 * envelope refusal, which is about a `step_key` and read no bands.
	 */
	layers?: string[];
	reason?: string;
	participant?: string | null;
	rule?: string | null;
}

/** What the last draw refused, in the validator's own words (SK31). */
export interface SkillDrawRefusal {
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
	/** **Null is the draft** — the one mutable version row (SK20). */
	published_at: string | null;
	/** One version, exactly one plan (SK13). Never null. */
	plan_id: string;
	is_draft: boolean;
}

export interface SkillVersionListResponse {
	items: SkillVersion[];
	total: number;
}

/** The next version's text. Anything omitted carries over from the head. */
export interface SkillVersionPublish {
	description?: string;
	content?: string;
	when_to_use?: string;
}

export interface SkillVersionFieldDiff {
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
 * says *too few to read* rather than drawing a percentage (US6).
 */
export interface SkillUsageVersion {
	skill_version_id: string;
	version: number;
	offered: number;
	applied: number;
	gap: number;
	enough_to_read: boolean;
}

export interface SkillUsageByAgent {
	agent_id: string | null;
	agent_name: string | null;
	offered: number;
	applied: number;
	gap: number;
	enough_to_read: boolean;
}

export interface SkillUsageByOutcome {
	/** The **run's** outcome — answered · cannot_answer · failed · cancelled. */
	outcome: string | null;
	offered: number;
	applied: number;
	gap: number;
	enough_to_read: boolean;
}

export interface SkillUsageStep {
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

// ── rules ────────────────────────────────────────────────────────────────────

/**
 * One statement that is always true in its scope. `scope` and `kind` are
 * derived from `project_id` by the engine, never stored twice (RU6).
 */
export interface Rule {
	id: string;
	graph_id: string;
	project_id: string | null;
	/** `graph` · `project` */
	scope: string;
	/** `invariant` · `working` */
	kind: string;
	active: boolean;
	order: number;
	version: number;
	current_version_id: string | null;
	statement: string;
	/** Steps that cited any version of it. */
	citations: number;
	created_at: string;
	updated_at: string;
}

/**
 * One rule as it reached a step — the wording, and the rule to open
 * ([RU12](../../../docs/for-developers/modules/skills/features/rules.md)).
 *
 * `statement` is the **version's** wording, resolved by the engine from the
 * `rule_version_id` the step recorded, so rewording the rule never rewrites
 * what a past step was given. `rule_id` is what `More` opens, because a board
 * is bound to the rule rather than to one of its versions.
 */
export interface OfferedRule {
	rule_id: string;
	statement: string;
}

export interface RuleCreate {
	statement: string;
	order?: number;
}

export interface RuleUpdate {
	statement?: string;
	order?: number;
}

export interface RuleListResponse {
	items: Rule[];
	total: number;
	/** On a Project's list: the Graph invariants it inherits, read-only (C3). */
	inherited: Rule[];
}

export interface RuleVersion {
	id: string;
	rule_id: string;
	version: number;
	statement: string;
	published_by_id: string | null;
	published_at: string;
}

export interface RuleVersionListResponse {
	items: RuleVersion[];
	total: number;
}

export interface RuleCitation {
	run_id: string | null;
	step_id: string;
	label: string;
	task_key: string;
	rule_version_id: string;
	version: number;
	/** The wording the step actually read, not the rule's wording today. */
	statement: string;
	finished_at: string | null;
}

/**
 * One published wording and how many steps said they followed it.
 *
 * Counted by the engine, never tallied from `items` — that list is a bounded,
 * newest-first window, and a total taken from a page is a different number
 * wearing the same label (RU10).
 */
export interface RuleVersionCitations {
	rule_version_id: string;
	version: number;
	statement: string;
	published_at: string;
	cited: number;
}

/**
 * Where a rule was **offered** and where it was **cited**.
 *
 * `offered` is a fact written by assembly; `total` is the model's own claim,
 * and the difference is *never cited* — which cannot be told from *never
 * offered* unless both are sent (RU7 · RU9).
 */
export interface RuleCitationsResponse {
	rule_id: string;
	offered: number;
	total: number;
	/** Every published wording with its own count, newest first. */
	versions: RuleVersionCitations[];
	items: RuleCitation[];
}

/** The Bindings tab's one read (BN10). */
export interface SkillAgentsResponse {
	items: SkillAgentStanding[];
}
