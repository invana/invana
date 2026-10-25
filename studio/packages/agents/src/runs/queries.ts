/**
 * TanStack Query hooks for the run page. Keys are `["run-page", owner, graph,
 * runId, part]`; a run still going is read again every five seconds, a settled
 * one is not.
 */

import {
	type ListQuery,
	listQueryKey,
	type RerunRetune,
	type RerunVersions,
	runsApi,
} from "@invana-studio/core";
import {
	keepPreviousData,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { runPageApi } from "./api";

type Part = "overview" | "agents" | "stages" | "assets" | "touched";

const LIVE_MS = 5_000;

const SETTLED = new Set(["succeeded", "failed", "cancelled", "stopped"]);

function usePart<T>(
	part: Part,
	fetcher: (u: string, g: string, id: string) => Promise<T>,
	username: string | undefined,
	graphSlug: string | undefined,
	runId: string | undefined,
	running: boolean,
) {
	return useQuery({
		queryKey: ["run-page", username, graphSlug, runId, part],
		queryFn: () =>
			fetcher(username as string, graphSlug as string, runId as string),
		enabled: !!username && !!graphSlug && !!runId,
		refetchInterval: running ? LIVE_MS : false,
	});
}

/** The head, tiles and series; it decides whether the rest refetch. */
export function useRunOverviewQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	runId: string | undefined,
) {
	return useQuery({
		queryKey: ["run-page", username, graphSlug, runId, "overview"],
		queryFn: () =>
			runPageApi.overview(
				username as string,
				graphSlug as string,
				runId as string,
			),
		enabled: !!username && !!graphSlug && !!runId,
		refetchInterval: (q) =>
			q.state.data && !SETTLED.has(q.state.data.head.status) ? LIVE_MS : false,
	});
}

export const useRunAgentsQuery = (
	u: string | undefined,
	g: string | undefined,
	id: string | undefined,
	running: boolean,
) => usePart("agents", runPageApi.agents, u, g, id, running);

export const useRunStagesQuery = (
	u: string | undefined,
	g: string | undefined,
	id: string | undefined,
	running: boolean,
) => usePart("stages", runPageApi.stages, u, g, id, running);

export const useRunAssetsQuery = (
	u: string | undefined,
	g: string | undefined,
	id: string | undefined,
	running: boolean,
) => usePart("assets", runPageApi.assets, u, g, id, running);

export const useRunTouchedQuery = (
	u: string | undefined,
	g: string | undefined,
	id: string | undefined,
	running: boolean,
) => usePart("touched", runPageApi.touched, u, g, id, running);

/** One page of Agents › Runs — searched, filtered and paged by the engine. */
export function useRunsPageQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	query: ListQuery,
) {
	return useQuery({
		queryKey: ["runs", username, graphSlug, "page", listQueryKey(query)],
		queryFn: () => runsApi.list(username as string, graphSlug as string, query),
		enabled: !!username && !!graphSlug,
		placeholderData: keepPreviousData,
		refetchInterval: LIVE_MS * 2,
	});
}

/** The Runs tiles over the last 24 hours. */
export function useRunsTilesQuery(
	username: string | undefined,
	graphSlug: string | undefined,
) {
	return useQuery({
		queryKey: ["runs", username, graphSlug, "tiles"],
		queryFn: () =>
			runsApi.stats(username as string, graphSlug as string, { days: 1 }),
		enabled: !!username && !!graphSlug,
		refetchInterval: LIVE_MS * 2,
	});
}

/** Stop run — the run and its children; every run read is refetched. */
export function useStopRunMutation(username: string, graphSlug: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (runId: string) => runsApi.cancel(username, graphSlug, runId),
		onSettled: () => {
			qc.invalidateQueries({ queryKey: ["run-page"] });
			qc.invalidateQueries({ queryKey: ["runs"] });
		},
	});
}

/** Rerun — same versions, current versions, or retuned; a new run. */
export function useRerunMutation(username: string, graphSlug: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			runId,
			versions,
			retune,
		}: {
			runId: string;
			versions: RerunVersions;
			retune?: RerunRetune;
		}) => runsApi.rerun(username, graphSlug, runId, versions, retune),
		onSettled: () => qc.invalidateQueries({ queryKey: ["runs"] }),
	});
}
