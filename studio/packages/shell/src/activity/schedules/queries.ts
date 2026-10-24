/**
 * TanStack Query hooks over a Graph's schedules. Every key starts
 * `["schedules", owner, graph]`, so a write invalidates the list, a
 * schedule and its firings at once.
 */

import {
	type GraphRef,
	type ListQuery,
	listQueryKey,
} from "@invana-studio/core";
import {
	keepPreviousData,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { schedulesApi } from "./api";
import type { ScheduleUpdate, ScheduleWrite } from "./types";

const STALE_MS = 15_000;

export const scheduleKeys = {
	all: (g: GraphRef | undefined) =>
		["schedules", g?.username, g?.graphSlug] as const,
	one: (g: GraphRef | undefined, id: string | undefined) =>
		[...scheduleKeys.all(g), "one", id] as const,
	firings: (g: GraphRef | undefined, id: string | undefined, limit: number) =>
		[...scheduleKeys.all(g), "firings", id, limit] as const,
};

/** Every schedule — the tab draws them all, and Coming up reads each one. */
const EVERY_SCHEDULE: ListQuery = { limit: 200 };

/** One page of the schedules list for `query`; by default every schedule. */
export function useSchedulesQuery(
	graph: GraphRef | undefined,
	query: ListQuery = EVERY_SCHEDULE,
) {
	return useQuery({
		queryKey: [
			...scheduleKeys.all(graph),
			"list",
			listQueryKey(query),
		] as const,
		queryFn: () => schedulesApi.list(graph as GraphRef, query),
		enabled: !!graph,
		staleTime: STALE_MS,
		placeholderData: keepPreviousData,
	});
}

export function useScheduleQuery(
	graph: GraphRef | undefined,
	id: string | undefined,
) {
	return useQuery({
		queryKey: scheduleKeys.one(graph, id),
		queryFn: () => schedulesApi.get(graph as GraphRef, id as string),
		enabled: !!graph && !!id,
		staleTime: STALE_MS,
	});
}

/** A schedule's firings, newest first. `limit: 1` is its last firing. */
export function useFiringsQuery(
	graph: GraphRef | undefined,
	id: string | undefined,
	limit = 50,
) {
	return useQuery({
		queryKey: scheduleKeys.firings(graph, id, limit),
		queryFn: () => schedulesApi.firings(graph as GraphRef, id as string, limit),
		enabled: !!graph && !!id,
		staleTime: STALE_MS,
	});
}

function useInvalidate(graph: GraphRef) {
	const qc = useQueryClient();
	return () => qc.invalidateQueries({ queryKey: scheduleKeys.all(graph) });
}

export function useCreateSchedule(graph: GraphRef) {
	const invalidate = useInvalidate(graph);
	return useMutation({
		mutationFn: (body: ScheduleWrite) => schedulesApi.create(graph, body),
		onSuccess: invalidate,
	});
}

export function useUpdateSchedule(graph: GraphRef) {
	const invalidate = useInvalidate(graph);
	return useMutation({
		mutationFn: ({ id, body }: { id: string; body: ScheduleUpdate }) =>
			schedulesApi.update(graph, id, body),
		onSuccess: invalidate,
	});
}

export function useDeleteSchedule(graph: GraphRef) {
	const invalidate = useInvalidate(graph);
	return useMutation({
		mutationFn: (id: string) => schedulesApi.remove(graph, id),
		onSuccess: invalidate,
	});
}

export function usePauseSchedule(graph: GraphRef) {
	const invalidate = useInvalidate(graph);
	return useMutation({
		mutationFn: (id: string) => schedulesApi.pause(graph, id),
		onSuccess: invalidate,
	});
}

export function useResumeSchedule(graph: GraphRef) {
	const invalidate = useInvalidate(graph);
	return useMutation({
		mutationFn: (id: string) => schedulesApi.resume(graph, id),
		onSuccess: invalidate,
	});
}

/** Run now: a `queued` firing the clock opens within a tick. */
export function useRunScheduleNow(graph: GraphRef) {
	const invalidate = useInvalidate(graph);
	return useMutation({
		mutationFn: (id: string) => schedulesApi.runNow(graph, id),
		onSuccess: invalidate,
	});
}
