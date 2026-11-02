/**
 * What the app lends the Activity product: the page its routes render (the
 * product host), and its rail's counts — the runs live now and the asks
 * waiting for the reader, read by the agents package's queries, which the
 * product may not import.
 *
 * One module-level object, so the hook and the component it carries are the
 * same on every render.
 */

import type { ActivityProductSlotsContext } from "@invana-studio/activity";
import { useAsksQuery, useRunsTilesQuery } from "@invana-studio/agents";
import type { ListQuery } from "@invana-studio/core";
import type { ContextType } from "react";
import { useParams } from "react-router-dom";
import { ProductHostRoute } from "@/host/ProductHostRoute";

const FOR_YOU: ListQuery = { filters: { view: ["for_you"] }, limit: 1 };

function useRailCounts() {
	const { username, graphSlug } = useParams();
	const runs = useRunsTilesQuery(username, graphSlug);
	const asks = useAsksQuery(username, graphSlug, FOR_YOU);
	return { runs: runs.data?.live, approvals: asks.data?.for_you };
}

export const activityProductSlots: NonNullable<
	ContextType<typeof ActivityProductSlotsContext>
> = {
	Page: ProductHostRoute,
	useRailCounts,
};
