// ─────────────────────────────────────────────────────────────────────────────
// Board versions API client — the history, and reports (docs/for-developers/modules/explore/features/boards.md).
//
// A `BoardVersion` is one frozen reading of a board, written at each meaningful
// change (`cause`: query / expand / load / manual / report). The engine speaks snake_case
// DTOs; the Studio UI consumes the camelCase `BoardVersion` shapes (with `Date`s).
// ─────────────────────────────────────────────────────────────────────────────

import { request } from "@/services/api/client";
import type {
	BoardVersion,
	BoardVersionCause,
	BoardVersionSummary,
	CanvasStyling,
} from "@/types/board";

// ── Wire DTOs (snake_case, as the engine returns) ────────────────────────────

interface ApiVersionSummary {
	id: string;
	board_id: string;
	created_by_id: string;
	message_id: string | null;
	/** `cause` on the wire — two `kind` columns in one module was the bug B7 renamed away. */
	cause: BoardVersionCause;
	label: string;
	node_count: number;
	edge_count: number;
	has_banner: boolean;
	created_at: string;
}

interface ApiVersionDetail extends ApiVersionSummary {
	snapshot: Record<string, unknown>;
	source_query: string | null;
	styling: CanvasStyling;
	settings: Record<string, unknown>;
	banner: string | null;
}

interface ApiListResponse {
	items: ApiVersionSummary[];
	total: number;
}

/** Body the client sends when snapshotting the canvas after a turn. */
export interface CanvasStateCreateBody {
	cause: BoardVersionCause;
	label?: string;
	/** The engine-native `canvas.exportState()` envelope. */
	snapshot?: Record<string, unknown>;
	source_query?: string;
	styling?: CanvasStyling;
	settings?: Record<string, unknown>;
	banner?: string;
	node_count?: number;
	edge_count?: number;
	message_id?: string;
}

export interface CanvasStateListResult {
	items: BoardVersionSummary[];
	total: number;
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function toStateSummary(s: ApiVersionSummary): BoardVersionSummary {
	return {
		id: s.id,
		boardId: s.board_id,
		createdById: s.created_by_id,
		messageId: s.message_id ?? undefined,
		kind: s.cause,
		label: s.label,
		nodeCount: s.node_count,
		edgeCount: s.edge_count,
		hasBanner: s.has_banner ?? false,
		createdAt: new Date(s.created_at),
	};
}

function toState(d: ApiVersionDetail): BoardVersion {
	return {
		...toStateSummary(d),
		snapshot: d.snapshot ?? {},
		sourceQuery: d.source_query ?? undefined,
		styling: d.styling ?? {},
		settings: d.settings ?? {},
		banner: d.banner ?? undefined,
	};
}

// ── Client ────────────────────────────────────────────────────────────────────

const base = (username: string, graphSlug: string, boardId: string) =>
	`/api/v1/u/${username}/${graphSlug}/boards/${boardId}/versions`;

export const boardVersionsApi = {
	list: async (
		username: string,
		graphSlug: string,
		boardId: string,
		opts?: { limit?: number; offset?: number },
	): Promise<CanvasStateListResult> => {
		const params = new URLSearchParams();
		if (opts?.limit != null) params.set("limit", String(opts.limit));
		if (opts?.offset != null) params.set("offset", String(opts.offset));
		const qs = params.toString();
		const data = await request<ApiListResponse>(
			`${base(username, graphSlug, boardId)}${qs ? `?${qs}` : ""}`,
		);
		return { items: data.items.map(toStateSummary), total: data.total };
	},

	get: async (
		username: string,
		graphSlug: string,
		boardId: string,
		versionId: string,
	): Promise<BoardVersion> =>
		toState(
			await request<ApiVersionDetail>(
				`${base(username, graphSlug, boardId)}/${versionId}`,
			),
		),

	create: async (
		username: string,
		graphSlug: string,
		boardId: string,
		body: CanvasStateCreateBody,
	): Promise<BoardVersion> =>
		toState(
			await request<ApiVersionDetail>(base(username, graphSlug, boardId), {
				method: "POST",
				body: JSON.stringify(body),
			}),
		),
};
