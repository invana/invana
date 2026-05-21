import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { llmProvidersApi } from "../../services/api/llm";
import type { LLMProviderCreate, LLMProviderUpdate } from "../../types/llm";

const key = (username: string, graphSlug: string) =>
	["llm-providers", username, graphSlug] as const;

export function useLLMProvidersQuery(
	username: string | undefined,
	graphSlug: string | undefined,
) {
	return useQuery({
		queryKey: key(username ?? "", graphSlug ?? ""),
		queryFn: () =>
			llmProvidersApi.list(username as string, graphSlug as string),
		enabled: !!username && !!graphSlug,
	});
}

export function useCreateLLMProviderMutation(
	username: string,
	graphSlug: string,
) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (data: LLMProviderCreate) =>
			llmProvidersApi.create(username, graphSlug, data),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: key(username, graphSlug) });
		},
	});
}

export function useUpdateLLMProviderMutation(
	username: string,
	graphSlug: string,
) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: LLMProviderUpdate }) =>
			llmProvidersApi.update(username, graphSlug, id, data),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: key(username, graphSlug) });
		},
	});
}

export function useDeleteLLMProviderMutation(
	username: string,
	graphSlug: string,
) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => llmProvidersApi.remove(username, graphSlug, id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: key(username, graphSlug) });
		},
	});
}

export function useSetDefaultLLMProviderMutation(
	username: string,
	graphSlug: string,
) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) =>
			llmProvidersApi.setDefault(username, graphSlug, id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: key(username, graphSlug) });
		},
	});
}
