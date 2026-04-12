import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { graphsApi } from "../../services/api/graphs";
import type { GraphCreate, GraphUpdate } from "../../types/graphs";

const GRAPHS_KEY = ["graphs"] as const;

export function useGraphsQuery() {
	return useQuery({
		queryKey: GRAPHS_KEY,
		queryFn: () => graphsApi.list(),
		staleTime: 30_000,
		refetchInterval: (query) => {
			const items = query.state.data?.items ?? [];
			return items.some((g) => g.status === "CONNECTING") ? 5_000 : false;
		},
	});
}

export function useGraphQuery(id: string) {
	return useQuery({
		queryKey: [...GRAPHS_KEY, id] as const,
		queryFn: () => graphsApi.get(id),
		enabled: !!id,
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
		mutationFn: ({ id, data }: { id: string; data: GraphUpdate }) =>
			graphsApi.update(id, data),
		onSuccess: (_, { id }) => {
			qc.invalidateQueries({ queryKey: GRAPHS_KEY });
			qc.invalidateQueries({ queryKey: [...GRAPHS_KEY, id] });
		},
	});
}

export function useDeleteGraphMutation() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => graphsApi.remove(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: GRAPHS_KEY });
		},
	});
}

export function useReconnectGraphMutation() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => graphsApi.reconnect(id),
		onSuccess: (_, id) => {
			qc.invalidateQueries({ queryKey: GRAPHS_KEY });
			qc.invalidateQueries({ queryKey: [...GRAPHS_KEY, id] });
		},
	});
}
