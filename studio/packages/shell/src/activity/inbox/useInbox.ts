import { type GraphRef, runsApi } from "@invana-studio/core";
import { useQuery } from "@tanstack/react-query";
import {
	useNotificationsQuery,
	usePendingApprovalsQuery,
} from "../notifications/queries";
import { inboxCount, inboxOf } from "./inbox";

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

/**
 * What needs a person on this Graph — approvals, runs waiting on an answer,
 * then notifications — and the count the bell and the Inbox tab carry.
 */
export function useInbox(graph: GraphRef | undefined) {
	const runs = useQuery(recentRunsQuery(graph));
	const notifications = useNotificationsQuery(graph);
	const approvals = usePendingApprovalsQuery(graph);
	const items = inboxOf(
		approvals.data?.items ?? [],
		runs.data?.items ?? [],
		notifications.data?.items ?? [],
	);
	const reads = [runs, notifications, approvals];
	return {
		items,
		count: inboxCount(items),
		unread: notifications.data?.unread ?? 0,
		isLoading: reads.some((r) => r.isLoading),
		isError: reads.some((r) => r.isError),
		isFetching: reads.some((r) => r.isFetching),
		refetch: () => Promise.all(reads.map((r) => r.refetch())),
	};
}
