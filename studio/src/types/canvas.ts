// Explorer canvases — saved, session-backed graph views (RFC-043).
//
// A canvas persists a painted view of the graph: the snapshot (the canvas
// items), node positions, viewport, filters and settings, plus a title and a
// written purpose (`instructions`). Canvases are shared across every graph
// member and each is backed 1:1 by a session.

import type { QueryResultItem } from "./query";

/** The painted graph, stored verbatim so a canvas reopens without a re-query. */
export interface CanvasSnapshot {
	items: QueryResultItem[];
}

/** Node id → world position, captured from the live canvas store on save. */
export type CanvasPositions = Record<string, { x: number; y: number }>;

/** List-row shape — omits the heavy render blobs. */
export interface CanvasSummary {
	id: string;
	sessionId: string;
	graphId: string;
	createdById: string;
	title: string;
	instructions: string;
	pinned: boolean;
	archived: boolean;
	createdAt: Date;
	updatedAt: Date;
}

/** Full canvas — everything needed to hydrate the Explorer canvas. */
export interface Canvas extends CanvasSummary {
	snapshot: CanvasSnapshot;
	sourceQuery?: string;
	viewState: Record<string, unknown>;
	filters: Record<string, unknown>;
	positions: CanvasPositions;
	settings: Record<string, unknown>;
}
