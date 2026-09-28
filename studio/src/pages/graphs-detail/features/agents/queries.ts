/**
 * TanStack Query hooks for agents: the list, one agent's lineage, skills and
 * callables, meters, activity and sessions, a lifecycle or soul preview, and
 * the mutations that create, update or act on an agent. Keys are
 * `["agents", owner, graph, …]`; a mutation invalidates every agents key.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { agentsApi } from "@/pages/graphs-detail/features/agents/api";
import type {
	AgentCreate,
	AgentUpdate,
	LifecycleAct,
	SoulPreviewRequest,
} from "@/pages/graphs-detail/features/agents/types";
import { sessionsApi } from "@/pages/graphs-detail/features/assistant";

type Scope = { username: string; graphSlug: string };

const agentsKey = (s: Scope, extra: unknown[] = []) =>
	["agents", s.username, s.graphSlug, ...extra] as const;

// ── Agents ───────────────────────────────────────────────────────────────────

export function useAgentsQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	opts: {
		includeEphemeral?: boolean;
		includeRetired?: boolean;
		/** Off for a caller that only wants the list on some kinds. */
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

/**
 * What pausing or retiring would do to this agent's open work. One hook for
 * both acts (LC8) — the act is part of the key, so switching between them
 * refetches rather than showing the other act's effects.
 */
export function useLifecyclePreviewQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	agentId: string | undefined,
	act: LifecycleAct | undefined,
) {
	const scope = { username: username ?? "", graphSlug: graphSlug ?? "" };
	return useQuery({
		queryKey: agentsKey(scope, ["lifecycle-preview", act, agentId]),
		queryFn: () =>
			agentsApi.lifecyclePreview(
				scope.username,
				scope.graphSlug,
				agentId as string,
				act as LifecycleAct,
			),
		enabled: !!username && !!graphSlug && !!agentId && !!act,
	});
}

/** Skills and callables, both tables (AG30). */
export function useAgentSkillsAndCallablesQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	agentId: string | undefined,
) {
	const scope = { username: username ?? "", graphSlug: graphSlug ?? "" };
	return useQuery({
		queryKey: agentsKey(scope, ["skills-and-callables", agentId]),
		queryFn: () =>
			agentsApi.skillsAndCallables(
				scope.username,
				scope.graphSlug,
				agentId as string,
			),
		enabled: !!username && !!graphSlug && !!agentId,
	});
}

/** The meters — every number derived on read (AG31). */
export function useAgentMetersQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	agentId: string | undefined,
) {
	const scope = { username: username ?? "", graphSlug: graphSlug ?? "" };
	return useQuery({
		queryKey: agentsKey(scope, ["meters", agentId]),
		queryFn: () =>
			agentsApi.meters(scope.username, scope.graphSlug, agentId as string),
		enabled: !!username && !!graphSlug && !!agentId,
	});
}

/**
 * The caller's own sessions bound to this agent. Sessions stay private to
 * whoever opened them; the Graph-wide number is `meters.sessions` (AG31).
 */
export function useAgentSessionsQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	agentId: string | undefined,
) {
	const scope = { username: username ?? "", graphSlug: graphSlug ?? "" };
	return useQuery({
		queryKey: agentsKey(scope, ["sessions", agentId]),
		queryFn: () =>
			sessionsApi.list(scope.username, scope.graphSlug, {
				agentId,
				sort: "updated",
				limit: 20,
			}),
		enabled: !!username && !!graphSlug && !!agentId,
	});
}

/**
 * The soul preview. A mutation, not a query: it is two model calls the author
 * asks for, never something a re-render may fire (SO8).
 */
export function useSoulPreviewMutation(
	username: string,
	graphSlug: string,
	agentId: string,
) {
	return useMutation({
		mutationFn: (data: SoulPreviewRequest) =>
			agentsApi.previewSoul(username, graphSlug, agentId, data),
	});
}

export function useAgentMutations(username: string, graphSlug: string) {
	const qc = useQueryClient();
	const scope = { username, graphSlug };
	// An agent's state change can block or release tasks, so both lists move.
	const invalidate = () => {
		qc.invalidateQueries({ queryKey: ["agents", username, graphSlug] });
		qc.invalidateQueries({ queryKey: ["tasks", username, graphSlug] });
		// A binding change moves rows between the skill's bound / refused / not
		// bound sections, and those come from the skill's own read (BN10).
		qc.invalidateQueries({ queryKey: ["skills", username, graphSlug] });
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
