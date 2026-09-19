/**
 * Boards' public surface — the page host, and the board record behind a tab
 * (4.2 [boards]).
 *
 * This file is the border (code-shape.md §4.1). The host in `mainSection` is one
 * `BoardPagesViewPanel`, and the nine kinds in it are owned by four modules
 * (boards.md CV7) — so this folder exports the host and the `data` page body,
 * and takes the others as page kinds rather than importing them.
 */

export { DataBoardPage } from "@/pages/graphs-detail/features/boards/DataBoardPage";
export type {
	BoardPageHandle,
	BoardPageProps,
} from "@/pages/graphs-detail/features/boards/DataBoardPage";

export { BoardFormDialog } from "@/pages/graphs-detail/features/boards/BoardFormDialog";

// The two CV6 cards whose subject is the record — History and Rename
// (boards.md CV8).
export { BoardHistoryPanel } from "@/pages/graphs-detail/features/boards/BoardHistoryPanel";

export { useBoardVersions } from "@/pages/graphs-detail/features/boards/useBoardVersions";
export type { BoardSlice } from "@/pages/graphs-detail/features/boards/useBoardVersions";

export {
	STATE_THUMB_MAX_EDGE,
	captureBanner,
} from "@/pages/graphs-detail/features/boards/captureBanner";

export {
	BOARD_KINDS,
	CANVAS_KINDS,
	DECLARED_KINDS,
	boardPageId,
	clickBehaviour,
	declaredPage,
	isDrawnPage,
	parseBoardPageId,
	specFor,
} from "@/pages/graphs-detail/features/boards/boardKinds";
export type {
	BoardKind,
	BoardKindSpec,
	BoardPageId,
	CanvasKind,
	CanvasKindSpec,
	ClickBehaviour,
	DeclaredKind,
	DeclaredKindSpec,
} from "@/pages/graphs-detail/features/boards/boardKinds";
