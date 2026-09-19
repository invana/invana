// TanStack Query hooks for Explorer canvases (docs/for-developers/modules/explore/features/boards.md). Mirrors useGraphs /
// sessions: a list query plus create / update / delete mutations that invalidate
// the graph's canvas list on success.

import {
	type BoardCreateBody,
	type BoardListOptions,
	type BoardUpdateBody,
	boardsApi,
} from "@/services/api/boards";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const CANVASES_KEY = ["canvases"] as const;
const canvasesKey = (username: string, graphSlug: string) =>
	[...CANVASES_KEY, username, graphSlug] as const;

export function useBoardsQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	opts?: BoardListOptions,
) {
	return useQuery({
		queryKey: [...canvasesKey(username ?? "", graphSlug ?? ""), opts ?? {}],
		queryFn: () =>
			boardsApi.list(username as string, graphSlug as string, opts),
		enabled: !!username && !!graphSlug,
	});
}

/**
 * Lazily fetch a single canvas's `banner` screenshot (docs/for-developers/modules/explore/features/graph-canvas.md). The list
 * summary omits the banner (heavy), so a row that advertised `hasBanner` pulls
 * it on demand through here. Cached by canvas id — opening the canvas later
 * reuses it. Disabled until a `boardId` is given (rows with no banner never
 * fetch).
 */
export function useCanvasBannerQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	boardId: string | null | undefined,
) {
	return useQuery({
		queryKey: [
			...canvasesKey(username ?? "", graphSlug ?? ""),
			"detail",
			boardId,
		],
		queryFn: () =>
			boardsApi.get(username as string, graphSlug as string, boardId as string),
		enabled: !!username && !!graphSlug && !!boardId,
		staleTime: 5 * 60 * 1000,
		select: (c) => c.banner ?? null,
	});
}

export function useCreateCanvasMutation(username: string, graphSlug: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: BoardCreateBody) =>
			boardsApi.create(username, graphSlug, body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: canvasesKey(username, graphSlug) });
		},
	});
}

export function useUpdateCanvasMutation(username: string, graphSlug: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: BoardUpdateBody }) =>
			boardsApi.update(username, graphSlug, id, data),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: canvasesKey(username, graphSlug) });
		},
	});
}

export function useDeleteCanvasMutation(username: string, graphSlug: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => boardsApi.remove(username, graphSlug, id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: canvasesKey(username, graphSlug) });
		},
	});
}
