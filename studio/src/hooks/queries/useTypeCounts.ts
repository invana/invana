// The node and edge types the picked world holds, counted inside it — the
// Explorer panel's legend and the expand menus' vocabulary (docs/for-developers/modules/explore/features/selection-and-the-panel.md SP6).

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
	/** The picked world — counts are taken inside it (SP11). */
	lensId?: string | null,
) {
	return useQuery({
		queryKey: [
			...TYPE_COUNTS_KEY,
			username ?? "",
			graphSlug ?? "",
			lensId ?? "",
		],
		queryFn: () =>
			explorerApi.typeCounts(username as string, graphSlug as string, lensId),
		enabled: !!username && !!graphSlug,
		staleTime: 5 * 60_000,
		refetchOnWindowFocus: false,
	});
}
