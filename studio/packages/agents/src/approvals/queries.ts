/**
 * TanStack Query hooks for Approvals: one page of asks, deciding one, and the
 * alert rules. Asks live under `["approvals", owner, graph, …]` — the key the
 * bell's tray uses too, so a decision here clears it there.
 */

import { type ListQuery, listQueryKey } from "@invana-studio/core";
import { approvalsApi } from "@invana-studio/shell";
import {
	keepPreviousData,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { alertRulesApi } from "./api";
import type { AlertRuleCreate, AlertRuleUpdate } from "./types";

type Scope = { username: string; graphSlug: string };

/** One page of asks — `f.view` for_you · all · answered, `f.kind`, `f.run_id`. */
export function useAsksQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	query: ListQuery,
) {
	return useQuery({
		queryKey: ["approvals", username, graphSlug, "page", listQueryKey(query)],
		queryFn: () =>
			approvalsApi.list(
				{ username: username as string, graphSlug: graphSlug as string },
				query,
			),
		enabled: !!username && !!graphSlug,
		placeholderData: keepPreviousData,
		refetchInterval: 15_000,
	});
}

/** Approve (for this run, or always on a delegation) or decline, with a note. */
export function useDecideMutation({ username, graphSlug }: Scope) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			id,
			decision,
			note = "",
			scope = "run",
		}: {
			id: string;
			decision: "approve" | "decline";
			note?: string;
			scope?: "run" | "always";
		}) =>
			decision === "approve"
				? approvalsApi.approve({ username, graphSlug }, id, note, scope)
				: approvalsApi.decline({ username, graphSlug }, id, note),
		onSettled: () => {
			qc.invalidateQueries({ queryKey: ["approvals"] });
			qc.invalidateQueries({ queryKey: ["run-page"] });
			qc.invalidateQueries({ queryKey: ["runs"] });
		},
	});
}

const rulesKey = (u?: string, g?: string) => ["alert-rules", u, g] as const;

export function useAlertRulesQuery(
	username: string | undefined,
	graphSlug: string | undefined,
) {
	return useQuery({
		queryKey: rulesKey(username, graphSlug),
		queryFn: () => alertRulesApi.list(username as string, graphSlug as string),
		enabled: !!username && !!graphSlug,
	});
}

/** Create, update (incl. on · off) and delete an alert rule. */
export function useAlertRuleMutations({ username, graphSlug }: Scope) {
	const qc = useQueryClient();
	const onSettled = () =>
		qc.invalidateQueries({ queryKey: rulesKey(username, graphSlug) });
	return {
		create: useMutation({
			mutationFn: (data: AlertRuleCreate) =>
				alertRulesApi.create(username, graphSlug, data),
			onSettled,
		}),
		update: useMutation({
			mutationFn: ({ id, data }: { id: string; data: AlertRuleUpdate }) =>
				alertRulesApi.update(username, graphSlug, id, data),
			onSettled,
		}),
		remove: useMutation({
			mutationFn: (id: string) => alertRulesApi.remove(username, graphSlug, id),
			onSettled,
		}),
	};
}
