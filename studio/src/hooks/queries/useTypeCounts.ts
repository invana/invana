// The graph's node and edge types with graph-wide counts — the Explorer
// panel's legend (docs/for-developers/modules/explore/features/selection-and-the-panel.md SP6).

import { explorerApi } from "@/services/api/explorer";
import { useQuery } from "@tanstack/react-query";

const TYPE_COUNTS_KEY = ["type-counts"] as const;

/**
 * Counting a whole graph is not free, so this is cached for the session rather
 * than refetched on every focus: the type list changes when data is imported,
 * not while someone is reading it.
 */
export function useTypeCountsQuery(
	username: string | undefined,
	graphSlug: string | undefined,
) {
	return useQuery({
		queryKey: [...TYPE_COUNTS_KEY, username ?? "", graphSlug ?? ""],
		queryFn: () =>
			explorerApi.typeCounts(username as string, graphSlug as string),
		enabled: !!username && !!graphSlug,
		staleTime: 5 * 60_000,
		refetchOnWindowFocus: false,
	});
}
