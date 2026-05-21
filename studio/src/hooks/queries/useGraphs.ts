import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { graphsApi } from "../../services/api/graphs";
import type {
	GraphConnectionCreate,
	GraphCreate,
	GraphUpdate,
	SetupSection,
} from "../../types/graphs";

// ─────────────────────────────────────────────────────────────────────────────
// Graph container hooks (RFC-017)
// ─────────────────────────────────────────────────────────────────────────────

const GRAPHS_KEY = ["graphs"] as const;
const graphKey = (username: string, graphSlug: string) =>
	[...GRAPHS_KEY, username, graphSlug] as const;

export function useGraphsQuery() {
	return useQuery({
		queryKey: GRAPHS_KEY,
		queryFn: () => graphsApi.list(),
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
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: GRAPHS_KEY });
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
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: GRAPHS_KEY });
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
