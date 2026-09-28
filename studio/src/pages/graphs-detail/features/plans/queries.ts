/**
 * TanStack Query hooks for the library: the catalogue, the task plans and one
 * plan's versions, diffs, export, performance and runs over a window, and
 * promoting a plan. Keys are `["workflows", owner, graph, …]`, the engine's
 * route name, so promoting invalidates every plan reading at once.
 */

import {
	catalogueApi,
	taskPlansApi,
} from "@/pages/graphs-detail/features/plans/api";
import type { PlanWindow } from "@/pages/graphs-detail/features/plans/types";
import { startAction } from "@/services/telemetry/tracer";
import {
	useInfiniteQuery,
	useMutation,
	useQueries,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";

type Scope = { username: string; graphSlug: string };

const taskPlansKey = (s: Scope, extra: unknown[] = []) =>
	["workflows", s.username, s.graphSlug, ...extra] as const;

// ── Workflows ────────────────────────────────────────────────────────────────

/** The catalogue is engine-static; only `used_by` moves, and only when a plan is promoted. */
export function useCatalogueQuery(
	username: string | undefined,
	graphSlug: string | undefined,
) {
	const scope = { username: username ?? "", graphSlug: graphSlug ?? "" };
	return useQuery({
		queryKey: taskPlansKey(scope, ["catalogue"]),
		queryFn: () => catalogueApi.list(scope.username, scope.graphSlug),
		enabled: !!username && !!graphSlug,
		staleTime: 5 * 60_000,
	});
}

export function useTaskPlansQuery(
	username: string | undefined,
	graphSlug: string | undefined,
) {
	const scope = { username: username ?? "", graphSlug: graphSlug ?? "" };
	return useQuery({
		queryKey: taskPlansKey(scope),
		queryFn: () => taskPlansApi.list(scope.username, scope.graphSlug),
		enabled: !!username && !!graphSlug,
	});
}

export function useTaskPlanQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	key: string | undefined,
) {
	const scope = { username: username ?? "", graphSlug: graphSlug ?? "" };
	return useQuery({
		queryKey: taskPlansKey(scope, [key]),
		queryFn: () =>
			taskPlansApi.get(scope.username, scope.graphSlug, key as string),
		enabled: !!username && !!graphSlug && !!key,
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
		queryKey: taskPlansKey(scope, [key, version]),
		queryFn: () =>
			taskPlansApi.get(scope.username, scope.graphSlug, key as string, version),
		enabled: !!username && !!graphSlug && !!key && !!version,
	});
}

/** A published version is immutable, so its diff never goes stale. */
export function usePlanDiffQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	key: string | undefined,
	version: number | undefined,
) {
	const scope = { username: username ?? "", graphSlug: graphSlug ?? "" };
	return useQuery({
		queryKey: taskPlansKey(scope, [key, "diff", version]),
		queryFn: () =>
			taskPlansApi.diff(
				scope.username,
				scope.graphSlug,
				key as string,
				version as number,
			),
		enabled: !!username && !!graphSlug && !!key && version != null,
		staleTime: Number.POSITIVE_INFINITY,
	});
}

/** Every version's diff at once — the Versions page's column (LB38). */
export function usePlanDiffsQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	key: string | undefined,
	versions: number[],
) {
	const scope = { username: username ?? "", graphSlug: graphSlug ?? "" };
	return useQueries({
		queries: versions.map((version) => ({
			queryKey: taskPlansKey(scope, [key, "diff", version]),
			queryFn: () =>
				taskPlansApi.diff(
					scope.username,
					scope.graphSlug,
					key as string,
					version,
				),
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
		queryKey: taskPlansKey(scope, [key, "export", version]),
		queryFn: () =>
			taskPlansApi.exportText(
				scope.username,
				scope.graphSlug,
				key as string,
				version as number,
			),
		enabled: !!username && !!graphSlug && !!key && version != null,
		staleTime: Number.POSITIVE_INFINITY,
	});
}

/** How a plan has behaved over a window (LB33 · LB36). */
export function usePlanPerformanceQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	key: string | undefined,
	q: { version: number; window: PlanWindow } | undefined,
) {
	const scope = { username: username ?? "", graphSlug: graphSlug ?? "" };
	return useQuery({
		queryKey: taskPlansKey(scope, [key, "performance", q]),
		queryFn: () =>
			taskPlansApi.performance(
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

/** Every run of a plan, 50 a page — `Show 50 more` fetches the next (LB34). */
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
		queryKey: taskPlansKey(scope, [key, "runs", q]),
		queryFn: ({ pageParam }) =>
			taskPlansApi.runs(scope.username, scope.graphSlug, key as string, {
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
export function usePromoteTaskPlanMutation(
	username: string,
	graphSlug: string,
) {
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
			return taskPlansApi.promote(username, graphSlug, data, action).then(
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
			qc.invalidateQueries({ queryKey: ["workflows", username, graphSlug] });
			qc.invalidateQueries({ queryKey: ["runs", username, graphSlug] });
		},
	});
}
