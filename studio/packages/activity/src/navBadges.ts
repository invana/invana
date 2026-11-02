/**
 * The Activity rail's counts: Runs carries the runs live now, Approvals the
 * asks waiting for the reader, Inbox what needs the reader. Every one is the
 * engine's number — the Runs tiles' `live`, the asks page's `for_you`, the
 * Inbox's count — read through the hooks the pages use, so the rail and the
 * page share one cache entry each.
 */
import { useInbox } from "@invana-studio/shell";
import { useParams } from "react-router-dom";
import { useActivityProductSlots } from "./ActivitySlots";

export function useActivityNavBadges(): Partial<Record<string, number>> {
	const { username, graphSlug } = useParams();
	const { runs, approvals } = useActivityProductSlots().useRailCounts();
	const inbox = useInbox(
		username && graphSlug ? { username, graphSlug } : undefined,
	);
	return { runs, approvals, inbox: inbox.count };
}
