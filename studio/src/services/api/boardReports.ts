// ─────────────────────────────────────────────────────────────────────────────
// Reports — a declared board's versions, addressed by what the board is *of*
// ([B6 · B9](../../../../docs/for-developers/building-engine/boards-migration.md)).
//
// **Beside `boardVersions`, not folded into it.** The two address different
// things: that one takes a `board_id`, a row that exists; this one takes a
// `(kind, subject_id)` pair, because a live dashboard has **no row** until the
// first report creates it. Folding them together would mean a client that
// sometimes has an id and sometimes computes one, and a caller that has to know
// which — which is exactly the question B9 exists to stop anyone asking.
//
// What is sent is the **resolved document** — the `DashboardSpec` with the
// numbers already in it, never the spec plus a subject to re-read (B13). That
// is what lets a report outlive a pruned `result.json`.
// ─────────────────────────────────────────────────────────────────────────────

import { request } from "@/services/api/client";
import type { BoardVersion, BoardVersionSummary } from "@/types/board";

interface ApiReportSummary {
	id: string;
	board_id: string;
	created_by_id: string;
	message_id: string | null;
	cause: string;
	label: string;
	node_count: number;
	edge_count: number;
	has_banner: boolean;
	created_at: string;
}

interface ApiReportDetail extends ApiReportSummary {
	snapshot: Record<string, unknown>;
	source_query: string | null;
	styling: Record<string, unknown>;
	settings: Record<string, unknown>;
	banner: string | null;
}

interface ApiReportList {
	items: ApiReportSummary[];
	total: number;
}

/** What `Save report` sends: the document, and the name somebody chose. */
export interface ReportCreateBody {
	label: string;
	/** The resolved `DashboardSpec` — the reading, with its numbers (B13). */
	snapshot: Record<string, unknown>;
	/** The argument that produced this reading — `{view, selectedKey}` (B15). */
	settings?: Record<string, unknown>;
}

function toSummary(r: ApiReportSummary): BoardVersionSummary {
	return {
		id: r.id,
		boardId: r.board_id,
		createdById: r.created_by_id,
		messageId: r.message_id ?? undefined,
		kind: "report",
		label: r.label,
		nodeCount: r.node_count,
		edgeCount: r.edge_count,
		hasBanner: r.has_banner ?? false,
		createdAt: new Date(r.created_at),
	};
}

function toReport(d: ApiReportDetail): BoardVersion {
	return {
		...toSummary(d),
		snapshot: d.snapshot ?? {},
		sourceQuery: d.source_query ?? undefined,
		styling: d.styling ?? {},
		settings: d.settings ?? {},
		banner: d.banner ?? undefined,
	};
}

const base = (
	username: string,
	graphSlug: string,
	kind: string,
	subjectId: string,
) =>
	`/api/v1/u/${username}/${graphSlug}/boards/${kind}/${encodeURIComponent(subjectId)}/versions`;

export const boardReportsApi = {
	/** Every report kept of this subject. An empty list when nothing ever was. */
	list: async (
		username: string,
		graphSlug: string,
		kind: string,
		subjectId: string,
	): Promise<{ items: BoardVersionSummary[]; total: number }> => {
		const data = await request<ApiReportList>(
			base(username, graphSlug, kind, subjectId),
		);
		return { items: data.items.map(toSummary), total: data.total };
	},

	/** One frozen reading. The subject is never read — that is what makes it a report (B13). */
	get: async (
		username: string,
		graphSlug: string,
		kind: string,
		subjectId: string,
		versionId: string,
	): Promise<BoardVersion> =>
		toReport(
			await request<ApiReportDetail>(
				`${base(username, graphSlug, kind, subjectId)}/${versionId}`,
			),
		),

	/**
	 * Keep this reading. Create-or-get on `(graph_id, kind, subject_id)` happens
	 * server-side, so the client never asks whether a row exists (B9).
	 */
	create: async (
		username: string,
		graphSlug: string,
		kind: string,
		subjectId: string,
		body: ReportCreateBody,
	): Promise<BoardVersion> =>
		toReport(
			await request<ApiReportDetail>(
				base(username, graphSlug, kind, subjectId),
				{
					method: "POST",
					body: JSON.stringify({ cause: "report", ...body }),
				},
			),
		),
};
