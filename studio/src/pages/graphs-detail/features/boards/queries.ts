import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	type BoardCreateBody,
	type BoardListOptions,
	type BoardUpdateBody,
	boardsApi,
} from "@/pages/graphs-detail/features/boards/api";
import { boardReportsApi } from "@/pages/graphs-detail/features/boards/reportsApi";
import {
	boardVersionsApi,
	type CanvasStateCreateBody,
} from "@/pages/graphs-detail/features/boards/versionsApi";

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

const STATES_KEY = ["canvasStates"] as const;
const canvasStatesKey = (
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

// ─────────────────────────────────────────────────────────────────────────────
// Reports — a **declared** board's kept readings, addressed by what the board
// is of (boards-migration.md B18 · B21).
// ─────────────────────────────────────────────────────────────────────────────

const REPORTS_KEY = ["boardReports"] as const;
export const boardReportsKey = (
	username: string,
	graphSlug: string,
	kind: string,
	subjectId: string,
) => [...REPORTS_KEY, username, graphSlug, kind, subjectId] as const;

/**
 * Every report kept of one subject, newest first.
 *
 * An empty list is the honest answer for a board nobody ever saved a reading
 * of — there is no row until the first report creates one (B9), and the list
 * route says so rather than 404ing.
 */
export function useBoardReportsQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	kind: string | undefined,
	subjectId: string | undefined,
	enabled = true,
) {
	return useQuery({
		queryKey: boardReportsKey(
			username ?? "",
			graphSlug ?? "",
			kind ?? "",
			subjectId ?? "",
		),
		queryFn: () =>
			boardReportsApi.list(
				username as string,
				graphSlug as string,
				kind as string,
				subjectId as string,
			),
		enabled: enabled && !!username && !!graphSlug && !!kind && !!subjectId,
	});
}
