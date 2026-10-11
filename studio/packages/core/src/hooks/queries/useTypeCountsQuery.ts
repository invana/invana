// The node and edge types the picked world holds, counted inside it — the
// Explorer panel's legend and the expand menus' vocabulary, and the Modeller's
// record counts (docs/for-developers/modules/explore/features/selection-and-the-panel.md).

import { useQuery } from "@tanstack/react-query";
import { request } from "../../services/api/client";
import type { TypeCountsResponse } from "../../types/typeCounts";

const TYPE_COUNTS_KEY = ["type-counts"] as const;

/**
 * Node and edge types with graph-wide counts.
 *
 * Graph-wide, not canvas-wide: the panel answers "what does this graph hold",
 * the status bar answers "what am I looking at". Under a world (`lensId`)
 * a type the world denies is absent and every count is taken inside it.
 * `counted: false` means the vendor cannot count and every `count`
 * is null.
 */
const typeCounts = (
	username: string,
	graphSlug: string,
	lensId?: string | null,
) =>
	request<TypeCountsResponse>(
		`/api/v1/u/${username}/${graphSlug}/explorer/type-counts${
			lensId ? `?lens_id=${encodeURIComponent(lensId)}` : ""
		}`,
	);

/**
 * Counting a whole graph is not free, so this is cached for the session rather
 * than refetched on every focus: the type list changes when data is imported,
 * not while someone is reading it.
 */
export function useTypeCountsQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	/** The picked world — counts are taken inside it. */
	lensId?: string | null,
) {
	return useQuery({
		queryKey: [
			...TYPE_COUNTS_KEY,
			username ?? "",
			graphSlug ?? "",
			lensId ?? "",
		],
		queryFn: () => typeCounts(username as string, graphSlug as string, lensId),
		enabled: !!username && !!graphSlug,
		staleTime: 5 * 60_000,
		refetchOnWindowFocus: false,
	});
}
