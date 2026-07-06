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

/** Visual rules for one node type (RFC-045). All optional — unset uses defaults. */
export interface NodeTypeStyle {
	/** Hex color, e.g. "#7c3aed". */
	color?: string;
	/** Property key to draw as the node's label (falls back to the default). */
	labelProperty?: string;
	/** Node size (px). */
	size?: number;
}

/** Visual rules for one edge type (RFC-045). */
export interface EdgeTypeStyle {
	color?: string;
	labelProperty?: string;
	width?: number;
}

/** A canvas's per node/edge-TYPE-NAME visual rules (RFC-045). */
export interface CanvasStyling {
	nodeTypes?: Record<string, NodeTypeStyle>;
	edgeTypes?: Record<string, EdgeTypeStyle>;
}

/** List-row shape — omits the heavy render blobs (snapshot/positions/banner). */
export interface CanvasSummary {
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
export interface Canvas extends CanvasSummary {
	snapshot: CanvasSnapshot;
	sourceQuery?: string;
	viewState: Record<string, unknown>;
	filters: Record<string, unknown>;
	positions: CanvasPositions;
	settings: Record<string, unknown>;
	/** Base64 PNG data URL of the canvas screenshot; undefined until captured. */
	banner?: string;
}
