/**
 * TanStack Query hooks for agents: the list, one agent and its Overview, its lineage, skills and
 * callables, meters, activity and sessions, a lifecycle or soul preview, and
 * the mutations that update or act on an agent. Keys are
 * `["agents", owner, graph, …]`; a mutation invalidates every agents key.
 */

import { sessionsApi } from "@invana-studio/assistant";
import { type ListQuery, listQueryKey, runsApi } from "@invana-studio/core";
import {
	keepPreviousData,
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { agentsApi } from "./api";
import type {
	AgentCreate,
	AgentOverviewWindow,
	AgentUpdate,
	LifecycleAct,
	SoulPreviewRequest,
} from "./types";

type Scope = { username: string; graphSlug: string };

const agentsKey = (s: Scope, extra: unknown[] = []) =>
	["agents", s.username, s.graphSlug, ...extra] as const;

// ── Agents ───────────────────────────────────────────────────────────────────

/**
 * Every agent the Graph has — retired agents and spawned helpers too — for a
 * caller that resolves ids to names rather than showing a list.
 */
export const EVERY_AGENT: ListQuery = {
	filters: {
		status: ["draft", "active", "paused", "retired"],
		ephemeral: ["shown"],
	},
	limit: 200,
};

/** One agent — what the agent page reads. */
export function useAgentQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	agentId: string | undefined,
) {
	const scope = { username: username ?? "", graphSlug: graphSlug ?? "" };
	return useQuery({
		queryKey: agentsKey(scope, ["detail", agentId]),
		queryFn: () =>
			agentsApi.get(scope.username, scope.graphSlug, agentId as string),
		enabled: !!username && !!graphSlug && !!agentId,
	});
}

/** A live agent's Overview over `window`; the window is part of the key. */
export function useAgentOverviewQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	agentId: string | undefined,
	window: AgentOverviewWindow = "30d",
) {
	const scope = { username: username ?? "", graphSlug: graphSlug ?? "" };
	return useQuery({
		queryKey: agentsKey(scope, ["overview", agentId, window]),
		queryFn: () =>
			agentsApi.overview(
				scope.username,
				scope.graphSlug,
				agentId as string,
				window,
			),
		enabled: !!username && !!graphSlug && !!agentId,
	});
}

/** One page of the Agents list for `query` — what `useListParams` reads from the URL. */
export function useAgentsQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	query: ListQuery = {},
	opts: {
		/** Off for a caller that only wants the list on some kinds. */
		enabled?: boolean;
	} = {},
) {
	const { enabled = true } = opts;
	const scope = { username: username ?? "", graphSlug: graphSlug ?? "" };
	return useQuery({
		queryKey: agentsKey(scope, ["list", listQueryKey(query)]),
		queryFn: () => agentsApi.list(scope.username, scope.graphSlug, query),
		enabled: !!username && !!graphSlug && enabled,
		placeholderData: keepPreviousData,
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
 * both acts — the act is part of the key, so switching between them
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

/** Skills and callables, both tables. */
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

/** The meters — every number derived on read. */
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
 * The caller's own sessions bound to this agent, most recently used first.
 * Sessions stay private to whoever opened them; the Graph-wide number is
 * `meters.sessions`, a count that names no thread.
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

/** How many runs a page of an agent's Runs asks for. */
export const RUNS_PAGE = 50;

/**
 * An agent's runs under `query`, a page at a time: each page asks for the
 * next on the last one's `next_cursor`. The key starts `["runs", owner,
 * graph]`, so whatever refreshes the journal refreshes this list.
 */
export function useAgentRunPagesQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	query: ListQuery,
) {
	return useInfiniteQuery({
		queryKey: [
			"runs",
			username,
			graphSlug,
			"agent-pages",
			listQueryKey(query),
		] as const,
		queryFn: ({ pageParam }) =>
			runsApi.list(username as string, graphSlug as string, {
				...query,
				limit: RUNS_PAGE,
				cursor: pageParam,
			}),
		initialPageParam: null as string | null,
		getNextPageParam: (page) => page.next_cursor,
		enabled: !!username && !!graphSlug,
		placeholderData: keepPreviousData,
	});
}

/**
 * The soul preview. A mutation, not a query: it is two model calls the author
 * asks for, never something a re-render may fire.
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
		// bound sections, and those come from the skill's own read.
		qc.invalidateQueries({ queryKey: ["skills", username, graphSlug] });
	};

	return {
		/** A new agent, written as a draft. */
		create: useMutation({
			mutationFn: (data: AgentCreate) =>
				agentsApi.create(username, graphSlug, data),
			onSuccess: invalidate,
		}),
		/** *Create agent* — the draft goes live through its eval gate. */
		makeLive: useMutation({
			mutationFn: ({ id, why }: { id: string; why: string }) =>
				agentsApi.makeLive(username, graphSlug, id, why),
			onSuccess: () => {
				invalidate();
				qc.invalidateQueries({ queryKey: ["history", username, graphSlug] });
			},
		}),
		/** *Discard draft* — a draft never ran, so it is deleted outright. */
		discard: useMutation({
			mutationFn: (id: string) => agentsApi.remove(username, graphSlug, id),
			onSuccess: invalidate,
		}),
		update: useMutation({
			mutationFn: ({ id, data }: { id: string; data: AgentUpdate }) =>
				agentsApi.update(username, graphSlug, id, data),
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
				why,
			}: {
				id: string;
				reassign?: { reassign_to_kind: string; reassign_to_id: string };
				why?: string;
			}) => agentsApi.retire(username, graphSlug, id, reassign, why),
			onSuccess: () => {
				invalidate();
				// A retire pauses every schedule that starts the agent.
				qc.invalidateQueries({ queryKey: ["schedules", username, graphSlug] });
			},
		}),
		writeDraft: useMutation({
			mutationFn: ({
				id,
				instructions,
			}: {
				id: string;
				instructions: string;
			}) => agentsApi.writeDraft(username, graphSlug, id, instructions),
			onSuccess: invalidate,
		}),
		discardDraft: useMutation({
			mutationFn: (id: string) =>
				agentsApi.discardDraft(username, graphSlug, id),
			onSuccess: invalidate,
		}),
		publish: useMutation({
			mutationFn: ({ id, why }: { id: string; why: string }) =>
				agentsApi.publish(username, graphSlug, id, why),
			onSuccess: () => {
				invalidate();
				qc.invalidateQueries({ queryKey: ["history", username, graphSlug] });
			},
		}),
		rollback: useMutation({
			mutationFn: ({
				id,
				version,
				why,
			}: {
				id: string;
				version: number;
				why: string;
			}) => agentsApi.rollback(username, graphSlug, id, version, why),
			onSuccess: () => {
				invalidate();
				qc.invalidateQueries({ queryKey: ["history", username, graphSlug] });
			},
		}),
		/** A pin move is its own act: gated, with a reason. */
		pin: useMutation({
			mutationFn: ({
				id,
				modelPin,
				why,
			}: {
				id: string;
				modelPin: string;
				why: string;
			}) =>
				agentsApi.update(username, graphSlug, id, {
					model_pin: modelPin,
					...(why ? { why } : {}),
				}),
			onSuccess: () => {
				invalidate();
				qc.invalidateQueries({ queryKey: ["history", username, graphSlug] });
			},
		}),
		setDefault: useMutation({
			mutationFn: (id: string) => agentsApi.setDefault(username, graphSlug, id),
			onSuccess: () =>
				qc.invalidateQueries({ queryKey: agentsKey(scope).slice(0, 3) }),
		}),
	};
}
