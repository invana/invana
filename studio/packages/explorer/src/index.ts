/**
 * `@invana-studio/explorer` — Explorer's public surface: the data canvas, what
 * is selected on it, node expansion, and the canvas tabs, one per open session
 * (4.1 [graph-canvas], 4.3 [selection-and-the-panel], 4.4 [the-console]).
 *
 * This file is the border. The app mounts the canvas through it, and the
 * Modeller's canvases reach the two things every canvas kind shares — the
 * backend and the theme adapter. Nothing outside this package imports one of
 * its files directly.
 *
 * The dependency runs one way: `canvases → explorer`. The host mounts the
 * canvas; the canvas never reaches for the strip. A strip control that must act
 * on a page body goes through `BoardPageHandle` (graph-detail-page.md).
 */

export { explorerApi } from "./api";
// Query results as canvas items, and a saved state as the engine reads it.
export {
	adaptItems,
	isCanvasStateSnapshot,
	resultToItems,
} from "./canvasItems";
export { ExpandNeighboursDialog } from "./ExpandNeighboursDialog";
export type {
	CanvasBackend,
	ExpandMenuHandlers,
	ExpandMenuSchema,
} from "./ExplorerCanvas";
export { ExplorerCanvas, ExplorerHeaderToolbar } from "./ExplorerCanvas";
export { ExplorerViewPanel } from "./ExplorerViewPanel";
export { InspectorViewPanel } from "./InspectorViewPanel";
// The product: its routes, and the slot the app fills with the page.
export { ExplorerSlotsContext, explorer } from "./product";
export { useTypeCountsQuery } from "./queries";
// Engine adapters — PixiJS needs concrete values, not classes.
export { slotForType } from "./typeColor";
export type {
	ExpandRequest,
	NeighborExpandResponse,
	TypeCountsResponse,
} from "./types";
export { useCanvasExpand } from "./useCanvasExpand";
// The data canvases' tabs, one per open session.
export { useCanvasTabs } from "./useCanvasTabs";
