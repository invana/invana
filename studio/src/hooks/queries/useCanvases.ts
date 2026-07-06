// TanStack Query hooks for Explorer canvases (RFC-043). Mirrors useGraphs /
// sessions: a list query plus create / update / delete mutations that invalidate
// the graph's canvas list on success.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	type CanvasCreateBody,
	type CanvasListOptions,
	type CanvasUpdateBody,
	canvasesApi,
} from "../../services/api/canvases";

const CANVASES_KEY = ["canvases"] as const;
const canvasesKey = (username: string, graphSlug: string) =>
	[...CANVASES_KEY, username, graphSlug] as const;

export function useCanvasesQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	opts?: CanvasListOptions,
) {
	return useQuery({
		queryKey: [...canvasesKey(username ?? "", graphSlug ?? ""), opts ?? {}],
		queryFn: () =>
			canvasesApi.list(username as string, graphSlug as string, opts),
		enabled: !!username && !!graphSlug,
	});
}

/**
 * Lazily fetch a single canvas's `banner` screenshot (RFC-045). The list
 * summary omits the banner (heavy), so a row that advertised `hasBanner` pulls
 * it on demand through here. Cached by canvas id — opening the canvas later
 * reuses it. Disabled until a `canvasId` is given (rows with no banner never
 * fetch).
 */
export function useCanvasBannerQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	canvasId: string | null | undefined,
) {
	return useQuery({
		queryKey: [
			...canvasesKey(username ?? "", graphSlug ?? ""),
			"detail",
			canvasId,
		],
		queryFn: () =>
			canvasesApi.get(
				username as string,
				graphSlug as string,
				canvasId as string,
			),
		enabled: !!username && !!graphSlug && !!canvasId,
		staleTime: 5 * 60 * 1000,
		select: (c) => c.banner ?? null,
	});
}

export function useCreateCanvasMutation(username: string, graphSlug: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: CanvasCreateBody) =>
			canvasesApi.create(username, graphSlug, body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: canvasesKey(username, graphSlug) });
		},
	});
}

export function useUpdateCanvasMutation(username: string, graphSlug: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: CanvasUpdateBody }) =>
			canvasesApi.update(username, graphSlug, id, data),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: canvasesKey(username, graphSlug) });
		},
	});
}

export function useDeleteCanvasMutation(username: string, graphSlug: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => canvasesApi.remove(username, graphSlug, id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: canvasesKey(username, graphSlug) });
		},
	});
}
