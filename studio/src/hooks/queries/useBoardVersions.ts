// TanStack Query hooks for canvas version history (docs/for-developers/modules/explore/features/boards.md). A canvas's states
// are its append-only timeline; the list is summary-only (no heavy blobs), a
// per-state banner is lazy-loaded like the sessions-list preview, and a fork
// mutation restores a state into a brand-new canvas.

import {
	type CanvasStateCreateBody,
	boardVersionsApi,
} from "@/services/api/boardVersions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const STATES_KEY = ["canvasStates"] as const;
export const canvasStatesKey = (
	username: string,
	graphSlug: string,
	boardId: string,
) => [...STATES_KEY, username, graphSlug, boardId] as const;

/** The version-history timeline for a canvas (newest first, summary rows). */
export function useCanvasStatesQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	boardId: string | null | undefined,
	enabled = true,
) {
	return useQuery({
		queryKey: canvasStatesKey(username ?? "", graphSlug ?? "", boardId ?? ""),
		queryFn: () =>
			boardVersionsApi.list(
				username as string,
				graphSlug as string,
				boardId as string,
			),
		enabled: enabled && !!username && !!graphSlug && !!boardId,
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
	boardId: string | null | undefined,
	versionId: string | null | undefined,
) {
	return useQuery({
		queryKey: [
			...canvasStatesKey(username ?? "", graphSlug ?? "", boardId ?? ""),
			"detail",
			versionId,
		],
		queryFn: () =>
			boardVersionsApi.get(
				username as string,
				graphSlug as string,
				boardId as string,
				versionId as string,
			),
		enabled: !!username && !!graphSlug && !!boardId && !!versionId,
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
			boardId,
			body,
		}: {
			boardId: string;
			body: CanvasStateCreateBody;
		}) => boardVersionsApi.create(username, graphSlug, boardId, body),
		onSuccess: (_data, { boardId }) => {
			qc.invalidateQueries({
				queryKey: canvasStatesKey(username, graphSlug, boardId),
			});
		},
	});
}
