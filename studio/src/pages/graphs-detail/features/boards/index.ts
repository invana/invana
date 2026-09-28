/**
 * Boards' public surface — the page host, and the board record behind a tab
 * (4.2 [boards]).
 *
 * This file is the border (code-shape.md §4.1). The host in `mainSection` is one
 * `BoardPagesViewPanel`, and the nine kinds in it are owned by four modules
 * (boards.md CV7) — so this folder exports the host and the `data` page body,
 * and takes the others as page kinds rather than importing them.
 */

export { boardsApi } from "@/pages/graphs-detail/features/boards/api";
export { BoardFormDialog } from "@/pages/graphs-detail/features/boards/BoardFormDialog";
export { BoardHistoryCard } from "@/pages/graphs-detail/features/boards/BoardHistoryCard";

// The two CV6 cards whose subject is the record — History and Rename
// (boards.md CV8).
export { BoardHistoryWidget } from "@/pages/graphs-detail/features/boards/BoardHistoryWidget";
export type {
	BoardKind,
	BoardKindSpec,
	BoardPageId,
	CanvasKind,
	CanvasKindSpec,
	ClickBehaviour,
	DeclaredKind,
	DeclaredKindSpec,
	OpenBoard,
} from "@/pages/graphs-detail/features/boards/boardKinds";
export {
	BOARD_KINDS,
	boardPageId,
	CANVAS_KINDS,
	clickBehaviour,
	DECLARED_KINDS,
	declaredPage,
	isDrawnPage,
	parseBoardPageId,
	specFor,
} from "@/pages/graphs-detail/features/boards/boardKinds";
export {
	captureBanner,
	STATE_THUMB_MAX_EDGE,
} from "@/pages/graphs-detail/features/boards/captureBanner";
export type {
	BoardPageHandle,
	BoardPageProps,
} from "@/pages/graphs-detail/features/boards/DataBoardPage";
export { DataBoardPage } from "@/pages/graphs-detail/features/boards/DataBoardPage";
// The wrapper the host mounts every declared page inside — the two acts, and
// the card one of them opens (boards-migration.md B21).
export { DeclaredBoard } from "@/pages/graphs-detail/features/boards/DeclaredBoard";
// A report — the act that keeps a live dashboard's numbers, and the page that
// reads one back (boards-migration.md B6).
export { FrozenBoardPage } from "@/pages/graphs-detail/features/boards/FrozenBoardPage";
export {
	useCanvasBannerQuery,
	useCreateCanvasStateMutation,
	useUpdateCanvasMutation,
} from "@/pages/graphs-detail/features/boards/queries";
export type {
	Board,
	BoardVersionCause,
	CanvasStyling,
	CaptureCanvasState,
	EdgeTypeStyle,
	NodeTypeStyle,
} from "@/pages/graphs-detail/features/boards/types";
export type { BoardSlice } from "@/pages/graphs-detail/features/boards/useBoardVersions";
export { useBoardVersions } from "@/pages/graphs-detail/features/boards/useBoardVersions";
export type { OpenCanvasTab } from "@/pages/graphs-detail/features/boards/useCanvasTabs";
// The data canvases' tabs, one per open session.
export { useCanvasTabs } from "@/pages/graphs-detail/features/boards/useCanvasTabs";
export type {
	OpenBoardFn,
	RecordBoardKind,
} from "@/pages/graphs-detail/features/boards/useOpenBoard";
// *Open this board*, published by the host for the surfaces that draw a link
// to one (rules.md RU13).
export {
	OpenBoardContext,
	useOpenBoard,
} from "@/pages/graphs-detail/features/boards/useOpenBoard";
export type {
	DeclaredBoardValue,
	Report,
} from "@/pages/graphs-detail/features/boards/useReport";
export {
	DeclaredBoardContext,
	OPEN_REPORTS_ACTION,
	SAVE_REPORT_ACTION,
	useReport,
} from "@/pages/graphs-detail/features/boards/useReport";
export { boardVersionsApi } from "@/pages/graphs-detail/features/boards/versionsApi";
