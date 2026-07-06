// ─────────────────────────────────────────────────────────────────────────────
// Canvases API client (RFC-043).
//
// The engine speaks snake_case DTOs; the Studio UI consumes the camelCase
// `Canvas` / `CanvasSummary` shapes (with `Date`s). Mapping happens here so the
// panel/dialog components stay unchanged.
// ─────────────────────────────────────────────────────────────────────────────

import type {
	Canvas,
	CanvasPositions,
	CanvasSnapshot,
	CanvasStyling,
	CanvasSummary,
} from "../../types/canvas";
import { request } from "./client";

// ── Wire DTOs (snake_case, as the engine returns) ────────────────────────────

interface ApiSummary {
	id: string;
	session_id: string;
	graph_id: string;
	created_by_id: string;
	title: string;
	instructions: string;
	styling: CanvasStyling;
	has_banner: boolean;
	pinned: boolean;
	archived: boolean;
	created_at: string;
	updated_at: string;
}

interface ApiDetail extends ApiSummary {
	snapshot: CanvasSnapshot;
	source_query: string | null;
	view_state: Record<string, unknown>;
	filters: Record<string, unknown>;
	positions: CanvasPositions;
	settings: Record<string, unknown>;
	banner: string | null;
}

interface ApiListResponse {
	items: ApiSummary[];
	total: number;
}

/** List ordering — newest by last activity (default) or by creation. */
export type CanvasSort = "updated" | "created";

/** Server-side list controls (pinned always float to the top regardless). */
export interface CanvasListOptions {
	limit?: number;
	offset?: number;
	sort?: CanvasSort;
	includeArchived?: boolean;
}

/** Body for creating a canvas — the backing session plus the live view state. */
export interface CanvasCreateBody {
	session_id: string;
	title?: string;
	instructions?: string;
	snapshot?: CanvasSnapshot;
	source_query?: string;
	view_state?: Record<string, unknown>;
	filters?: Record<string, unknown>;
	positions?: CanvasPositions;
	settings?: Record<string, unknown>;
	styling?: CanvasStyling;
}

/** Partial update — any subset (rename, re-snapshot, style, banner, pin/archive, …). */
export interface CanvasUpdateBody {
	title?: string;
	instructions?: string;
	snapshot?: CanvasSnapshot;
	source_query?: string;
	view_state?: Record<string, unknown>;
	filters?: Record<string, unknown>;
	positions?: CanvasPositions;
	settings?: Record<string, unknown>;
	styling?: CanvasStyling;
	banner?: string;
	pinned?: boolean;
	archived?: boolean;
}

export interface CanvasListResult {
	items: CanvasSummary[];
	total: number;
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function toSummary(c: ApiSummary): CanvasSummary {
	return {
		id: c.id,
		sessionId: c.session_id,
		graphId: c.graph_id,
		createdById: c.created_by_id,
		title: c.title,
		instructions: c.instructions,
		styling: c.styling ?? {},
		hasBanner: c.has_banner ?? false,
		pinned: c.pinned,
		archived: c.archived,
		createdAt: new Date(c.created_at),
		updatedAt: new Date(c.updated_at),
	};
}

function toCanvas(d: ApiDetail): Canvas {
	return {
		...toSummary(d),
		snapshot: d.snapshot ?? { items: [] },
		sourceQuery: d.source_query ?? undefined,
		viewState: d.view_state ?? {},
		filters: d.filters ?? {},
		positions: d.positions ?? {},
		settings: d.settings ?? {},
		banner: d.banner ?? undefined,
	};
}

// ── Client ────────────────────────────────────────────────────────────────────

const base = (username: string, graphSlug: string) =>
	`/api/v1/u/${username}/${graphSlug}/canvases`;

export const canvasesApi = {
	list: async (
		username: string,
		graphSlug: string,
		opts?: CanvasListOptions,
	): Promise<CanvasListResult> => {
		const params = new URLSearchParams();
		if (opts?.limit != null) params.set("limit", String(opts.limit));
		if (opts?.offset != null) params.set("offset", String(opts.offset));
		if (opts?.sort != null) params.set("sort", opts.sort);
		if (opts?.includeArchived) params.set("include_archived", "true");
		const qs = params.toString();
		const data = await request<ApiListResponse>(
			`${base(username, graphSlug)}${qs ? `?${qs}` : ""}`,
		);
		return { items: data.items.map(toSummary), total: data.total };
	},

	get: async (
		username: string,
		graphSlug: string,
		id: string,
	): Promise<Canvas> =>
		toCanvas(await request<ApiDetail>(`${base(username, graphSlug)}/${id}`)),

	create: async (
		username: string,
		graphSlug: string,
		body: CanvasCreateBody,
	): Promise<Canvas> =>
		toCanvas(
			await request<ApiDetail>(base(username, graphSlug), {
				method: "POST",
				body: JSON.stringify(body),
			}),
		),

	update: async (
		username: string,
		graphSlug: string,
		id: string,
		body: CanvasUpdateBody,
	): Promise<Canvas> =>
		toCanvas(
			await request<ApiDetail>(`${base(username, graphSlug)}/${id}`, {
				method: "PATCH",
				body: JSON.stringify(body),
			}),
		),

	remove: (username: string, graphSlug: string, id: string) =>
		request<void>(`${base(username, graphSlug)}/${id}`, { method: "DELETE" }),
};
