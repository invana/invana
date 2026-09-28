/**
 * The Explorer's public surface — the canvas, and what is selected on it
 * (4.1 [graph-canvas], 4.3 [selection-and-the-panel], 4.4 [the-console]).
 *
 * This file is the border (code-shape.md §4.1). `features/boards/` mounts the
 * canvas through it, and `models/` and `projects/` reach the two things
 * every canvas kind shares — the backend and the theme adapter. Nothing outside
 * this folder imports one of its files directly.
 *
 * The dependency runs one way: `canvases → explorer`. The host mounts the
 * canvas; the canvas never reaches for the strip. A strip control that must act
 * on a page body goes through `BoardPageHandle` (graph-detail-page.md).
 */

export { explorerApi } from "@/pages/graphs-detail/features/explorer/api";
// Query results as canvas items, and a saved state as the engine reads it.
export {
	adaptItems,
	isCanvasStateSnapshot,
	resultToItems,
} from "@/pages/graphs-detail/features/explorer/canvasItems";
export { ExpandNeighboursDialog } from "@/pages/graphs-detail/features/explorer/ExpandNeighboursDialog";
export type {
	CanvasBackend,
	ExpandMenuHandlers,
	ExpandMenuSchema,
} from "@/pages/graphs-detail/features/explorer/ExplorerCanvas";
export {
	ExplorerCanvas,
	ExplorerHeaderToolbar,
} from "@/pages/graphs-detail/features/explorer/ExplorerCanvas";
export { ExplorerViewPanel } from "@/pages/graphs-detail/features/explorer/ExplorerViewPanel";
export { InspectorViewPanel } from "@/pages/graphs-detail/features/explorer/InspectorViewPanel";
export { useTypeCountsQuery } from "@/pages/graphs-detail/features/explorer/queries";
// A board's stored styling in and out of canvas-ui's `StylingViewPanel`.
export {
	fromTypeStylingPatch,
	toTypeStylingPatch,
} from "@/pages/graphs-detail/features/explorer/stylingPatch";
// Engine adapters — PixiJS needs concrete values, not classes.
export { slotForType } from "@/pages/graphs-detail/features/explorer/typeColor";
export type {
	ExpandRequest,
	NeighborExpandResponse,
	TypeCountsResponse,
} from "@/pages/graphs-detail/features/explorer/types";
export { useCanvasExpand } from "@/pages/graphs-detail/features/explorer/useCanvasExpand";
