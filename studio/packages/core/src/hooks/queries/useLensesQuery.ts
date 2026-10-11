/**
 * The Graph's worlds and guardrails, as one cached list.
 *
 * The key sits under `["govern", user, graph, "lenses"]`, the prefix every
 * lens mutation in the Modeller invalidates, so authoring a lens refreshes
 * every product that reads the list.
 */

import { useQuery } from "@tanstack/react-query";
import { lensesApi } from "../../services/api/lenses";
import type { LensKind } from "../../types/lenses";

export function useLensesQuery(
	username?: string,
	graphSlug?: string,
	opts: { kind?: LensKind; includeUnnamed?: boolean } = {},
) {
	return useQuery({
		queryKey: [
			"govern",
			username ?? "",
			graphSlug ?? "",
			"lenses",
			opts,
		] as const,
		queryFn: () =>
			lensesApi.list(username as string, graphSlug as string, opts),
		enabled: !!username && !!graphSlug,
	});
}
