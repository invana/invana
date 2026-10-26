/**
 * Rule wire types — mirrors engine/src/invana/apps/skills/schemas.py.
 *
 * A **rule** is one statement that is always true in its scope: offered to a
 * step and cited by it, never enforced (skills/spec.md § 2). The Modeller's
 * Rules section writes them, a Project inherits the Graph's invariants, and a
 * step's rules read the citations — so the records live here, where every
 * product may read them. Modeller › Rules reads every rule in force in a
 * Graph — the install's, the Graph's and each project's — as one `Page<Rule>`.
 */

export type RuleScope = "install" | "graph" | "project";
export type RuleMode = "block" | "warn" | "report";
/** The acts a check is read at. */
export type RuleAct = "dataset.share" | "dataset.bind" | "project.decide";
export type RuleCheckKind =
	| "dataset.conforms"
	| "dataset.licence"
	| "evidence.reviewed"
	| "evidence.not_retracted";

/** A rule's machine half, from a closed vocabulary. */
export interface RuleCheck {
	kind: RuleCheckKind;
	/** `dataset.conforms`: the standard as `publisher/name`. */
	standard?: string | null;
	/** `dataset.conforms`: the lowest score that passes. */
	min_score?: number | null;
	/** `dataset.licence`: the licences that pass. */
	allowed?: string[] | null;
}

/**
 * One statement that is always true in its scope. `scope` and `kind` are
 * derived from `graph_id` and `project_id` by the engine, never stored twice.
 */
export interface Rule {
	id: string;
	/** Null on an install rule. */
	graph_id: string | null;
	project_id: string | null;
	scope: RuleScope;
	/** `invariant` · `working` */
	kind: string;
	active: boolean;
	order: number;
	version: number;
	current_version_id: string | null;
	statement: string;
	check?: RuleCheck | null;
	mode?: RuleMode | null;
	/** Why it holds — named to whoever it stops. */
	because?: string | null;
	/** The acts its check is read at; empty when it is only offered. */
	acts?: RuleAct[];
	/** Steps that cited any version of it. */
	citations: number;
	/** On a Graph's list. */
	graph_name?: string | null;
	project_key?: string | null;
	project_name?: string | null;
	/** On a Graph's list: acts of the last 30 days its check breaks. */
	broken_30d?: number | null;
	created_at: string;
	updated_at: string;
}

export interface RuleCreate {
	statement: string;
	order?: number;
	check?: RuleCheck | null;
	mode?: RuleMode | null;
	because?: string | null;
}

export interface RuleUpdate {
	statement?: string;
	order?: number;
	/** Sent as null, the next version has no check. */
	check?: RuleCheck | null;
	mode?: RuleMode | null;
	because?: string | null;
}

/** A check as the dialog holds it, and where it would sit. */
export interface RuleImpactRequest {
	scope: RuleScope;
	project_key?: string | null;
	check: RuleCheck;
}

/** One act of the window the check breaks. */
interface RuleImpactItem {
	act: RuleAct;
	/** `publisher/name@v` or `PROJ/d3`. */
	subject: string;
	at: string;
	reason: string;
}

/** What a check would have broken over the window, read back by the engine. */
export interface RuleImpact {
	days: number;
	/** Acts of the window the check is read at. */
	read: number;
	broken: number;
	/** The newest broken acts, at most five. */
	items: RuleImpactItem[];
}

export interface RuleListResponse {
	items: Rule[];
	total: number;
	/** On a Project's list: the Graph invariants it inherits, read-only. */
	inherited: Rule[];
}

interface RuleVersion {
	id: string;
	rule_id: string;
	version: number;
	statement: string;
	check?: RuleCheck | null;
	mode?: RuleMode | null;
	because?: string | null;
	published_by_id: string | null;
	published_at: string;
}

export interface RuleVersionListResponse {
	items: RuleVersion[];
	total: number;
}

interface RuleCitation {
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
 * wearing the same label.
 */
interface RuleVersionCitations {
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
 * offered* unless both are sent.
 */
export interface RuleCitationsResponse {
	rule_id: string;
	offered: number;
	total: number;
	/** Every published wording with its own count, newest first. */
	versions: RuleVersionCitations[];
	items: RuleCitation[];
}
