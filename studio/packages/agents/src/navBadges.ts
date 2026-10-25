/**
 * The Agents rail's counts: Runs carries the runs live now, Approvals the asks
 * waiting for the reader. Both are the engine's numbers — the Runs tiles'
 * `live` and the asks page's `for_you` — read through the hooks the pages use,
 * so the rail and the page share one cache entry each.
 */
import { useParams } from "react-router-dom";
import { useAsksQuery } from "./approvals/queries";
import { useRunsTilesQuery } from "./runs/queries";

export function useAgentsNavBadges(): Partial<Record<string, number>> {
	const { username, graphSlug } = useParams();
	const runs = useRunsTilesQuery(username, graphSlug);
	const asks = useAsksQuery(username, graphSlug, {
		filters: { view: ["for_you"] },
		limit: 1,
	});
	return { runs: runs.data?.live, approvals: asks.data?.for_you };
}
