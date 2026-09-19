/**
 * TanStack Query hooks for the S12 surfaces — Agents · Projects · Tasks ·
 * Workflows (docs/for-developers/modules/work/spec.md).
 *
 * One convention throughout: a mutation that can move a **task's** state
 * invalidates tasks *and* the project plan, because a status change recomputes
 * waves and the critical path. Anything less and the canvas quietly disagrees
 * with the panel.
 */

import { runsApi } from "@/services/api/runs";
import {
	agentsApi,
	projectsApi,
	skillUsageApi,
	tasksApi,
	workflowsApi,
} from "@/services/api/work";
import type {
	AgentCreate,
	AgentUpdate,
	ProjectCreate,
	ProjectUpdate,
	TaskCreate,
	TaskUpdate,
} from "@/types/work";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type Scope = { username: string; graphSlug: string };

const agentsKey = (s: Scope, extra: unknown[] = []) =>
	["agents", s.username, s.graphSlug, ...extra] as const;
const projectsKey = (s: Scope, extra: unknown[] = []) =>
	["projects", s.username, s.graphSlug, ...extra] as const;
const tasksKey = (s: Scope, extra: unknown[] = []) =>
	["tasks", s.username, s.graphSlug, ...extra] as const;
const workflowsKey = (s: Scope, extra: unknown[] = []) =>
	["workflows", s.username, s.graphSlug, ...extra] as const;

// ── Agents ───────────────────────────────────────────────────────────────────

export function useAgentsQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	opts: {
		includeEphemeral?: boolean;
		includeRetired?: boolean;
		/** Off for a caller that only wants the roster on some kinds. */
		enabled?: boolean;
	} = {},
) {
	const { enabled = true, ...list } = opts;
	const scope = { username: username ?? "", graphSlug: graphSlug ?? "" };
	return useQuery({
		queryKey: agentsKey(scope, [list.includeEphemeral, list.includeRetired]),
		queryFn: () => agentsApi.list(scope.username, scope.graphSlug, list),
		enabled: !!username && !!graphSlug && enabled,
	});
}

export function useAgentLineageQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	agentId: string | undefined,
) {
	const scope = { username: username ?? "", graphSlug: graphSlug ?? "" };
	return useQuery({
		queryKey: agentsKey(scope, ["lineage", agentId]),
		queryFn: () =>
			agentsApi.lineage(scope.username, scope.graphSlug, agentId as string),
		enabled: !!username && !!graphSlug && !!agentId,
	});
}

export function useRetirePreviewQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	agentId: string | undefined,
	enabled: boolean,
) {
	const scope = { username: username ?? "", graphSlug: graphSlug ?? "" };
	return useQuery({
		queryKey: agentsKey(scope, ["retire-preview", agentId]),
		queryFn: () =>
			agentsApi.retirePreview(
				scope.username,
				scope.graphSlug,
				agentId as string,
			),
		enabled: enabled && !!username && !!graphSlug && !!agentId,
	});
}

export function useAgentMutations(username: string, graphSlug: string) {
	const qc = useQueryClient();
	const scope = { username, graphSlug };
	// An agent's state change can block or release tasks, so both lists move.
	const invalidate = () => {
		qc.invalidateQueries({ queryKey: ["agents", username, graphSlug] });
		qc.invalidateQueries({ queryKey: ["tasks", username, graphSlug] });
	};

	return {
		create: useMutation({
			mutationFn: (data: AgentCreate) =>
				agentsApi.create(username, graphSlug, data),
			onSuccess: invalidate,
		}),
		update: useMutation({
			mutationFn: ({ id, data }: { id: string; data: AgentUpdate }) =>
				agentsApi.update(username, graphSlug, id, data),
			onSuccess: invalidate,
		}),
		remove: useMutation({
			mutationFn: (id: string) => agentsApi.remove(username, graphSlug, id),
			onSuccess: invalidate,
		}),
		bindSkill: useMutation({
			mutationFn: ({ id, skillId }: { id: string; skillId: string }) =>
				agentsApi.bindSkill(username, graphSlug, id, skillId),
			onSuccess: invalidate,
		}),
		unbindSkill: useMutation({
			mutationFn: ({ id, skillId }: { id: string; skillId: string }) =>
				agentsApi.unbindSkill(username, graphSlug, id, skillId),
			onSuccess: invalidate,
		}),
		pause: useMutation({
			mutationFn: (id: string) => agentsApi.pause(username, graphSlug, id),
			onSuccess: invalidate,
		}),
		resume: useMutation({
			mutationFn: (id: string) => agentsApi.resume(username, graphSlug, id),
			onSuccess: invalidate,
		}),
		retire: useMutation({
			mutationFn: ({
				id,
				reassign,
			}: {
				id: string;
				reassign?: { reassign_to_kind: string; reassign_to_id: string };
			}) => agentsApi.retire(username, graphSlug, id, reassign),
			onSuccess: invalidate,
		}),
		setDefault: useMutation({
			mutationFn: (id: string) => agentsApi.setDefault(username, graphSlug, id),
			onSuccess: () =>
				qc.invalidateQueries({ queryKey: agentsKey(scope).slice(0, 3) }),
		}),
	};
}

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

export function useTasksQuery(
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
		queryKey: tasksKey(scope, [filters]),
		queryFn: () => tasksApi.list(scope.username, scope.graphSlug, filters),
		enabled: !!username && !!graphSlug && enabled,
	});
}

export function useTaskQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	id: string | undefined,
) {
	const scope = { username: username ?? "", graphSlug: graphSlug ?? "" };
	return useQuery({
		queryKey: tasksKey(scope, [id]),
		queryFn: () => tasksApi.get(scope.username, scope.graphSlug, id as string),
		enabled: !!username && !!graphSlug && !!id,
	});
}

export function useTaskActivityQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	id: string | undefined,
	enabled = true,
) {
	const scope = { username: username ?? "", graphSlug: graphSlug ?? "" };
	return useQuery({
		queryKey: tasksKey(scope, [id, "activity"]),
		queryFn: () =>
			tasksApi.activity(scope.username, scope.graphSlug, id as string),
		enabled: enabled && !!username && !!graphSlug && !!id,
	});
}

export function useTaskMutations(username: string, graphSlug: string) {
	const qc = useQueryClient();
	// A task's state change recomputes waves and the critical path, so the plan
	// goes with it — otherwise the canvas and the panel disagree.
	const invalidate = () => {
		qc.invalidateQueries({ queryKey: ["tasks", username, graphSlug] });
		qc.invalidateQueries({ queryKey: ["projects", username, graphSlug] });
	};

	return {
		create: useMutation({
			mutationFn: (data: TaskCreate) =>
				tasksApi.create(username, graphSlug, data),
			onSuccess: invalidate,
		}),
		update: useMutation({
			mutationFn: ({ id, data }: { id: string; data: TaskUpdate }) =>
				tasksApi.update(username, graphSlug, id, data),
			onSuccess: invalidate,
		}),
		remove: useMutation({
			mutationFn: (id: string) => tasksApi.remove(username, graphSlug, id),
			onSuccess: invalidate,
		}),
		start: useMutation({
			mutationFn: (id: string) => tasksApi.start(username, graphSlug, id),
			onSuccess: invalidate,
		}),
		postResult: useMutation({
			mutationFn: ({ id, summary }: { id: string; summary: string }) =>
				tasksApi.postResult(username, graphSlug, id, summary),
			onSuccess: invalidate,
		}),
		accept: useMutation({
			mutationFn: (id: string) => tasksApi.accept(username, graphSlug, id),
			onSuccess: invalidate,
		}),
		reject: useMutation({
			mutationFn: ({ id, note }: { id: string; note: string }) =>
				tasksApi.reject(username, graphSlug, id, note),
			onSuccess: invalidate,
		}),
		cancel: useMutation({
			mutationFn: (id: string) => tasksApi.cancel(username, graphSlug, id),
			onSuccess: invalidate,
		}),
		addDependency: useMutation({
			mutationFn: ({ id, dependsOnId }: { id: string; dependsOnId: string }) =>
				tasksApi.addDependency(username, graphSlug, id, dependsOnId),
			onSuccess: invalidate,
		}),
		removeDependency: useMutation({
			mutationFn: ({ id, dependsOnId }: { id: string; dependsOnId: string }) =>
				tasksApi.removeDependency(username, graphSlug, id, dependsOnId),
			onSuccess: invalidate,
		}),
	};
}

// ── Workflows ────────────────────────────────────────────────────────────────

export function useWorkflowsQuery(
	username: string | undefined,
	graphSlug: string | undefined,
) {
	const scope = { username: username ?? "", graphSlug: graphSlug ?? "" };
	return useQuery({
		queryKey: workflowsKey(scope),
		queryFn: () => workflowsApi.list(scope.username, scope.graphSlug),
		enabled: !!username && !!graphSlug,
	});
}

export function useWorkflowQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	key: string | undefined,
) {
	const scope = { username: username ?? "", graphSlug: graphSlug ?? "" };
	return useQuery({
		queryKey: workflowsKey(scope, [key]),
		queryFn: () =>
			workflowsApi.get(scope.username, scope.graphSlug, key as string),
		enabled: !!username && !!graphSlug && !!key,
	});
}

/**
 * **Promote a plan** — the workflow library's only write (docs/for-developers/modules/agents/spec.md).
 *
 * Invalidates workflows *and* runs: the promoted plan leaves the
 * candidates list the moment a library entry claims it as its origin, and a
 * candidates list still offering it would invite a second, duplicate promotion.
 */
export function usePromoteWorkflowMutation(
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
		}) => workflowsApi.promote(username, graphSlug, data),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["workflows", username, graphSlug] });
			qc.invalidateQueries({ queryKey: ["runs", username, graphSlug] });
		},
	});
}

// ── Skill usage ──────────────────────────────────────────────────────────────

export function useSkillUsageQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	skillId: string | undefined,
) {
	return useQuery({
		queryKey: ["skill-usage", username, graphSlug, skillId] as const,
		queryFn: () =>
			skillUsageApi.get(
				username as string,
				graphSlug as string,
				skillId as string,
			),
		enabled: !!username && !!graphSlug && !!skillId,
	});
}

// ── Thinkings behind a task ──────────────────────────────────────────────────

/**
 * The runs a task opened, in the order they were opened.
 *
 * A task's **Thoughts** tab is the same trace the session thread shows, read
 * from the other end: there, a run hangs under the reply that asked for
 * it; here, under the task it was assigned to. Both render through
 * `SessionSteps`, so a step row means one thing in Studio, not two.
 *
 * Fetched per id rather than as a list because that is the endpoint that
 * exists — and a task has one or two runs, not a page of them.
 */
/**
 * Runs as list rows — an agent's **Recent plans**, or the library's
 * **candidates** (generated plans that served and were never promoted).
 */
export function useRunsQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	filters: {
		agentId?: string;
		taskId?: string;
		candidates?: boolean;
		limit?: number;
	} = {},
	enabled = true,
) {
	return useQuery({
		queryKey: ["runs", username, graphSlug, filters] as const,
		queryFn: () =>
			runsApi.list(username as string, graphSlug as string, filters),
		enabled: enabled && !!username && !!graphSlug,
	});
}

export function useTaskThinkingsQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	thinkingIds: string[] | undefined,
) {
	const ids = thinkingIds ?? [];
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
