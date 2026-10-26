/**
 * The words a stitch is read in, one place: what it holds in the graph now, and
 * the rule of one that was removed. The numbers are the engine's — these only
 * set them in a sentence.
 */

import { formatGrouped } from "@invana-studio/core";
import type { ModelLink, RemovedStitch } from "../types";

/** What the stitch holds now — *N joined* for an anchor, *N edges* for a relationship. */
export function holds(link: Pick<ModelLink, "kind" | "edges">): string {
	if (link.edges === null) return "not solved yet";
	const n = formatGrouped(link.edges);
	return link.kind === "anchor"
		? `${n} joined`
		: `${n} ${link.edges === 1 ? "edge" : "edges"}`;
}

/** `NewsArticles.Country ≡ AirRoutes.country` for a removed stitch, as it was declared. */
export function removedPair(r: RemovedStitch): string {
	const left = `${r.source_model ?? "?"}.${r.source_type}`;
	const right = `${r.target_model ?? "?"}.${r.target_type}`;
	return `${left} ${r.kind === "anchor" ? "≡" : `-[${r.edge_type ?? "?"}]->`} ${right}`;
}
