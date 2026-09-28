/**
 * An address, taken apart and put back together — so every control in the
 * authoring form is a **pick** rather than a field somebody types into
 * ([WO7](../../../../../docs/for-developers/modules/govern/features/worlds.md)).
 *
 * `<layer>/<sublayer>/<name>` is the only identifier a rule has
 * ([GV4](../../../../../docs/for-developers/modules/govern/spec.md)), and the
 * three wildcards are part of the vocabulary rather than an escape from it:
 * `*` is one segment, `**` is the rest, and a `*` **inside** a segment globs it
 * — which is how `graph_data/model/Deals@*` names a model across its versions
 * without stopping the day somebody publishes a new one.
 *
 * **The wildcards are options, not typing.** Offering `Deals@*` beside
 * `Deals@1.0.1` in the same picker is what makes the version-proof rule as easy
 * to write as the brittle one; leaving it to a keystroke makes the brittle one
 * the default.
 */

import type { GovernLayer, Participant } from "@/types/govern";

/** Any sublayer. One segment — the middle one. */
export const ANY_SUBLAYER = "*";
/** Everything under here. The rest of the address, however many segments. */
export const REST = "**";

export interface AddressParts {
	layer: GovernLayer;
	sublayer: string;
	name: string;
}

/**
 * Three picks → one pattern.
 *
 * `graph_data/*\/**` collapses to `graph_data/**`: a middle segment that
 * matches anything, followed by a tail that matches everything, says nothing
 * the tail does not already say — and two spellings of one bound are two things
 * an auditor has to know are the same.
 */
export function buildMatch({ layer, sublayer, name }: AddressParts): string {
	if (sublayer === ANY_SUBLAYER && name === REST) return `${layer}/${REST}`;
	return `${layer}/${sublayer}/${name}`;
}

/** A pattern → the three picks that would rebuild it. */
export function splitMatch(match: string): AddressParts {
	const [layer, ...rest] = match.split("/");
	if (!rest.length) {
		return { layer: layer as GovernLayer, sublayer: ANY_SUBLAYER, name: REST };
	}
	if (rest.length === 1) {
		return {
			layer: layer as GovernLayer,
			sublayer: rest[0] === REST ? ANY_SUBLAYER : rest[0],
			name: REST,
		};
	}
	// A third-party address runs past three segments — `third_party/api/
	// clearbit.com/v2/companies` — so the name is everything after the sublayer.
	return {
		layer: layer as GovernLayer,
		sublayer: rest[0],
		name: rest.slice(1).join("/"),
	};
}

/** The sublayers this layer actually has, in the order the catalogue gives them. */
export function sublayersIn(
	participants: Participant[],
	layer: GovernLayer,
): string[] {
	return [
		...new Set(
			participants.filter((p) => p.layer === layer).map((p) => p.sublayer),
		),
	];
}

/**
 * What the name picker offers for one (layer, sublayer).
 *
 * Every participant by its exact name, plus — for anything carrying an `@`
 * discriminator — the `@*` form beside it. A model version and *every version
 * of that model* are two different bounds, and only one of them survives the
 * next publish.
 */
export function nameOptionsIn(
	participants: Participant[],
	layer: GovernLayer,
	sublayer: string,
): { value: string; label: string; description?: string }[] {
	const here = participants.filter(
		(p) =>
			p.layer === layer &&
			(sublayer === ANY_SUBLAYER || p.sublayer === sublayer),
	);

	const exact = here.map((p) => ({
		value: p.name,
		label: p.name,
		description: p.label,
	}));

	const globbed = [
		...new Set(
			here
				.filter((p) => p.name.includes("@"))
				.map((p) => `${p.name.split("@")[0]}@*`),
		),
	].map((value) => ({
		value,
		label: value,
		description: "every published version — survives the next publish",
	}));

	return [
		{
			value: REST,
			label: REST,
			description: "everything under here, however deep",
		},
		...globbed,
		...exact,
	];
}

/**
 * Does this pattern reach this address? The same three wildcards the engine
 * reads, so the preview and the save never disagree about what a rule bites.
 *
 * Mirrors `apps/govern/addressing.py`. It is duplicated rather than asked for
 * because the preview answers on every keystroke of a pick, and a round trip
 * per pick would make the near-misses arrive after the eye has moved on — the
 * catalogue itself is still the server's (GV21), only the matching is local.
 */
export function matches(pattern: string, address: string): boolean {
	const p = pattern.split("/");
	const a = address.split("/");

	for (let i = 0; i < p.length; i++) {
		if (p[i] === REST) return true;
		if (i >= a.length) return false;
		if (!segmentMatches(p[i], a[i])) return false;
	}
	return p.length === a.length;
}

function segmentMatches(pattern: string, segment: string): boolean {
	if (pattern === ANY_SUBLAYER) return true;
	if (!pattern.includes(ANY_SUBLAYER)) return pattern === segment;
	// A `*` inside a segment globs it — `Deals@*`, `claude-*`.
	const escaped = pattern
		.split(ANY_SUBLAYER)
		.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
		.join(".*");
	return new RegExp(`^${escaped}$`).test(segment);
}
