/**
 * What a lens narrows, as the drawer states it.
 *
 * This mirrors `invana govern list` exactly — the CLI and the drawer are two
 * readings of one record, and a world that reads `4 allow · sliced · closes
 * graph_data` in a terminal must not read as something else on screen.
 */

import type { CastRole, GovernLayer, GovernRule, Lens } from "@/types/govern";
import type { Narrowing } from "@invana/ui";

/** The five layers a rule may govern. The spine is not one of them. */
export const GOVERNED_LAYERS: GovernLayer[] = [
	"graph_data",
	"llm",
	"third_party",
	"cache",
	"human",
];

/** The layer a rule governs — an address names its layer first. */
export function ruleLayer(rule: GovernRule): GovernLayer {
	return (rule.match.split("/")[0] ?? "graph_data") as GovernLayer;
}

export function rulesInLayer(lens: Lens, layer: GovernLayer): GovernRule[] {
	return (lens.rules ?? []).filter((r) => ruleLayer(r) === layer);
}

function isSliced(rule: GovernRule): boolean {
	const s = rule.select;
	return Boolean(
		s && (s.time || s.geo || Object.keys(s.dims ?? {}).length > 0),
	);
}

/**
 * The six kinds of narrowing, in the order the CLI prints them.
 *
 * An empty result is meaningful and the row renders it in words: *narrows
 * nothing — the whole model, inside the guardrails*. `Everything` is a real
 * world and the default one.
 */
export function narrowingsOf(lens: Lens): Narrowing[] {
	const rules = lens.rules ?? [];
	const allows = rules.filter((r) => r.allow).length;
	const denies = rules.length - allows;
	const out: Narrowing[] = [];

	if (allows) out.push({ kind: "allow", count: allows });
	if (denies) out.push({ kind: "deny", count: denies });
	if (rules.some(isSliced)) out.push({ kind: "sliced" });

	const excluded = [
		...new Set(rules.flatMap((r) => r.properties?.exclude ?? [])),
	].sort();
	if (excluded.length) out.push({ kind: "excludes", properties: excluded });

	if (lens.closed_layers?.length) {
		out.push({ kind: "closes", layers: lens.closed_layers });
	}

	const roles = Object.keys(lens.cast ?? {}).sort() as CastRole[];
	if (roles.length) out.push({ kind: "casts", roles });

	return out;
}

/**
 * What one layer's band says about itself.
 *
 * **A closed layer says so**, because closing is a stated field and not
 * something inferred from *there is an allow rule in this band* — an implicit
 * allow-list is exactly the bound an auditor cannot see (GV23).
 */
export function layerSummary(lens: Lens, layer: GovernLayer): string {
	const rules = rulesInLayer(lens, layer);
	const closed = (lens.closed_layers ?? []).includes(layer);

	if (!rules.length) {
		return closed ? "closed · nothing is allowed in" : "permitted whole";
	}

	const allows = rules.filter((r) => r.allow).length;
	const denies = rules.length - allows;
	const sliced = rules.filter(isSliced).length;

	const bits: string[] = [];
	if (closed) bits.push("closed");
	if (allows) bits.push(`${allows} allow`);
	if (denies) bits.push(`${denies} deny`);
	if (sliced) bits.push(`${sliced} sliced`);
	if (!closed) bits.push("the rest permitted whole");

	return bits.join(" · ");
}

/** `2h ago` — the row states usage, and never owns a clock. */
export function since(iso: string | null | undefined): string | undefined {
	if (!iso) return undefined;
	const then = new Date(iso).getTime();
	if (Number.isNaN(then)) return undefined;
	const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.round(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	return `${Math.round(hours / 24)}d ago`;
}
