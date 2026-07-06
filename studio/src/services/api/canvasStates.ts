// ─────────────────────────────────────────────────────────────────────────────
// Canvas states API client — version history (RFC-047).
//
// A `CanvasState` is a frozen, immutable snapshot of a canvas captured at each
// canvas-mutating turn (query / expand / load). The engine speaks snake_case
// DTOs; the Studio UI consumes the camelCase `CanvasState` shapes (with `Date`s).
// ─────────────────────────────────────────────────────────────────────────────

import type {
	Canvas,
	CanvasPositions,
	CanvasSnapshot,
	CanvasState,
	CanvasStateKind,
	CanvasStateSummary,
	CanvasStyling,
} from "../../types/canvas";
import { type ApiDetail, toCanvas } from "./canvases";
import { request } from "./client";

// ── Wire DTOs (snake_case, as the engine returns) ────────────────────────────

interface ApiStateSummary {
	id: string;
	canvas_id: string;
	created_by_id: string;
	message_id: string | null;
	kind: CanvasStateKind;
	label: string;
	node_count: number;
	edge_count: number;
	has_banner: boolean;
	created_at: string;
}

interface ApiStateDetail extends ApiStateSummary {
	snapshot: CanvasSnapshot;
	positions: CanvasPositions;
	source_query: string | null;
	styling: CanvasStyling;
	settings: Record<string, unknown>;
	banner: string | null;
}

interface ApiListResponse {
	items: ApiStateSummary[];
	total: number;
}

/** Body the client sends when snapshotting the canvas after a turn. */
export interface CanvasStateCreateBody {
	kind: CanvasStateKind;
	label?: string;
	snapshot?: CanvasSnapshot;
	positions?: CanvasPositions;
	source_query?: string;
	styling?: CanvasStyling;
	settings?: Record<string, unknown>;
	banner?: string;
	node_count?: number;
	edge_count?: number;
	message_id?: string;
}

export interface CanvasStateListResult {
	items: CanvasStateSummary[];
	total: number;
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function toStateSummary(s: ApiStateSummary): CanvasStateSummary {
	return {
		id: s.id,
		canvasId: s.canvas_id,
		createdById: s.created_by_id,
		messageId: s.message_id ?? undefined,
		kind: s.kind,
		label: s.label,
		nodeCount: s.node_count,
		edgeCount: s.edge_count,
		hasBanner: s.has_banner ?? false,
		createdAt: new Date(s.created_at),
	};
}

function toState(d: ApiStateDetail): CanvasState {
	return {
		...toStateSummary(d),
		snapshot: d.snapshot ?? { items: [] },
		positions: d.positions ?? {},
		sourceQuery: d.source_query ?? undefined,
		styling: d.styling ?? {},
		settings: d.settings ?? {},
		banner: d.banner ?? undefined,
	};
}

// ── Client ────────────────────────────────────────────────────────────────────

const base = (username: string, graphSlug: string, canvasId: string) =>
	`/api/v1/u/${username}/${graphSlug}/canvases/${canvasId}/states`;

export const canvasStatesApi = {
	list: async (
		username: string,
		graphSlug: string,
		canvasId: string,
		opts?: { limit?: number; offset?: number },
	): Promise<CanvasStateListResult> => {
		const params = new URLSearchParams();
		if (opts?.limit != null) params.set("limit", String(opts.limit));
		if (opts?.offset != null) params.set("offset", String(opts.offset));
		const qs = params.toString();
		const data = await request<ApiListResponse>(
			`${base(username, graphSlug, canvasId)}${qs ? `?${qs}` : ""}`,
		);
		return { items: data.items.map(toStateSummary), total: data.total };
	},

	get: async (
		username: string,
		graphSlug: string,
		canvasId: string,
		stateId: string,
	): Promise<CanvasState> =>
		toState(
			await request<ApiStateDetail>(
				`${base(username, graphSlug, canvasId)}/${stateId}`,
			),
		),

	create: async (
		username: string,
		graphSlug: string,
		canvasId: string,
		body: CanvasStateCreateBody,
	): Promise<CanvasState> =>
		toState(
			await request<ApiStateDetail>(base(username, graphSlug, canvasId), {
				method: "POST",
				body: JSON.stringify(body),
			}),
		),

	/** Restore a state by forking it into a brand-new session + canvas (RFC-047). */
	fork: async (
		username: string,
		graphSlug: string,
		canvasId: string,
		stateId: string,
	): Promise<Canvas> =>
		toCanvas(
			await request<ApiDetail>(
				`${base(username, graphSlug, canvasId)}/${stateId}/fork`,
				{ method: "POST" },
			),
		),
};
