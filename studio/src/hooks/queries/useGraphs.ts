import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { graphConnectionsApi, graphsApi } from "../../services/api/graphs";
import type {
	GraphConnectionCreate,
	GraphConnectionUpdate,
	GraphCreate,
	GraphUpdate,
	SetupSection,
} from "../../types/graphs";

// ─────────────────────────────────────────────────────────────────────────────
// Graph container hooks (RFC-017)
// ─────────────────────────────────────────────────────────────────────────────

const GRAPHS_KEY = ["graphs"] as const;
const graphKey = (username: string, slug: string) =>
	[...GRAPHS_KEY, username, slug] as const;

export function useGraphsQuery() {
	return useQuery({
		queryKey: GRAPHS_KEY,
		queryFn: () => graphsApi.list(),
		staleTime: 30_000,
	});
}

export function useGraphQuery(
	username: string | undefined,
	slug: string | undefined,
) {
	return useQuery({
		queryKey: graphKey(username ?? "", slug ?? ""),
		queryFn: () => graphsApi.get(username as string, slug as string),
		enabled: !!username && !!slug,
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
			slug,
			data,
		}: {
			username: string;
			slug: string;
			data: GraphUpdate;
		}) => graphsApi.update(username, slug, data),
		onSuccess: (_, { username, slug }) => {
			qc.invalidateQueries({ queryKey: GRAPHS_KEY });
			qc.invalidateQueries({ queryKey: graphKey(username, slug) });
		},
	});
}

export function useDeleteGraphMutation() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ username, slug }: { username: string; slug: string }) =>
			graphsApi.remove(username, slug),
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
			slug,
			section,
			action,
		}: {
			username: string;
			slug: string;
			section: SetupSection;
			action: "complete" | "skip" | "reset";
		}) => graphsApi.setSetupSection(username, slug, section, action),
		onSuccess: (_, { username, slug }) => {
			qc.invalidateQueries({ queryKey: graphKey(username, slug) });
			qc.invalidateQueries({ queryKey: GRAPHS_KEY });
		},
	});
}

// ─────────────────────────────────────────────────────────────────────────────
// Graph connection hooks (graph-scoped sub-resource)
// ─────────────────────────────────────────────────────────────────────────────

const connectionKey = (username: string, slug: string) =>
	[...graphKey(username, slug), "connection"] as const;

export function useGraphConnectionQuery(
	username: string | undefined,
	slug: string | undefined,
) {
	return useQuery({
		queryKey: connectionKey(username ?? "", slug ?? ""),
		queryFn: () => graphsApi.getConnection(username as string, slug as string),
		enabled: !!username && !!slug,
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
			slug,
			data,
		}: {
			username: string;
			slug: string;
			data: GraphConnectionCreate;
		}) => graphsApi.putConnection(username, slug, data),
		onSuccess: (_, { username, slug }) => {
			qc.invalidateQueries({ queryKey: connectionKey(username, slug) });
			qc.invalidateQueries({ queryKey: graphKey(username, slug) });
		},
	});
}

export function useDeleteGraphConnectionMutation() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ username, slug }: { username: string; slug: string }) =>
			graphsApi.deleteConnection(username, slug),
		onSuccess: (_, { username, slug }) => {
			qc.invalidateQueries({ queryKey: connectionKey(username, slug) });
			qc.invalidateQueries({ queryKey: graphKey(username, slug) });
		},
	});
}

export function usePingGraphConnectionMutation() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ username, slug }: { username: string; slug: string }) =>
			graphsApi.pingConnection(username, slug),
		onSuccess: (_, { username, slug }) => {
			qc.invalidateQueries({ queryKey: connectionKey(username, slug) });
		},
	});
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy GraphConnection hooks (/api/v1/graph-connections)
//
// Retire once every Studio call site moves to the graph-scoped sub-resource.
// ─────────────────────────────────────────────────────────────────────────────

const CONNECTIONS_KEY = ["graph-connections"] as const;

export function useGraphConnectionsQuery() {
	return useQuery({
		queryKey: CONNECTIONS_KEY,
		queryFn: () => graphConnectionsApi.list(),
		staleTime: 30_000,
		refetchInterval: (query) => {
			const items = query.state.data?.items ?? [];
			return items.some((g) => g.status === "CONNECTING") ? 5_000 : false;
		},
	});
}

export function useLegacyGraphConnectionQuery(id: string) {
	return useQuery({
		queryKey: [...CONNECTIONS_KEY, id] as const,
		queryFn: () => graphConnectionsApi.get(id),
		enabled: !!id,
	});
}

export function useCreateGraphConnectionMutation() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (data: GraphConnectionCreate) =>
			graphConnectionsApi.create(data),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: CONNECTIONS_KEY });
		},
	});
}

export function useUpdateGraphConnectionMutation() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: GraphConnectionUpdate }) =>
			graphConnectionsApi.update(id, data),
		onSuccess: (_, { id }) => {
			qc.invalidateQueries({ queryKey: CONNECTIONS_KEY });
			qc.invalidateQueries({ queryKey: [...CONNECTIONS_KEY, id] });
		},
	});
}

export function useDeleteLegacyGraphConnectionMutation() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => graphConnectionsApi.remove(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: CONNECTIONS_KEY });
		},
	});
}

export function useReconnectGraphConnectionMutation() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => graphConnectionsApi.reconnect(id),
		onSuccess: (_, id) => {
			qc.invalidateQueries({ queryKey: CONNECTIONS_KEY });
			qc.invalidateQueries({ queryKey: [...CONNECTIONS_KEY, id] });
		},
	});
}
