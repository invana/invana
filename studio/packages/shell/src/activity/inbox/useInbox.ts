import { type GraphRef, runsApi } from "@invana-studio/core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { inboxOf } from "./inbox";

/**
 * The Graph's last 100 runs — one read shared by the Inbox, the bell's count
 * and ⌘K's Activity group. Under the journal's `["runs", owner, graph]` key,
 * so whatever refreshes the journal refreshes these too.
 */
export function recentRunsQuery(graph: GraphRef | undefined) {
	return {
		queryKey: ["runs", graph?.username, graph?.graphSlug, "recent"] as const,
		queryFn: () =>
			runsApi.list(graph?.username as string, graph?.graphSlug as string, {
				limit: 100,
			}),
		enabled: !!graph,
		staleTime: 30_000,
	};
}

/** What needs a person on this Graph, newest first. */
export function useInbox(graph: GraphRef | undefined) {
	const runs = useQuery(recentRunsQuery(graph));
	// The window is measured from when the page first read it, not re-read on
	// every render, so a row cannot fall out while the person looks at it.
	const [now] = useState(() => Date.now());
	return {
		items: runs.data ? inboxOf(runs.data.items, now) : [],
		isLoading: runs.isLoading,
		isError: runs.isError,
		isFetching: runs.isFetching,
		refetch: runs.refetch,
	};
}
