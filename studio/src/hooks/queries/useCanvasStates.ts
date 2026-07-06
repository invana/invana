// TanStack Query hooks for canvas version history (RFC-047). A canvas's states
// are its append-only timeline; the list is summary-only (no heavy blobs), a
// per-state banner is lazy-loaded like the sessions-list preview, and a fork
// mutation restores a state into a brand-new canvas.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	type CanvasStateCreateBody,
	canvasStatesApi,
} from "../../services/api/canvasStates";

const STATES_KEY = ["canvasStates"] as const;
export const canvasStatesKey = (
	username: string,
	graphSlug: string,
	canvasId: string,
) => [...STATES_KEY, username, graphSlug, canvasId] as const;

/** The version-history timeline for a canvas (newest first, summary rows). */
export function useCanvasStatesQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	canvasId: string | null | undefined,
	enabled = true,
) {
	return useQuery({
		queryKey: canvasStatesKey(username ?? "", graphSlug ?? "", canvasId ?? ""),
		queryFn: () =>
			canvasStatesApi.list(
				username as string,
				graphSlug as string,
				canvasId as string,
			),
		enabled: enabled && !!username && !!graphSlug && !!canvasId,
	});
}

/**
 * Lazily fetch a single state's `banner` thumbnail. The timeline list omits the
 * banner (heavy), so each visible row pulls it on demand — mirroring the
 * sessions-list `useCanvasBannerQuery` pattern. Cached (immutable) by state id.
 */
export function useCanvasStateBannerQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	canvasId: string | null | undefined,
	stateId: string | null | undefined,
) {
	return useQuery({
		queryKey: [
			...canvasStatesKey(username ?? "", graphSlug ?? "", canvasId ?? ""),
			"detail",
			stateId,
		],
		queryFn: () =>
			canvasStatesApi.get(
				username as string,
				graphSlug as string,
				canvasId as string,
				stateId as string,
			),
		enabled: !!username && !!graphSlug && !!canvasId && !!stateId,
		// States are immutable — never restale.
		staleTime: Number.POSITIVE_INFINITY,
		select: (s) => s.banner ?? null,
	});
}

/** Append a snapshot to a canvas' history (best-effort, called after a turn). */
export function useCreateCanvasStateMutation(
	username: string,
	graphSlug: string,
) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			canvasId,
			body,
		}: {
			canvasId: string;
			body: CanvasStateCreateBody;
		}) => canvasStatesApi.create(username, graphSlug, canvasId, body),
		onSuccess: (_data, { canvasId }) => {
			qc.invalidateQueries({
				queryKey: canvasStatesKey(username, graphSlug, canvasId),
			});
		},
	});
}

/** Restore a state by forking it into a new session + canvas. */
export function useForkCanvasStateMutation(
	username: string,
	graphSlug: string,
) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			canvasId,
			stateId,
		}: {
			canvasId: string;
			stateId: string;
		}) => canvasStatesApi.fork(username, graphSlug, canvasId, stateId),
		onSuccess: () => {
			// A fork creates a new canvas (+ backing session) — refresh both lists.
			qc.invalidateQueries({ queryKey: ["canvases", username, graphSlug] });
			qc.invalidateQueries({ queryKey: ["sessions", username, graphSlug] });
		},
	});
}
