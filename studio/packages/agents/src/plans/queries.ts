/**
 * TanStack Query hooks for the library: the catalogue, the task plans and one
 * plan's versions, diffs, export, performance and runs over a window, and
 * promoting a plan. Keys are `["flows", owner, graph, …]`, the engine's
 * route name, so promoting invalidates every plan reading at once.
 */

import { type ListQuery, listQueryKey, startAction } from "@invana-studio/core";
import {
	keepPreviousData,
	useInfiniteQuery,
	useMutation,
	useQueries,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { catalogueApi, flowsApi } from "./api";
import type { PlanWindow } from "./types";

type Scope = { username: string; graphSlug: string };

const flowsKey = (s: Scope, extra: unknown[] = []) =>
	["flows", s.username, s.graphSlug, ...extra] as const;

// ── Workflows ────────────────────────────────────────────────────────────────

/** The catalogue is engine-static; only `used_by` moves, and only when a plan is promoted. */
export function useCatalogueQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	query: ListQuery = {},
) {
	const scope = { username: username ?? "", graphSlug: graphSlug ?? "" };
	return useQuery({
		queryKey: flowsKey(scope, ["catalogue", listQueryKey(query)]),
		queryFn: () => catalogueApi.list(scope.username, scope.graphSlug, query),
		enabled: !!username && !!graphSlug,
		staleTime: 5 * 60_000,
		placeholderData: keepPreviousData,
	});
}

/** One page of the plan library for `query`; a caller that needs every plan asks `limit: 200`. */
export function useFlowsQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	query: ListQuery = {},
) {
	const scope = { username: username ?? "", graphSlug: graphSlug ?? "" };
	return useQuery({
		queryKey: flowsKey(scope, ["list", listQueryKey(query)]),
		queryFn: () => flowsApi.list(scope.username, scope.graphSlug, query),
		enabled: !!username && !!graphSlug,
		placeholderData: keepPreviousData,
	});
}

/** One version of a plan, by key — the plan page names a version, not the newest. */
export function usePlanVersionQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	key: string | undefined,
	version: number | undefined,
) {
	const scope = { username: username ?? "", graphSlug: graphSlug ?? "" };
	return useQuery({
		queryKey: flowsKey(scope, [key, version]),
		queryFn: () =>
			flowsApi.get(scope.username, scope.graphSlug, key as string, version),
		enabled: !!username && !!graphSlug && !!key && !!version,
	});
}

/** Every version's diff at once — the Versions page's column. A published
 *  version is immutable, so its diff never goes stale. */
export function usePlanDiffsQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	key: string | undefined,
	versions: number[],
) {
	const scope = { username: username ?? "", graphSlug: graphSlug ?? "" };
	return useQueries({
		queries: versions.map((version) => ({
			queryKey: flowsKey(scope, [key, "diff", version]),
			queryFn: () =>
				flowsApi.diff(scope.username, scope.graphSlug, key as string, version),
			enabled: !!username && !!graphSlug && !!key,
			staleTime: Number.POSITIVE_INFINITY,
		})),
	});
}

/** A version's YAML. Immutable, like its diff. */
export function usePlanExportQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	key: string | undefined,
	version: number | undefined,
) {
	const scope = { username: username ?? "", graphSlug: graphSlug ?? "" };
	return useQuery({
		queryKey: flowsKey(scope, [key, "export", version]),
		queryFn: () =>
			flowsApi.exportText(
				scope.username,
				scope.graphSlug,
				key as string,
				version as number,
			),
		enabled: !!username && !!graphSlug && !!key && version != null,
		staleTime: Number.POSITIVE_INFINITY,
	});
}

/** How a plan has behaved over a window. */
export function usePlanPerformanceQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	key: string | undefined,
	q: { version: number; window: PlanWindow } | undefined,
) {
	const scope = { username: username ?? "", graphSlug: graphSlug ?? "" };
	return useQuery({
		queryKey: flowsKey(scope, [key, "performance", q]),
		queryFn: () =>
			flowsApi.performance(
				scope.username,
				scope.graphSlug,
				key as string,
				q as {
					version: number;
					window: PlanWindow;
				},
			),
		enabled: !!username && !!graphSlug && !!key && !!q,
	});
}

/** Every run of a plan, 50 a page — `Show 50 more` fetches the next. */
export function usePlanRunsQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	key: string | undefined,
	q:
		| {
				version: number;
				window: PlanWindow;
				status?: string;
				calledBy?: string;
				agentId?: string;
		  }
		| undefined,
) {
	const scope = { username: username ?? "", graphSlug: graphSlug ?? "" };
	return useInfiniteQuery({
		queryKey: flowsKey(scope, [key, "runs", q]),
		queryFn: ({ pageParam }) =>
			flowsApi.runs(scope.username, scope.graphSlug, key as string, {
				...(q as NonNullable<typeof q>),
				cursor: pageParam ?? undefined,
			}),
		initialPageParam: null as string | null,
		getNextPageParam: (page) => page.next_cursor,
		enabled: !!username && !!graphSlug && !!key && !!q,
	});
}

/**
 * **Promote a plan** — the workflow library's only write (docs/for-developers/modules/agents/spec.md).
 *
 * Invalidates workflows *and* runs: the promoted plan leaves the
 * candidates list the moment a library entry claims it as its origin, and a
 * candidates list still offering it would invite a second, duplicate promotion.
 */
export function usePromoteFlowMutation(username: string, graphSlug: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (data: {
			run_id: string;
			key: string;
			description?: string;
			intents?: string[];
		}) => {
			const action = startAction("plans", "promote", {
				"invana.graph": `${username}/${graphSlug}`,
				"invana.run_id": data.run_id,
			});
			return flowsApi.promote(username, graphSlug, data, action).then(
				(plan) => {
					action.end("promoted");
					return plan;
				},
				(err) => {
					action.fail(err);
					throw err;
				},
			);
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["flows", username, graphSlug] });
			qc.invalidateQueries({ queryKey: ["runs", username, graphSlug] });
		},
	});
}
