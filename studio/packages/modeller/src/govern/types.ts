/**
 * Govern — the Graph's guardrails as property rules, and the lens view.
 *
 * A Graph's guardrail is **one property rule**: a `Type.property` target, what
 * a run may do with it, and whether the result may leave. The engine compiles
 * it into the lens grammar at save, so Studio authors the three fields and
 * never the rules. The lens view is the engine's compile of the guardrails
 * (and, with a world, of that world) against every published version — the
 * canvas draws *hidden*, *sliced* and *guarded* from it and re-reads no rule.
 *
 * Shapes follow the engine's `apps/govern/schemas.py`.
 */

/** What a run may do with the guarded property. */
export type GuardrailAccess = "read" | "counts" | "never";

/** A world named by id and name — enough for a chip. */
interface WorldRef {
	id: string;
	name: string;
}

/** One Graph guardrail, as the list reads it. */
export interface Guardrail {
	id: string;
	/** Generated from the rule — `Deal.price never leaves`. */
	name: string;
	key: string;
	/** `Type.property`; `*` stands for any type or any property. */
	target: string;
	access: GuardrailAccess;
	/** Whether the result may leave the Graph to a model or third party. */
	leaves: boolean;
	/** The worlds this guardrail does not bind in. */
	allowed_in: WorldRef[];
	/** How many types carry the property — counted by the engine. */
	types: number;
	/** Refusals it caused in the last seven days — counted by the engine. */
	refused_7d: number;
	created_at: string;
	updated_at: string;
}

export interface GuardrailPage {
	items: Guardrail[];
	total: number;
	/** Whether the reader holds the `modeller` role. */
	may_edit: boolean;
}

/** One refusal a guardrail caused — the request it filed. */
export interface GuardrailRefusal {
	request_id: string;
	who: string;
	where: string;
	at: string;
}

interface GuardrailHistoryEntry {
	action: string;
	actor: string | null;
	at: string;
	details: Record<string, unknown> | null;
}

export interface GuardrailDetail extends Guardrail {
	applies_to: { model: string; type: string; property: string }[];
	refusals: GuardrailRefusal[];
	refusals_total: number;
	history: GuardrailHistoryEntry[];
}

/** One `Type.property` the rule picker offers, from published versions. */
export interface GuardrailTarget {
	target: string;
	model: string;
	type: string;
	property: string;
}

/** What a guardrail save would cost, counted before the write. */
export interface GuardrailImpact {
	worlds: WorldRef[];
	schedules: { id: string; name: string }[];
	sentence: string;
}

export interface GuardrailRule {
	target: string;
	access: GuardrailAccess;
	leaves: boolean;
}

export interface GuardrailUpdate {
	access?: GuardrailAccess;
	leaves?: boolean;
	/** World ids. */
	allowed_in?: string[];
}

/** How much of a model a world sees. */
type ModelSeen = "all" | "sliced" | "hidden";

interface LensViewGuard {
	property: string;
	guardrail_id: string;
	guardrail: string;
	access: GuardrailAccess;
	leaves: boolean;
}

export interface LensViewType {
	model: string;
	type: string;
	hidden: boolean;
	sliced: boolean;
	excluded: string[];
	guarded: LensViewGuard[];
}

/**
 * The lens canvas and the world inspector, in one read. Without a world it is
 * the guardrails alone: no type hidden, the guarded properties shielded.
 */
export interface LensView {
	world: WorldRef | null;
	models: { name: string; version: string; seen: ModelSeen }[];
	types: LensViewType[];
	hidden_types: string[];
	/** How many properties a guardrail shields. */
	guarded: number;
	window: { time: string | null; geo: string | null };
	thinks_with: Record<string, string>;
	/** `may_send` null means the destination is closed. */
	answers_go: { address: string; may_send: string[] | null }[];
	used_by: { kind: string; id: string; name: string; runs: number }[];
}
