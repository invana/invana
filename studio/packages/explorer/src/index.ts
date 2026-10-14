/**
 * `@invana-studio/explorer` — Explorer's public surface: the data canvas, what
 * is selected on it, node expansion, and the canvas tabs, one per open session
 * (4.1 [graph-canvas], 4.3 [selection-and-the-panel], 4.4 [the-console]).
 *
 * This file is the border. The app mounts the canvas through it. What every
 * canvas kind shares — the backend and the type colours — is in
 * `@invana-studio/canvases`, and the type counts are in `@invana-studio/core`,
 * so the Modeller reads neither through here. Nothing outside this package
 * imports one of its files directly.
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
// What floats over the board, and the chrome around it.
export { BoardLegend } from "./chrome/BoardLegend";
export {
	type BoardOverlay,
	BoardToolbar,
	ZoomControls,
} from "./chrome/BoardToolbar";
export { EmptyBoard, ExplorerLocked } from "./chrome/ExplorerLocked";
export { RecordCard } from "./chrome/RecordCard";
export { ConnectionLine, RendererLine } from "./chrome/StatusLine";
export { ToolsSwitch } from "./chrome/ToolsSwitch";
export { useExplorerTools } from "./chrome/useExplorerTools";
export { ExpandNeighboursDialog } from "./ExpandNeighboursDialog";
export type {
	ExpandMenuHandlers,
	ExpandMenuSchema,
} from "./ExplorerCanvas";
export { ExplorerCanvas, ExplorerHeaderToolbar } from "./ExplorerCanvas";
export { ExplorerViewPanel } from "./ExplorerViewPanel";
// The product: its routes, and the slot the app fills with the page.
export { ExplorerSlotsContext, explorer } from "./product";
export type {
	ExpandRequest,
	NeighborExpandResponse,
	ScheduleQuestionArgs,
	ShareAnswerArgs,
} from "./types";
export { useCanvasExpand } from "./useCanvasExpand";
// The data canvases' tabs, one per open session.
export { useCanvasTabs } from "./useCanvasTabs";
