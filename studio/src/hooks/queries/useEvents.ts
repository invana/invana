/**
 * TanStack Query hooks for paginated audit-event reads (RFC-018).
 *
 * Keyset pagination — the `next_cursor` from the response is fed back into
 * the next query as `cursor`. We use `useInfiniteQuery` so the Studio
 * surfaces can render an append-as-you-scroll list naturally.
 */

import { useInfiniteQuery } from "@tanstack/react-query";
import { eventsApi } from "../../services/api/events";
import type { EventListFilters } from "../../types/events";

const STALE_MS = 30_000; // 30s — events are streamed live; cache rarely matters.

export function useGraphEventsQuery(
	username: string,
	graphSlug: string,
	filters?: Omit<EventListFilters, "cursor" | "graph_id">,
) {
	return useInfiniteQuery({
		queryKey: ["events", "graph", username, graphSlug, filters] as const,
		queryFn: ({ pageParam }) =>
			eventsApi.listForGraph(username, graphSlug, {
				...filters,
				cursor: pageParam as string | undefined,
			}),
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (last) => last.next_cursor ?? undefined,
		staleTime: STALE_MS,
	});
}

export function useGlobalEventsQuery(
	filters?: Omit<EventListFilters, "cursor">,
) {
	return useInfiniteQuery({
		queryKey: ["events", "global", filters] as const,
		queryFn: ({ pageParam }) =>
			eventsApi.listGlobal({
				...filters,
				cursor: pageParam as string | undefined,
			}),
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (last) => last.next_cursor ?? undefined,
		staleTime: STALE_MS,
	});
}
