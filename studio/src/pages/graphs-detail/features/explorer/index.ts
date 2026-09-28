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
 * on a page body goes through `BoardPageHandle` (graph-detail-page.md G12).
 */

export {
	ACTIVE_LAYOUT_ID,
	HIDDEN_STATE_NAME,
	ExplorerCanvas,
	ExplorerHeaderToolbar,
} from "@/pages/graphs-detail/features/explorer/ExplorerCanvas";
export type {
	CanvasBackend,
	ExpandMenuHandlers,
	ExpandMenuSchema,
} from "@/pages/graphs-detail/features/explorer/ExplorerCanvas";

export { ExplorerViewPanel } from "@/pages/graphs-detail/features/explorer/ExplorerViewPanel";
export { InspectorViewPanel } from "@/pages/graphs-detail/features/explorer/InspectorViewPanel";

// The two CV6 cards whose subject is what is drawn — Layers and Styling
// (boards.md CV8). History and Rename describe the record, so they are
// Canvases'.
export { LayersPanel } from "@/pages/graphs-detail/features/explorer/LayersPanel";
export { StylingPanel } from "@/pages/graphs-detail/features/explorer/StylingPanel";
export type { StyleTypeInfo } from "@/pages/graphs-detail/features/explorer/StylingPanel";

export { ExpandNeighboursDialog } from "@/pages/graphs-detail/features/explorer/ExpandNeighboursDialog";
export { useExpandNode } from "@/pages/graphs-detail/features/explorer/useExpandNode";
export { useCanvasExpand } from "@/pages/graphs-detail/features/explorer/useCanvasExpand";

// Query results as canvas items, and a saved state as the engine reads it.
export {
	adaptItems,
	expandRefusal,
	isCanvasStateSnapshot,
	resultToItems,
} from "@/pages/graphs-detail/features/explorer/canvasItems";

// Engine adapters — PixiJS needs concrete values, not classes.
export {
	typeColorNumber,
	typeDotColor,
} from "@/pages/graphs-detail/features/explorer/typeColor";
export {
	hiddenNodeTypes,
	isNodeHidden,
	setNodeHidden,
	setNodeTypeHidden,
} from "@/pages/graphs-detail/features/explorer/visibility";
