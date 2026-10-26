/**
 * What a lens narrows, as the section states it.
 *
 * This mirrors `invana govern list` exactly — the CLI and the section are two
 * readings of one record, and a world that reads `4 allow · sliced · closes
 * graph_data` in a terminal must not read as something else on screen.
 */

import type { GovernLayer, GovernRule, Lens } from "@invana-studio/core";

/** The five layers a rule may govern. The spine is not one of them. */
export const GOVERNED_LAYERS: GovernLayer[] = [
	"graph_data",
	"llm",
	"third_party",
	"cache",
	"human",
];

/** The layer a rule governs — an address names its layer first. */
function ruleLayer(rule: GovernRule): GovernLayer {
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
 * What one layer's band says about itself.
 *
 * **A closed layer says so**, because closing is a stated field and not
 * something inferred from *there is an allow rule in this band* — an implicit
 * allow-list is exactly the bound an auditor cannot see.
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
