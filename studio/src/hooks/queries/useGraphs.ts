import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "../../services/api/auth";
import { graphsApi } from "../../services/api/graphs";
import { useAuthStore } from "../../stores/auth.store";
import type {
	GraphConnectionCreate,
	GraphCreate,
	GraphUpdate,
	SetupSection,
} from "../../types/graphs";

/**
 * Re-fetch `/auth/me` and update the auth store. Keeps `user.graphs` in
 * lockstep with reality whenever a membership-changing mutation runs
 * (create graph, delete graph) — otherwise `membershipForGraph(...)` reads
 * from a stale snapshot and the just-changed graph looks wrong until the
 * next login.
 */
async function refreshAuthMe(): Promise<void> {
	try {
		const fresh = await authApi.me();
		useAuthStore.getState().setUser(fresh);
	} catch {
		// Non-fatal — store stays as-is, user can refresh manually if needed.
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Graph container hooks (RFC-017)
// ─────────────────────────────────────────────────────────────────────────────

const GRAPHS_KEY = ["graphs"] as const;
const graphKey = (username: string, graphSlug: string) =>
	[...GRAPHS_KEY, username, graphSlug] as const;

export function useGraphsQuery(includeArchived = false) {
	return useQuery({
		// Keyed on the flag so the archived/active views cache separately; both
		// still share the GRAPHS_KEY prefix, so mutations that invalidate
		// GRAPHS_KEY refresh either view.
		queryKey: [...GRAPHS_KEY, { includeArchived }] as const,
		queryFn: () => graphsApi.list(includeArchived),
		staleTime: 30_000,
	});
}

export function useGraphQuery(
	username: string | undefined,
	graphSlug: string | undefined,
) {
	return useQuery({
		queryKey: graphKey(username ?? "", graphSlug ?? ""),
		queryFn: () => graphsApi.get(username as string, graphSlug as string),
		enabled: !!username && !!graphSlug,
	});
}

export function useCreateGraphMutation() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (data: GraphCreate) => graphsApi.create(data),
		onSuccess: async () => {
			qc.invalidateQueries({ queryKey: GRAPHS_KEY });
			// Refresh user.graphs so the new membership shows up immediately
			// in the rail — otherwise the just-created graph looks like a
			// non-member visit until logout/login.
			await refreshAuthMe();
		},
	});
}

export function useUpdateGraphMutation() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			username,
			graphSlug,
			data,
		}: {
			username: string;
			graphSlug: string;
			data: GraphUpdate;
		}) => graphsApi.update(username, graphSlug, data),
		onSuccess: (_, { username, graphSlug }) => {
			qc.invalidateQueries({ queryKey: GRAPHS_KEY });
			qc.invalidateQueries({ queryKey: graphKey(username, graphSlug) });
		},
	});
}

export function useDeleteGraphMutation() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			username,
			graphSlug,
		}: { username: string; graphSlug: string }) =>
			graphsApi.remove(username, graphSlug),
		onSuccess: async () => {
			qc.invalidateQueries({ queryKey: GRAPHS_KEY });
			// Remove the dropped membership from user.graphs.
			await refreshAuthMe();
		},
	});
}

export function useSetupSectionMutation() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			username,
			graphSlug,
			section,
			action,
		}: {
			username: string;
			graphSlug: string;
			section: SetupSection;
			action: "complete" | "skip" | "reset";
		}) => graphsApi.setSetupSection(username, graphSlug, section, action),
		onSuccess: (_, { username, graphSlug }) => {
			qc.invalidateQueries({ queryKey: graphKey(username, graphSlug) });
			qc.invalidateQueries({ queryKey: GRAPHS_KEY });
		},
	});
}

// ─────────────────────────────────────────────────────────────────────────────
// Graph connection hooks (graph-scoped sub-resource)
// ─────────────────────────────────────────────────────────────────────────────

const connectionKey = (username: string, graphSlug: string) =>
	[...graphKey(username, graphSlug), "connection"] as const;

export function useGraphConnectionQuery(
	username: string | undefined,
	graphSlug: string | undefined,
) {
	return useQuery({
		queryKey: connectionKey(username ?? "", graphSlug ?? ""),
		queryFn: () =>
			graphsApi.getConnection(username as string, graphSlug as string),
		enabled: !!username && !!graphSlug,
		refetchInterval: (query) => {
			const status = query.state.data?.status;
			return status === "CONNECTING" ? 5_000 : false;
		},
	});
}

export function usePutGraphConnectionMutation() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			username,
			graphSlug,
			data,
		}: {
			username: string;
			graphSlug: string;
			data: GraphConnectionCreate;
		}) => graphsApi.putConnection(username, graphSlug, data),
		onSuccess: (_, { username, graphSlug }) => {
			qc.invalidateQueries({ queryKey: connectionKey(username, graphSlug) });
			qc.invalidateQueries({ queryKey: graphKey(username, graphSlug) });
		},
	});
}

export function useDeleteGraphConnectionMutation() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			username,
			graphSlug,
		}: { username: string; graphSlug: string }) =>
			graphsApi.deleteConnection(username, graphSlug),
		onSuccess: (_, { username, graphSlug }) => {
			qc.invalidateQueries({ queryKey: connectionKey(username, graphSlug) });
			qc.invalidateQueries({ queryKey: graphKey(username, graphSlug) });
		},
	});
}

export function usePingGraphConnectionMutation() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			username,
			graphSlug,
		}: { username: string; graphSlug: string }) =>
			graphsApi.pingConnection(username, graphSlug),
		onSuccess: (_, { username, graphSlug }) => {
			qc.invalidateQueries({ queryKey: connectionKey(username, graphSlug) });
		},
	});
}

// RFC-022 — accept the risk of an UNTESTED backend version (lifts read-only).
export function useAcknowledgeConnectionVersionMutation() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			username,
			graphSlug,
		}: { username: string; graphSlug: string }) =>
			graphsApi.acknowledgeConnectionVersion(username, graphSlug),
		onSuccess: (_, { username, graphSlug }) => {
			qc.invalidateQueries({ queryKey: connectionKey(username, graphSlug) });
		},
	});
}

// RFC-022 — declare a server version when auto-detection is unavailable.
export function useDeclareConnectionVersionMutation() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			username,
			graphSlug,
			serverVersion,
		}: { username: string; graphSlug: string; serverVersion: string }) =>
			graphsApi.declareConnectionVersion(username, graphSlug, serverVersion),
		onSuccess: (_, { username, graphSlug }) => {
			qc.invalidateQueries({ queryKey: connectionKey(username, graphSlug) });
		},
	});
}
