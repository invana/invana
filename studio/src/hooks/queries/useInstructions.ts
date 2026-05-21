import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { instructionsApi } from "../../services/api/instructions";
import type {
	InstructionCreate,
	InstructionUpdate,
} from "../../types/instructions";

const key = (username: string, graphSlug: string) =>
	["instructions", username, graphSlug] as const;

export function useInstructionsQuery(
	username: string | undefined,
	graphSlug: string | undefined,
) {
	return useQuery({
		queryKey: key(username ?? "", graphSlug ?? ""),
		queryFn: () =>
			instructionsApi.list(username as string, graphSlug as string),
		enabled: !!username && !!graphSlug,
	});
}

export function useCreateInstructionMutation(
	username: string,
	graphSlug: string,
) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (data: InstructionCreate) =>
			instructionsApi.create(username, graphSlug, data),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: key(username, graphSlug) });
		},
	});
}

export function useUpdateInstructionMutation(
	username: string,
	graphSlug: string,
) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: InstructionUpdate }) =>
			instructionsApi.update(username, graphSlug, id, data),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: key(username, graphSlug) });
		},
	});
}

export function useDeleteInstructionMutation(
	username: string,
	graphSlug: string,
) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => instructionsApi.remove(username, graphSlug, id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: key(username, graphSlug) });
		},
	});
}
