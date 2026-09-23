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

// A report — the act that keeps a live dashboard's numbers, and the page that
// reads one back (boards-migration.md B6).
export { FrozenBoardPage } from "@/pages/graphs-detail/features/boards/FrozenBoardPage";
export {
	DeclaredBoardContext,
	OPEN_REPORTS_ACTION,
	SAVE_REPORT_ACTION,
	useReport,
} from "@/pages/graphs-detail/features/boards/useReport";
export type {
	DeclaredBoardValue,
	Report,
} from "@/pages/graphs-detail/features/boards/useReport";

// The wrapper the host mounts every declared page inside — the two acts, and
// the card one of them opens (boards-migration.md B21).
export { DeclaredBoard } from "@/pages/graphs-detail/features/boards/DeclaredBoard";
export { BoardHistoryCard } from "@/pages/graphs-detail/features/boards/BoardHistoryCard";

// *Open this board*, published by the host for the surfaces that draw a link
// to one (rules.md RU13).
export {
	OpenBoardContext,
	useOpenBoard,
} from "@/pages/graphs-detail/features/boards/useOpenBoard";
export type {
	OpenBoardFn,
	RecordBoardKind,
} from "@/pages/graphs-detail/features/boards/useOpenBoard";
