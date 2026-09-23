/**
 * Govern queries — worlds, guardrails and the participant catalogue.
 *
 * The catalogue is **resolved, never stored** (GV21): it is a view over the
 * Graph's published model versions, its stitches and its configured providers,
 * so a cached copy goes stale the moment a model publishes. That is why the
 * catalogue queries carry a short `staleTime` and every lens mutation
 * invalidates the lens list rather than patching it in place.
 */

import { governApi } from "@/services/api/govern";
import type {
	CastRole,
	GovernLayer,
	GovernRule,
	Lens,
	LensCreate,
	LensKind,
	LensUpdate,
} from "@/types/govern";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const root = (u: string, g: string) => ["govern", u, g] as const;
const lensesKey = (u: string, g: string) => [...root(u, g), "lenses"] as const;
const catalogueKey = (u: string, g: string) =>
	[...root(u, g), "participants"] as const;

// ── Queries ────────────────────────────────────────────────────────────────

export function useLensesQuery(
	username?: string,
	graphSlug?: string,
	opts: { kind?: LensKind; includeUnnamed?: boolean } = {},
) {
	return useQuery({
		queryKey: [...lensesKey(username ?? "", graphSlug ?? ""), opts] as const,
		queryFn: () =>
			governApi.listLenses(username as string, graphSlug as string, opts),
		enabled: !!username && !!graphSlug,
	});
}

export function useLensQuery(
	username?: string,
	graphSlug?: string,
	lensId?: string,
) {
	return useQuery({
		queryKey: [
			...lensesKey(username ?? "", graphSlug ?? ""),
			lensId,
			"detail",
		] as const,
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

/** World → guardrail. One field — and every world is revalidated against it. */
export function usePromoteLensMutation(username?: string, graphSlug?: string) {
	const invalidate = useLensInvalidation(username, graphSlug);
	return useMutation({
		mutationFn: ({ id, scope }: { id: string; scope?: string }) =>
			governApi.promoteLens(username as string, graphSlug as string, id, scope),
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

/** What a guardrail save would cost each world — *2 of 4 worlds would change*. */
export function useGuardrailImpactMutation(
	username?: string,
	graphSlug?: string,
) {
	return useMutation({
		mutationFn: (data: {
			rules?: GovernRule[];
			closed_layers?: GovernLayer[];
			scope?: string;
		}) =>
			governApi.guardrailImpact(username as string, graphSlug as string, data),
	});
}

export type { Lens };
