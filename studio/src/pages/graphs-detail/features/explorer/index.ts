/**
 * The Explorer's public surface — the canvas, and what is selected on it
 * (4.1 [graph-canvas], 4.3 [selection-and-the-panel], 4.4 [the-console]).
 *
 * This file is the border (code-shape.md §4.1). `features/boards/` mounts the
 * canvas through it, and `connect-and-model/` and `work/` reach the two things
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

export { ExplorerTypesPanel } from "@/pages/graphs-detail/features/explorer/ExplorerTypesPanel";
export { InspectorPanel } from "@/pages/graphs-detail/features/explorer/InspectorPanel";
export { RendererCapabilityBanner } from "@/pages/graphs-detail/features/explorer/RendererCapabilityBanner";

// The two CV6 cards whose subject is what is drawn — Layers and Styling
// (boards.md CV8). History and Rename describe the record, so they are
// Canvases'.
export { LayersPanel } from "@/pages/graphs-detail/features/explorer/LayersPanel";
export { StylingPanel } from "@/pages/graphs-detail/features/explorer/StylingPanel";
export type { StyleTypeInfo } from "@/pages/graphs-detail/features/explorer/StylingPanel";

export { ExpandFineTunePanel } from "@/pages/graphs-detail/features/explorer/ExpandFineTunePanel";
export { useExpandNode } from "@/pages/graphs-detail/features/explorer/useExpandNode";

// Engine adapters — PixiJS needs concrete values, not classes.
export {
	readCanvasForeground,
	readCanvasThemeConfig,
} from "@/pages/graphs-detail/features/explorer/canvasTheme";
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
