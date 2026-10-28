/**
 * A guardrail's rule in words — one place, so the inspector, the canvas chips
 * and the rule dialog never word the same rule two ways.
 */

import type { GuardrailAccess } from "../types";

/** The three answers to *It may*. */
export const ACCESS_LABEL: Record<GuardrailAccess, string> = {
	read: "Read",
	counts: "Read in counts only",
	never: "Never read",
};

/** What a guard does to its property, as a chip says it — `never read`. */
export function guardWord(g: {
	access: GuardrailAccess;
	leaves: boolean;
}): string {
	if (g.access === "never") return "never read";
	if (g.access === "counts")
		return g.leaves ? "counts only" : "counts only · stays";
	return g.leaves ? "read" : "stays in the Graph";
}

/** The rule as the inspector's sentence. */
export function ruleSentence(g: {
	access: GuardrailAccess;
	leaves: boolean;
}): string {
	const read =
		g.access === "never"
			? "Never read: no query may reference it, and whole records are returned without it."
			: g.access === "counts"
				? "Read in counts only: a query may filter, count and aggregate it, and never return its value."
				: "May be read.";
	const leave = g.leaves
		? "The result may leave the Graph."
		: "The result stays in the Graph: no model or third party is sent property values.";
	return `${read} ${leave}`;
}
