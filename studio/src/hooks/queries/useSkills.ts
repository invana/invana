import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { skillsApi } from "../../services/api/skills";
import type { SkillCreate, SkillUpdate } from "../../types/skills";

const key = (username: string, graphSlug: string) =>
	["skills", username, graphSlug] as const;

export function useSkillsQuery(
	username: string | undefined,
	graphSlug: string | undefined,
) {
	return useQuery({
		queryKey: key(username ?? "", graphSlug ?? ""),
		queryFn: () => skillsApi.list(username as string, graphSlug as string),
		enabled: !!username && !!graphSlug,
	});
}

export function useCreateSkillMutation(username: string, graphSlug: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (data: SkillCreate) =>
			skillsApi.create(username, graphSlug, data),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: key(username, graphSlug) });
		},
	});
}

export function useUpdateSkillMutation(username: string, graphSlug: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: SkillUpdate }) =>
			skillsApi.update(username, graphSlug, id, data),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: key(username, graphSlug) });
		},
	});
}

export function useDeleteSkillMutation(username: string, graphSlug: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => skillsApi.remove(username, graphSlug, id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: key(username, graphSlug) });
		},
	});
}
