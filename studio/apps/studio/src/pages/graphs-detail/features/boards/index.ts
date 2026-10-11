/**
 * Boards' public surface — the page host and the page bodies (4.2 [boards]).
 *
 * This file is the border (code-shape.md §4.1). The host in `mainSection` is one
 * `Workbook`, and the nine kinds in it are owned by four modules
 * (boards.md) — so this folder exports the host and the `data` page body,
 * and takes the others as page kinds rather than importing them. The board
 * record, its kinds, versions and reports live in `@invana-studio/shell`.
 */

export type { BoardPageHandle } from "@/pages/graphs-detail/features/boards/DataBoardPage";
export { DataBoardPage } from "@/pages/graphs-detail/features/boards/DataBoardPage";
// The wrapper the host mounts every declared page inside — the two acts, and
// the card one of them opens (boards-migration.md).
export { DeclaredBoard } from "@/pages/graphs-detail/features/boards/DeclaredBoard";
// A report — the act that keeps a live board's numbers, and the page that
// reads one back (boards-migration.md).
export { FrozenBoardPage } from "@/pages/graphs-detail/features/boards/FrozenBoardPage";
export type { RecordBoardKind } from "@/pages/graphs-detail/features/boards/useOpenBoard";
// *Open this board*, published by the host for the surfaces that draw a link
// to one (rules.md).
export {
	OpenBoardContext,
	useOpenBoard,
} from "@/pages/graphs-detail/features/boards/useOpenBoard";
