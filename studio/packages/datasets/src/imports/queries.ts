import { runsApi, useGraphsQuery } from "@invana-studio/core";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
	IMPORT_KINDS,
	type ImportGraph,
	mergeImports,
	WINDOW_DAYS,
} from "./journal";

/**
 * The Imports journal across the install: one runs request per readable Graph
 * and load kind, merged newest first.
 *
 * Runs are Graph-scoped in the engine and there is no install-wide runs
 * endpoint, so the journal fans out over the Graph list. Each key starts
 * `["runs", owner, graph]`, so whatever refreshes a Graph's runs refreshes its
 * rows here too. A Graph whose runs cannot be read is counted, not hidden.
 */
export function useImportsJournal() {
	const graphsQuery = useGraphsQuery();
	const graphs: ImportGraph[] = (graphsQuery.data?.items ?? []).map((g) => ({
		username: g.owner_username,
		graphSlug: g.slug,
		name: g.name,
	}));

	const pairs = graphs.flatMap((graph) =>
		IMPORT_KINDS.map((kind) => ({ graph, kind })),
	);
	const results = useQueries({
		queries: pairs.map(({ graph, kind }) => ({
			queryKey: ["runs", graph.username, graph.graphSlug, "imports", kind],
			queryFn: () =>
				runsApi.list(graph.username, graph.graphSlug, { kind, limit: 50 }),
		})),
	});

	const rows = mergeImports(
		pairs.map(({ graph }, i) => ({
			graph,
			items: results[i]?.data?.items ?? [],
		})),
	);
	const unreadable = new Set(
		pairs
			.filter((_, i) => results[i]?.isError)
			.map(({ graph }) => `${graph.username}/${graph.graphSlug}`),
	).size;

	return {
		rows,
		graphCount: graphs.length,
		unreadable,
		isLoading: graphsQuery.isLoading || results.some((r) => r.isLoading),
		isFetching: graphsQuery.isFetching || results.some((r) => r.isFetching),
		refetch: () => {
			void graphsQuery.refetch();
			for (const r of results) void r.refetch();
		},
	};
}

/**
 * The Imports page's tiles and timeline — counts, median time and imports a
 * day — counted by the engine over every load in every Graph the reader is in,
 * in the reader's days. Never over the fifty newest rows per Graph the list
 * above reads.
 */
export function useImportStatsQuery() {
	return useQuery({
		queryKey: ["runs", "install", "imports", "stats", WINDOW_DAYS] as const,
		queryFn: () =>
			runsApi.installStats({ days: WINDOW_DAYS, kinds: [...IMPORT_KINDS] }),
	});
}
