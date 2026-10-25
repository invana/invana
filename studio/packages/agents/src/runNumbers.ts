/**
 * The numbers of the runs open as workbook tabs, so a run's tab reads
 * `Run #N`. Each comes off the run head the run page already reads — the same
 * query key, fetched once by whichever reads it first — so a tab title costs
 * no request of its own.
 */
import { useQueries } from "@tanstack/react-query";
import { runPageApi } from "./runs/api";
import type { RunOverview } from "./runs/types";

export function useRunNumbers(
	username: string | undefined,
	graphSlug: string | undefined,
	runIds: readonly string[],
): Map<string, number> {
	return useQueries({
		queries: runIds.map((id) => ({
			queryKey: ["run-page", username, graphSlug, id, "overview"],
			queryFn: () =>
				runPageApi.overview(username as string, graphSlug as string, id),
			enabled: !!username && !!graphSlug,
			staleTime: 60_000,
		})),
		combine: (results) =>
			new Map(
				results.flatMap((r, i) => {
					const n = (r.data as RunOverview | undefined)?.head.number;
					return n == null ? [] : [[runIds[i] as string, n] as const];
				}),
			),
	});
}
