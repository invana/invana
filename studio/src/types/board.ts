// Boards — saved working surfaces (docs/for-developers/modules/explore/features/boards.md).
//
// A board's columns are grouped by **lifetime**, not by structure-vs-data
// (boards-migration.md B14): `styling` and `settings` are the RULES and survive
// a re-query; `snapshot` and `positions` are the DATA and are replaced by it.
// Boards are shared across every graph member; a `data` board is additionally
// backed by the session it was drawn from — provenance, not identity (B4).

import type { QueryResultItem } from "@/types/query";

/** The painted graph, stored verbatim so a canvas reopens without a re-query. */
export interface CanvasSnapshot {
	items: QueryResultItem[];
}

/** Node id → world position, captured from the live canvas store on save. */
export type CanvasPositions = Record<string, { x: number; y: number }>;

/** Visual rules for one node type (docs/for-developers/modules/explore/features/graph-canvas.md). All optional — unset uses defaults. */
export interface NodeTypeStyle {
	/** Hex color, e.g. "#7c3aed". */
	color?: string;
	/** Property key to draw as the node's label (falls back to the default). */
	labelProperty?: string;
	/** Node size (px). */
	size?: number;
}

/** Visual rules for one edge type (docs/for-developers/modules/explore/features/graph-canvas.md). */
export interface EdgeTypeStyle {
	color?: string;
	labelProperty?: string;
	width?: number;
}

/** A canvas's per node/edge-TYPE-NAME visual rules (docs/for-developers/modules/explore/features/graph-canvas.md). */
export interface CanvasStyling {
	nodeTypes?: Record<string, NodeTypeStyle>;
	edgeTypes?: Record<string, EdgeTypeStyle>;
}

/** List-row shape — omits the heavy render blobs (snapshot/positions/banner). */
export interface BoardSummary {
	id: string;
	sessionId: string;
	graphId: string;
	createdById: string;
	title: string;
	instructions: string;
	styling: CanvasStyling;
	hasBanner: boolean;
	pinned: boolean;
	archived: boolean;
	createdAt: Date;
	updatedAt: Date;
}

/** Full canvas — everything needed to hydrate the Explorer canvas. */
export interface Board extends BoardSummary {
	snapshot: CanvasSnapshot;
	sourceQuery?: string;
	viewState: Record<string, unknown>;
	filters: Record<string, unknown>;
	positions: CanvasPositions;
	settings: Record<string, unknown>;
	/** Base64 PNG data URL of the canvas screenshot; undefined until captured. */
	banner?: string;
}

// ── Board versions — the history, and reports (docs/for-developers/modules/explore/features/boards.md) ─────────────────────────────────

/**
 * What produced a saved state: a composer query, a node expand, a load, or a
 * `manual` "Save current state" click.
 */
export type BoardVersionCause = "query" | "expand" | "load" | "manual";

/** Timeline-row shape — omits the heavy render blobs (snapshot/positions/banner). */
export interface BoardVersionSummary {
	id: string;
	boardId: string;
	createdById: string;
	/** The thread turn that produced this state (provenance); may be absent. */
	messageId?: string;
	kind: BoardVersionCause;
	label: string;
	nodeCount: number;
	edgeCount: number;
	hasBanner: boolean;
	createdAt: Date;
}

/**
 * A frozen, immutable reading of a board (docs/for-developers/modules/explore/features/boards.md).
 *
 * `snapshot` is the **resolved document**, stored merged and never re-merged
 * (B16): `canvas.exportState()` on a drawn board — restored by handing it back
 * to `canvas.importState()` — or the `DashboardSpec` with its numbers already
 * in it on a declared one, which is what a **report** is.
 */
export interface BoardVersion extends BoardVersionSummary {
	snapshot: Record<string, unknown>;
	sourceQuery?: string;
	styling: CanvasStyling;
	settings: Record<string, unknown>;
	banner?: string;
}
