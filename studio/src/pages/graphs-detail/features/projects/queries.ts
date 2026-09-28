/**
 * TanStack Query hooks for projects and their Todos, and a Todo's runs.
 *
 * One convention throughout: a mutation that can move a **Todo's** state
 * invalidates the Todos *and* the project plan, because a status change
 * recomputes waves and the critical path. Anything less and the canvas quietly
 * disagrees with the panel.
 */

import {
	projectsApi,
	todosApi,
} from "@/pages/graphs-detail/features/projects/api";
import type {
	ProjectCreate,
	ProjectUpdate,
	TodoCreate,
	TodoUpdate,
} from "@/pages/graphs-detail/features/projects/types";
import { runsApi } from "@/pages/graphs-detail/features/runs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type Scope = { username: string; graphSlug: string };

const projectsKey = (s: Scope, extra: unknown[] = []) =>
	["projects", s.username, s.graphSlug, ...extra] as const;

const todosKey = (s: Scope, extra: unknown[] = []) =>
	["tasks", s.username, s.graphSlug, ...extra] as const;

// ── Projects ─────────────────────────────────────────────────────────────────

export function useProjectsQuery(
	username: string | undefined,
	graphSlug: string | undefined,
) {
	const scope = { username: username ?? "", graphSlug: graphSlug ?? "" };
	return useQuery({
		queryKey: projectsKey(scope),
		queryFn: () => projectsApi.list(scope.username, scope.graphSlug),
		enabled: !!username && !!graphSlug,
	});
}

export function useProjectPlanQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	key: string | undefined,
) {
	const scope = { username: username ?? "", graphSlug: graphSlug ?? "" };
	return useQuery({
		queryKey: projectsKey(scope, ["plan", key]),
		queryFn: () =>
			projectsApi.plan(scope.username, scope.graphSlug, key as string),
		enabled: !!username && !!graphSlug && !!key,
	});
}

export function useProjectMutations(username: string, graphSlug: string) {
	const qc = useQueryClient();
	const invalidate = () =>
		qc.invalidateQueries({ queryKey: ["projects", username, graphSlug] });

	return {
		create: useMutation({
			mutationFn: (data: ProjectCreate) =>
				projectsApi.create(username, graphSlug, data),
			onSuccess: invalidate,
		}),
		update: useMutation({
			mutationFn: ({ key, data }: { key: string; data: ProjectUpdate }) =>
				projectsApi.update(username, graphSlug, key, data),
			onSuccess: invalidate,
		}),
		remove: useMutation({
			mutationFn: (key: string) => projectsApi.remove(username, graphSlug, key),
			onSuccess: invalidate,
		}),
	};
}

// ── Tasks ────────────────────────────────────────────────────────────────────

export function useTodosQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	opts: {
		project?: string;
		assignee?: string;
		status?: string[];
		/** Off for a caller that only wants the list once something is selected. */
		enabled?: boolean;
	} = {},
) {
	const { enabled = true, ...filters } = opts;
	const scope = { username: username ?? "", graphSlug: graphSlug ?? "" };
	return useQuery({
		queryKey: todosKey(scope, [filters]),
		queryFn: () => todosApi.list(scope.username, scope.graphSlug, filters),
		enabled: !!username && !!graphSlug && enabled,
	});
}

export function useTodoQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	id: string | undefined,
) {
	const scope = { username: username ?? "", graphSlug: graphSlug ?? "" };
	return useQuery({
		queryKey: todosKey(scope, [id]),
		queryFn: () => todosApi.get(scope.username, scope.graphSlug, id as string),
		enabled: !!username && !!graphSlug && !!id,
	});
}

export function useTodoActivityQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	id: string | undefined,
	enabled = true,
) {
	const scope = { username: username ?? "", graphSlug: graphSlug ?? "" };
	return useQuery({
		queryKey: todosKey(scope, [id, "activity"]),
		queryFn: () =>
			todosApi.activity(scope.username, scope.graphSlug, id as string),
		enabled: enabled && !!username && !!graphSlug && !!id,
	});
}

export function useTodoMutations(username: string, graphSlug: string) {
	const qc = useQueryClient();
	// A task's state change recomputes waves and the critical path, so the plan
	// goes with it — otherwise the canvas and the panel disagree.
	const invalidate = () => {
		qc.invalidateQueries({ queryKey: ["tasks", username, graphSlug] });
		qc.invalidateQueries({ queryKey: ["projects", username, graphSlug] });
	};

	return {
		create: useMutation({
			mutationFn: (data: TodoCreate) =>
				todosApi.create(username, graphSlug, data),
			onSuccess: invalidate,
		}),
		update: useMutation({
			mutationFn: ({ id, data }: { id: string; data: TodoUpdate }) =>
				todosApi.update(username, graphSlug, id, data),
			onSuccess: invalidate,
		}),
		remove: useMutation({
			mutationFn: (id: string) => todosApi.remove(username, graphSlug, id),
			onSuccess: invalidate,
		}),
		start: useMutation({
			mutationFn: (id: string) => todosApi.start(username, graphSlug, id),
			onSuccess: invalidate,
		}),
		postResult: useMutation({
			mutationFn: ({ id, summary }: { id: string; summary: string }) =>
				todosApi.postResult(username, graphSlug, id, summary),
			onSuccess: invalidate,
		}),
		accept: useMutation({
			mutationFn: (id: string) => todosApi.accept(username, graphSlug, id),
			onSuccess: invalidate,
		}),
		reject: useMutation({
			mutationFn: ({ id, note }: { id: string; note: string }) =>
				todosApi.reject(username, graphSlug, id, note),
			onSuccess: invalidate,
		}),
		cancel: useMutation({
			mutationFn: (id: string) => todosApi.cancel(username, graphSlug, id),
			onSuccess: invalidate,
		}),
		addDependency: useMutation({
			mutationFn: ({ id, dependsOnId }: { id: string; dependsOnId: string }) =>
				todosApi.addDependency(username, graphSlug, id, dependsOnId),
			onSuccess: invalidate,
		}),
		removeDependency: useMutation({
			mutationFn: ({ id, dependsOnId }: { id: string; dependsOnId: string }) =>
				todosApi.removeDependency(username, graphSlug, id, dependsOnId),
			onSuccess: invalidate,
		}),
	};
}

export function useTodoRunsQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	runIds: string[] | undefined,
) {
	const ids = runIds ?? [];
	return useQuery({
		queryKey: ["runs", username, graphSlug, ids] as const,
		queryFn: () =>
			Promise.all(
				ids.map((id) =>
					runsApi.get(username as string, graphSlug as string, id),
				),
			),
		enabled: !!username && !!graphSlug && ids.length > 0,
	});
}
