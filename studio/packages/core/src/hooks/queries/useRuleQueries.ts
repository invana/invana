/**
 * The rule reads and writes — every rule in force in a Graph, a Project's
 * working rules and the invariants it inherits, one rule, where it was cited,
 * and what a check would have broken over the last 30 days.
 *
 * Every key sits under the Graph's rules, so rewording or deactivating a rule
 * (scope-blind, by id) refreshes every surface that lists one.
 */

import {
	keepPreviousData,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { listQueryKey } from "../../lib/listQuery";
import { rulesApi } from "../../services/api/rules";
import type { ListQuery } from "../../types/list";
import type {
	RuleCreate,
	RuleImpactRequest,
	RuleScope,
	RuleUpdate,
} from "../../types/rules";

const rulesKey = (username: string, graphSlug: string) =>
	["rules", username, graphSlug] as const;

/** Every rule in force in the Graph, one page, filtered the way the URL says. */
export function useRulesQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	query: ListQuery = {},
) {
	return useQuery({
		queryKey: [
			...rulesKey(username ?? "", graphSlug ?? ""),
			"list",
			listQueryKey(query),
		] as const,
		queryFn: () =>
			rulesApi.list(username as string, graphSlug as string, query),
		enabled: !!username && !!graphSlug,
		placeholderData: keepPreviousData,
	});
}

/** One Graph or project rule. */
export function useRuleQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	ruleId: string | null | undefined,
) {
	return useQuery({
		queryKey: [...rulesKey(username ?? "", graphSlug ?? ""), ruleId] as const,
		queryFn: () =>
			rulesApi.get(username as string, graphSlug as string, ruleId as string),
		enabled: !!username && !!graphSlug && !!ruleId,
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

/**
 * What a check would have broken in the last 30 days — read by the engine as
 * the dialog holds it. An install check is read in every Graph.
 */
export function useRuleImpactQuery(
	username: string,
	graphSlug: string,
	data: RuleImpactRequest | null,
) {
	return useQuery({
		queryKey: [
			...rulesKey(username, graphSlug),
			"impact",
			JSON.stringify(data),
		] as const,
		queryFn: () =>
			data?.scope === "install"
				? rulesApi.install.impact(data)
				: rulesApi.impact(username, graphSlug, data as RuleImpactRequest),
		enabled: !!data,
		placeholderData: keepPreviousData,
		retry: false,
	});
}

/** The projects a working rule may sit on, read when the dialog opens. */
export function useRuleProjectsQuery(
	username: string,
	graphSlug: string,
	enabled: boolean,
) {
	return useQuery({
		queryKey: [...rulesKey(username, graphSlug), "projects"] as const,
		queryFn: () => rulesApi.projects(username, graphSlug),
		enabled,
	});
}

/** Where a new or edited rule is written: each scope has its own route. */
export interface RuleSave {
	scope: RuleScope;
	/** Set when editing. */
	id?: string;
	projectKey?: string | null;
	data: RuleCreate | RuleUpdate;
}

export function useSaveRuleMutation(username: string, graphSlug: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ scope, id, projectKey, data }: RuleSave) => {
			if (id)
				return scope === "install"
					? rulesApi.install.update(id, data)
					: rulesApi.update(username, graphSlug, id, data);
			const created = data as RuleCreate;
			if (scope === "install") return rulesApi.install.create(created);
			if (scope === "project")
				return rulesApi.createForProject(
					username,
					graphSlug,
					projectKey as string,
					created,
				);
			return rulesApi.create(username, graphSlug, created);
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: rulesKey(username, graphSlug) });
		},
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
		mutationFn: ({
			id,
			active,
			scope,
		}: {
			id: string;
			active: boolean;
			scope?: RuleScope;
		}) =>
			scope === "install"
				? rulesApi.install.setActive(id, active)
				: rulesApi.setActive(username, graphSlug, id, active),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: rulesKey(username, graphSlug) });
		},
	});
}
