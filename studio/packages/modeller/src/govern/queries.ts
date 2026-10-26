/**
 * Govern queries — worlds, guardrails and the participant catalogue.
 *
 * The catalogue is **resolved, never stored**: it is a view over the
 * Graph's published model versions, its stitches and its configured providers,
 * so a cached copy goes stale the moment a model publishes. That is why the
 * catalogue queries carry a short `staleTime` and every lens mutation
 * invalidates the lens list rather than patching it in place.
 */

import type {
	CastRole,
	GovernLayer,
	GovernRule,
	LensCreate,
	LensUpdate,
} from "@invana-studio/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { governApi } from "./api";
import type { GuardrailRule, GuardrailUpdate } from "./types";

const root = (u: string, g: string) => ["govern", u, g] as const;
const lensesKey = (u: string, g: string) => [...root(u, g), "lenses"] as const;
const catalogueKey = (u: string, g: string) =>
	[...root(u, g), "participants"] as const;
/** One world read whole — also what its breadcrumb names it from. */
export const lensDetailKey = (u: string, g: string, lensId: string) =>
	[...lensesKey(u, g), lensId, "detail"] as const;
const guardrailsKey = (u: string, g: string) =>
	[...root(u, g), "guardrails"] as const;
/** One guardrail read whole — also what its breadcrumb names it from. */
export const guardrailDetailKey = (u: string, g: string, id: string) =>
	[...guardrailsKey(u, g), id, "detail"] as const;

// ── Queries ────────────────────────────────────────────────────────────────
// The lens list is core's `useLensesQuery`, keyed under `lensesKey`, so the
// mutations below refresh it.

export function useLensQuery(
	username?: string,
	graphSlug?: string,
	lensId?: string,
) {
	return useQuery({
		queryKey: lensDetailKey(username ?? "", graphSlug ?? "", lensId ?? ""),
		queryFn: () =>
			governApi.getLens(
				username as string,
				graphSlug as string,
				lensId as string,
			),
		enabled: !!username && !!graphSlug && !!lensId,
	});
}

/**
 * The catalogue, optionally filtered to what a pattern matches.
 *
 * `match` is part of the key so the rule builder's live preview is a normal
 * query rather than a hand-rolled debounce — each pattern is its own cache
 * entry, and going back to a pattern already typed is instant.
 */
export function useParticipantsQuery(
	username?: string,
	graphSlug?: string,
	opts: { layer?: GovernLayer; match?: string; enabled?: boolean } = {},
) {
	const { enabled = true, ...params } = opts;
	return useQuery({
		queryKey: [
			...catalogueKey(username ?? "", graphSlug ?? ""),
			params,
		] as const,
		queryFn: () =>
			governApi.participants(username as string, graphSlug as string, params),
		enabled: enabled && !!username && !!graphSlug,
		// Resolved, not stored — a model publishing changes the answer.
		staleTime: 30_000,
	});
}

export function useRunTouchesQuery(
	username?: string,
	graphSlug?: string,
	runId?: string,
) {
	return useQuery({
		queryKey: [...root(username ?? "", graphSlug ?? ""), "touches", runId],
		queryFn: () =>
			governApi.touches(
				username as string,
				graphSlug as string,
				runId as string,
			),
		enabled: !!username && !!graphSlug && !!runId,
	});
}

export function useCompareRunsQuery(
	username?: string,
	graphSlug?: string,
	a?: string,
	b?: string,
) {
	return useQuery({
		queryKey: [...root(username ?? "", graphSlug ?? ""), "compare", a, b],
		queryFn: () =>
			governApi.compare(
				username as string,
				graphSlug as string,
				a as string,
				b as string,
			),
		enabled: !!username && !!graphSlug && !!a && !!b,
	});
}

// ── Mutations ──────────────────────────────────────────────────────────────

function useLensInvalidation(username?: string, graphSlug?: string) {
	const qc = useQueryClient();
	return () => {
		qc.invalidateQueries({
			queryKey: lensesKey(username ?? "", graphSlug ?? ""),
		});
	};
}

export function useCreateLensMutation(username?: string, graphSlug?: string) {
	const invalidate = useLensInvalidation(username, graphSlug);
	return useMutation({
		mutationFn: (data: LensCreate) =>
			governApi.createLens(username as string, graphSlug as string, data),
		onSuccess: invalidate,
	});
}

export function useUpdateLensMutation(username?: string, graphSlug?: string) {
	const invalidate = useLensInvalidation(username, graphSlug);
	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: LensUpdate }) =>
			governApi.updateLens(username as string, graphSlug as string, id, data),
		onSuccess: invalidate,
	});
}

export function useDeleteLensMutation(username?: string, graphSlug?: string) {
	const invalidate = useLensInvalidation(username, graphSlug);
	return useMutation({
		mutationFn: (id: string) =>
			governApi.deleteLens(username as string, graphSlug as string, id),
		onSuccess: invalidate,
	});
}

export function useDuplicateLensMutation(
	username?: string,
	graphSlug?: string,
) {
	const invalidate = useLensInvalidation(username, graphSlug);
	return useMutation({
		mutationFn: (id: string) =>
			governApi.duplicateLens(username as string, graphSlug as string, id),
		onSuccess: invalidate,
	});
}

/**
 * What a save would be refused for. A mutation rather than a query because it
 * is asked *on a gesture*, about a draft the server has never seen — there is
 * no resource to key a cache on.
 */
export function useValidateLensMutation(username?: string, graphSlug?: string) {
	return useMutation({
		mutationFn: (data: {
			rules?: GovernRule[];
			cast?: Partial<Record<CastRole, string>>;
			closed_layers?: GovernLayer[];
		}) => governApi.validateLens(username as string, graphSlug as string, data),
	});
}

// ── Guardrails ─────────────────────────────────────────────────────────────

export function useGuardrailsQuery(username?: string, graphSlug?: string) {
	return useQuery({
		queryKey: guardrailsKey(username ?? "", graphSlug ?? ""),
		queryFn: () =>
			governApi.guardrails(username as string, graphSlug as string),
		enabled: !!username && !!graphSlug,
	});
}

export function useGuardrailQuery(
	username?: string,
	graphSlug?: string,
	guardrailId?: string,
) {
	return useQuery({
		queryKey: guardrailDetailKey(
			username ?? "",
			graphSlug ?? "",
			guardrailId ?? "",
		),
		queryFn: () =>
			governApi.guardrail(
				username as string,
				graphSlug as string,
				guardrailId as string,
			),
		enabled: !!username && !!graphSlug && !!guardrailId,
	});
}

export function useGuardrailTargetsQuery(
	username?: string,
	graphSlug?: string,
	enabled = true,
) {
	return useQuery({
		queryKey: [...guardrailsKey(username ?? "", graphSlug ?? ""), "targets"],
		queryFn: () =>
			governApi.guardrailTargets(username as string, graphSlug as string),
		enabled: enabled && !!username && !!graphSlug,
		staleTime: 30_000,
	});
}

/**
 * What a rule would cost before it is saved — keyed on the rule, so the
 * dialog's impact line is a query that follows the three fields as they move.
 */
export function useGuardrailImpactQuery(
	username?: string,
	graphSlug?: string,
	rule?: GuardrailRule | null,
) {
	return useQuery({
		queryKey: [
			...guardrailsKey(username ?? "", graphSlug ?? ""),
			"impact",
			rule,
		],
		queryFn: () =>
			governApi.guardrailImpact(
				username as string,
				graphSlug as string,
				rule as GuardrailRule,
			),
		enabled: !!username && !!graphSlug && !!rule?.target,
	});
}

/** The lens canvas: the guardrails alone, or `world` composed inside them. */
export function useLensViewQuery(
	username?: string,
	graphSlug?: string,
	worldId?: string | null,
) {
	return useQuery({
		queryKey: [...root(username ?? "", graphSlug ?? ""), "view", worldId ?? ""],
		queryFn: () =>
			governApi.view(
				username as string,
				graphSlug as string,
				worldId ?? undefined,
			),
		enabled: !!username && !!graphSlug,
	});
}

/** A guardrail write changes the list, the view and the lenses it compiles to. */
function useGuardrailInvalidation(username?: string, graphSlug?: string) {
	const qc = useQueryClient();
	return () => {
		qc.invalidateQueries({ queryKey: root(username ?? "", graphSlug ?? "") });
	};
}

export function useCreateGuardrailMutation(
	username?: string,
	graphSlug?: string,
) {
	const invalidate = useGuardrailInvalidation(username, graphSlug);
	return useMutation({
		mutationFn: (data: GuardrailRule) =>
			governApi.createGuardrail(username as string, graphSlug as string, data),
		onSuccess: invalidate,
	});
}

export function useUpdateGuardrailMutation(
	username?: string,
	graphSlug?: string,
) {
	const invalidate = useGuardrailInvalidation(username, graphSlug);
	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: GuardrailUpdate }) =>
			governApi.updateGuardrail(
				username as string,
				graphSlug as string,
				id,
				data,
			),
		onSuccess: invalidate,
	});
}

export function useDeleteGuardrailMutation(
	username?: string,
	graphSlug?: string,
) {
	const invalidate = useGuardrailInvalidation(username, graphSlug);
	return useMutation({
		mutationFn: (id: string) =>
			governApi.deleteGuardrail(username as string, graphSlug as string, id),
		onSuccess: invalidate,
	});
}
