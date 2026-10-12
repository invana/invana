/**
 * Reading a SKOS preview for the *Import a standard* dialog — the numbers its
 * **Found** row shows and the concept schemes a refused preview names.
 *
 * Pure functions over the engine's `SkosImportResult`: a top concept with
 * narrower ones is a term (one level) whose values chain by `broader` code;
 * leaf top concepts are the values of one term named after the scheme, which
 * carries the scheme's own IRI and is not a concept.
 *
 * ```ts
 * conceptCount(result);  // 12
 * levelCount(result);    // 3
 * schemesIn("The file holds 2 concept schemes; name one with scheme: a, b."); // ["a", "b"]
 * ```
 */

import type { SkosImportResult, StandardTerm } from "../types";

/** The term named after the scheme holds leaf top concepts; it is not a concept itself. */
const isSchemeTerm = (r: SkosImportResult, t: StandardTerm) =>
	!t.iri || t.iri === r.scheme_iri;

/** How many concepts the preview maps — every value, and every term that is a top concept. */
export function conceptCount(r: SkosImportResult): number {
	return r.terms.reduce(
		(n, t) => n + (t.values?.length ?? 0) + (isSchemeTerm(r, t) ? 0 : 1),
		0,
	);
}

/** How deep the hierarchy goes — the longest top-to-leaf chain, at least 1. */
export function levelCount(r: SkosImportResult): number {
	let deepest = 1;
	for (const t of r.terms) {
		const byCode = new Map((t.values ?? []).map((v) => [v.code, v]));
		const top = isSchemeTerm(r, t) ? 0 : 1;
		for (const v of t.values ?? []) {
			let depth = 1;
			const seen = new Set([v.code]);
			let up = v.broader ? byCode.get(v.broader) : undefined;
			while (up && !seen.has(up.code)) {
				seen.add(up.code);
				depth += 1;
				up = up.broader ? byCode.get(up.broader) : undefined;
			}
			deepest = Math.max(deepest, top + depth);
		}
	}
	return deepest;
}

/** The scheme IRIs a refused preview lists, or `[]` when the message names none. */
export function schemesIn(message: string): string[] {
	const m =
		/name one with scheme:\s*(.+)$/s.exec(message) ??
		/Schemes:\s*(.+)$/s.exec(message);
	if (!m?.[1]) return [];
	return m[1]
		.trim()
		.replace(/\.$/, "")
		.split(/,\s*/)
		.map((s) => s.trim())
		.filter((s) => s && s !== "none");
}
