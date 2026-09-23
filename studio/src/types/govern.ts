/**
 * Govern — worlds, guardrails, the participant catalogue and what a run touched.
 *
 * A guardrail and a world are **one record separated by `kind`**
 * (GV1): one enforcement path, one document frozen onto a run, and promotion is
 * a field change rather than a re-authoring. That is why there is one `Lens`
 * type here and not two.
 *
 * Shapes follow the engine's `apps/govern/schemas.py` as the live OpenAPI
 * document reports them.
 */

/** The five governed classes of participant, plus the spine. */
export type GovernLayer =
	| "graph_data"
	| "llm"
	| "third_party"
	| "cache"
	| "human"
	| "agent";

export type LensKind = "world" | "guardrail";

/** What a plan's step is doing, and therefore how much the model matters. */
export type CastRole = "extract" | "decide" | "judge" | "embed";

/** What of the Graph's data may accompany a call across the boundary. */
export type EgressClass =
	| "type_names"
	| "property_names"
	| "the_question"
	| "property_values"
	| "record_ids"
	| "aggregates"
	| "everything";

/** A slice along the axes the matched model declared. */
export interface RuleSelect {
	time?: { axis: string; from?: string; to?: string };
	geo?: { axis: string; vocab?: string; in: string[] };
	dims?: Record<string, string[]>;
}

/**
 * One rule: what it matches, whether it allows, and what it narrows.
 *
 * `properties.exclude` is the only form — an allow-list would silently drop a
 * property added to the model later, which is a bound that stops applying
 * without anybody editing it.
 */
export interface GovernRule {
	match: string;
	allow: boolean;
	properties?: { exclude?: string[] };
	select?: RuleSelect;
	egress?: { may_send?: EgressClass[] };
	options?: Record<string, unknown>;
}

export interface LensUsage {
	runs: number;
	last_used_at: string | null;
	actor_ids: string[];
}

export interface Lens {
	id: string;
	graph_id: string;
	kind: LensKind;
	/** Derived from `name` on the first naming, then frozen. Null = unnamed. */
	key: string | null;
	/** The text that was typed. A rename changes this alone. */
	name: string | null;
	/** What a list shows — `name`, or a stand-in for an unnamed lens. */
	display_name: string;
	scope: string | null;
	rules: GovernRule[];
	cast: Partial<Record<CastRole, string>>;
	/**
	 * The layers this lens allow-lists. A layer named here admits only what its
	 * rules allow; one absent is permitted whole (GV23). Stated rather than
	 * inferred, because an implicit allow-list is a bound an auditor cannot see.
	 */
	closed_layers: GovernLayer[];
	/** Transaction time. Null means now. */
	as_of: string | null;
	created_in_run_id: string | null;
	version: number;
	is_named: boolean;
	created_at: string;
	updated_at: string;
	usage?: LensUsage | null;
	/**
	 * The four roles resolved against this lens composed with the guardrails,
	 * then checked (R4). Filled on the **detail** read alone — a list of twenty
	 * lenses would compose it twenty times for a column no list shows.
	 */
	cast_resolved?: CastResolution[] | null;
}

/** One role, after *innermost wins* and then the check against the rules. */
export interface CastResolution {
	role: CastRole;
	address: string | null;
	allowed: boolean;
	/** The rule that denied it, when one did — a refusal names its bound. */
	rule_matched: string | null;
	source: "lens" | "shipped";
	refusal: string | null;
}

export interface LensListResponse {
	items: Lens[];
	total: number;
	/**
	 * `graph_members.can_edit_guardrails` for whoever asked (GV22) — the one
	 * field-level permission in the product. It rides on this list because the
	 * drawer reads the list exactly once; a second request would let the bound
	 * and the right to edit it arrive at different moments.
	 *
	 * **The rules render for everyone either way** (GR5). This decides whether
	 * the authoring controls are drawn at all — absent, never disabled.
	 */
	may_edit_guardrails: boolean;
}

export interface LensCreate {
	name?: string | null;
	kind?: LensKind;
	scope?: string | null;
	rules?: GovernRule[];
	cast?: Partial<Record<CastRole, string>>;
	closed_layers?: GovernLayer[];
	as_of?: string | null;
	created_in_run_id?: string | null;
}

export type LensUpdate = Partial<
	Pick<LensCreate, "name" | "rules" | "cast" | "closed_layers" | "as_of">
>;

/** One addressable thing, and what a rule may say about it. */
export interface Participant {
	address: string;
	layer: GovernLayer;
	sublayer: string;
	name: string;
	label: string;
	/** What this participant declared may be narrowed. Empty = cannot slice. */
	axes: {
		time?: { property: string };
		geo?: { property: string; vocab?: string };
		dims?: string[];
	};
	properties: string[];
	/** Why it cannot be sliced, when it cannot. Shown in place of the controls. */
	note: string;
}

export interface CatalogueResponse {
	items: Participant[];
	total: number;
	/**
	 * Which layers have anything configured — so a form can tell *nothing is set
	 * up* from *nothing matched*.
	 */
	layers_present: GovernLayer[];
	match: string | null;
}

/** A refusal names its bound and, where there is one, the way out. */
export interface Refusal {
	code: string;
	rule: string;
	message: string;
	recourse: string | null;
}

export interface Warning {
	code: string;
	rule: string;
	message: string;
}

export interface ValidationResponse {
	ok: boolean;
	refusals: Refusal[];
	warnings: Warning[];
}

/** What one world would lose if a guardrail were saved as proposed. */
export interface WorldImpact {
	lens_id: string;
	name: string;
	loses: string[];
	cast_denied: string[];
	changes: boolean;
	summary: string;
}

export interface ImpactResponse {
	headline: string;
	worlds: WorldImpact[];
}

export type TouchDirection = "out" | "in" | "refused" | "skipped";

/** One engagement, projected from the ledger and carrying its `seq` (GV20). */
export interface Touch {
	seq: number;
	step_key: string | null;
	address: string;
	layer: GovernLayer;
	sublayer: string;
	participant: string;
	direction: TouchDirection;
	rule_matched: string | null;
	why: string | null;
	/**
	 * `tokens_in` and `tokens_out` are two numbers on the wire, because a run that
	 * read a lot and wrote a little is a different run from its mirror — the step
	 * dashboard adds them for the one-line readout and the record keeps them apart.
	 */
	volume: {
		rows?: number;
		tokens_in?: number;
		tokens_out?: number;
	};
	applied: AppliedNarrowing;
	sent: { classes?: EgressClass[]; cut?: EgressClass[] };
	query: { generated_sha256?: string; executed_sha256?: string };
	cost_usd: number | null;
	duration_ms: number | null;
}

export interface TouchesResponse {
	run_id: string;
	items: Touch[];
	total: number;
	counts: Record<string, number>;
	allowed: string[];
	touched: string[];
	never_touched: string[];
	refused: string[];
}

export interface CompareSide {
	run_id: string;
	lens_id: string | null;
	lens_name: string | null;
	touched: string[];
	cost_usd: number | null;
}

export interface CompareResponse {
	a: CompareSide;
	b: CompareSide;
	only_in_a: string[];
	only_in_b: string[];
	shared: string[];
	/**
	 * Keyed by address, and only the **shared** addresses the two runs narrowed
	 * differently (WO18). Addresses alone read *shared 2 · differed 0* for two
	 * runs where one sliced a type and the other rewrote its projection, which
	 * is the one sentence compare exists not to say.
	 */
	differed: Record<string, AppliedDiff>;
}

/** How two runs narrowed the same participant differently (WO18). */
export interface AppliedDiff {
	/** The fields of `applied` that are not equal — nothing else is listed. */
	differs: AppliedField[];
	a: Partial<AppliedNarrowing>;
	b: Partial<AppliedNarrowing>;
}

export type AppliedField = keyof AppliedNarrowing;

/**
 * What the lens did to one read, as the touch records it.
 *
 * **`select` and `properties_excluded` are keyed by type** (WO17): a world
 * narrows per type, and the read's own verdict carries neither — both are read
 * off the compiled lens. A type nobody narrowed is absent, never an empty
 * entry, so *nothing was narrowed* is a missing key rather than an empty object
 * claiming a narrowing that named nothing. A narrowing written against the
 * grounding version itself is filed under `*`.
 */
export interface AppliedNarrowing {
	/** The authored model versions whose rules reached this read (GV33). */
	models?: string[];
	/** `{ [typeName]: RuleSelect }` — the slice the connector composed. */
	select?: Record<string, Record<string, unknown>>;
	/** `{ [typeName]: property[] }` — what the projection was rewritten to drop. */
	properties_excluded?: Record<string, string[]>;
	/** The returns the projection rewrote. */
	projected?: string[];
	/** The types a predicate was composed onto. */
	composed?: string[];
}
