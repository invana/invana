import { llmProvidersApi } from "@/services/api/llm";
import type {
	LLMModelCreate,
	LLMProviderCreate,
	LLMProviderUpdate,
} from "@/types/llm";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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

/**
 * Offer one more model on an endpoint (PM9).
 *
 * The ranks go with it: a model added with none is neither cheap nor capable
 * to `shipped_cast`, so it silently never wins a role (PM12).
 */
export function useAddLLMModelMutation(username: string, graphSlug: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: LLMModelCreate }) =>
			llmProvidersApi.addModel(username, graphSlug, id, data),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: key(username, graphSlug) });
		},
	});
}

/**
 * Stop offering one. **Refused while a world casts it**, and the refusal names
 * the worlds (PM11) — the caller renders it where the click was.
 */
export function useRemoveLLMModelMutation(username: string, graphSlug: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, modelRowId }: { id: string; modelRowId: string }) =>
			llmProvidersApi.removeModel(username, graphSlug, id, modelRowId),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: key(username, graphSlug) });
		},
	});
}
