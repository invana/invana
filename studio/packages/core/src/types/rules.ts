/**
 * Rule wire types — mirrors engine/src/invana/apps/skills/schemas.py.
 *
 * A **rule** is one statement that is always true in its scope: offered to a
 * step and cited by it, never enforced (skills/spec.md § 2). The Modeller's
 * Rules section writes them, a Project inherits the Graph's invariants, and a
 * step's rules read the citations — so the records live here, where every
 * product may read them.
 */

/**
 * One statement that is always true in its scope. `scope` and `kind` are
 * derived from `project_id` by the engine, never stored twice.
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
	/** On a Project's list: the Graph invariants it inherits, read-only. */
	inherited: Rule[];
}

interface RuleVersion {
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
