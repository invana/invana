/**
 * The rule reads and writes — a Graph's invariants, a Project's working rules
 * and the invariants it inherits, and where each rule was cited.
 *
 * Every key sits under the Graph's rules, so rewording or deactivating a rule
 * (scope-blind, by id) refreshes every surface that lists one.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rulesApi } from "../../services/api/rules";
import type { RuleCreate, RuleUpdate } from "../../types/rules";

const rulesKey = (username: string, graphSlug: string) =>
	["rules", username, graphSlug] as const;

export function useRulesQuery(
	username: string | undefined,
	graphSlug: string | undefined,
) {
	return useQuery({
		queryKey: rulesKey(username ?? "", graphSlug ?? ""),
		queryFn: () => rulesApi.list(username as string, graphSlug as string),
		enabled: !!username && !!graphSlug,
	});
}

/**
 * A Project's working rules, and the Graph invariants it inherits.
 *
 * The two lists arrive together and stay apart: the inherited half is
 * read-only here, so merging them would make an invariant look editable from a
 * project. Keyed under the Graph's rules, so rewording or deactivating a rule —
 * which is scope-blind, by id — refreshes both surfaces.
 */
export function useProjectRulesQuery(
	username: string,
	graphSlug: string,
	projectKey: string | null,
) {
	return useQuery({
		queryKey: [
			...rulesKey(username, graphSlug),
			"project",
			projectKey,
		] as const,
		queryFn: () =>
			rulesApi.listForProject(username, graphSlug, projectKey as string),
		enabled: !!projectKey,
	});
}

export function useRuleCitationsQuery(
	username: string,
	graphSlug: string,
	ruleId: string | null,
) {
	return useQuery({
		queryKey: [...rulesKey(username, graphSlug), ruleId, "citations"] as const,
		queryFn: () => rulesApi.citations(username, graphSlug, ruleId as string),
		enabled: !!ruleId,
	});
}

export function useCreateRuleMutation(username: string, graphSlug: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (data: RuleCreate) =>
			rulesApi.create(username, graphSlug, data),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: rulesKey(username, graphSlug) });
		},
	});
}

export function useCreateProjectRuleMutation(
	username: string,
	graphSlug: string,
	projectKey: string,
) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (data: RuleCreate) =>
			rulesApi.createForProject(username, graphSlug, projectKey, data),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: rulesKey(username, graphSlug) });
		},
	});
}

export function useUpdateRuleMutation(username: string, graphSlug: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: RuleUpdate }) =>
			rulesApi.update(username, graphSlug, id, data),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: rulesKey(username, graphSlug) });
		},
	});
}

/** Deactivating is how a rule stops applying. There is no delete. */
export function useSetRuleActiveMutation(username: string, graphSlug: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, active }: { id: string; active: boolean }) =>
			rulesApi.setActive(username, graphSlug, id, active),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: rulesKey(username, graphSlug) });
		},
	});
}
