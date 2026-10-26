/**
 * What queries crossed each stitch over 30 days — Usage's per-stitch
 * aggregate, keyed by the stitch's id. The engine counts it; this only reads
 * it. A stitch with no entry was not crossed.
 */

import { useMemo } from "react";
import { useModelInsightsQuery } from "../queries";
import type { Usage } from "../types";

type Crossing = Usage["stitches"][number];

export interface StitchCrossings {
	/** The aggregate has been read; a missing id then means *never crossed*. */
	ready: boolean;
	byId: ReadonlyMap<string, Crossing>;
}

export function useStitchCrossings(
	username: string | undefined,
	graphSlug: string | undefined,
): StitchCrossings {
	const insights = useModelInsightsQuery(username, graphSlug, null, "30d");
	const usage = insights.data?.usage ?? null;
	return useMemo(
		() => ({
			ready: usage !== null,
			byId: new Map((usage?.stitches ?? []).map((s) => [s.id, s])),
		}),
		[usage],
	);
}

/** `crossed by 12 queries` · `never crossed by a query` — and nothing before it is read. */
export function crossedLine(
	crossings: StitchCrossings,
	linkId: string,
): string | null {
	if (!crossings.ready) return null;
	const queries = crossings.byId.get(linkId)?.queries ?? 0;
	if (queries === 0) return "never crossed by a query";
	return `crossed by ${queries.toLocaleString()} ${queries === 1 ? "query" : "queries"}`;
}
