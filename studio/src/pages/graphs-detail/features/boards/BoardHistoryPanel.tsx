import {
	useCanvasStateBannerQuery,
	useCanvasStatesQuery,
} from "@/hooks/queries/useBoardVersions";
import { BoardHistoryCard } from "@/pages/graphs-detail/features/boards/BoardHistoryCard";
import type { BoardVersionSummary } from "@/types/board";
import { Button } from "@invana/ui";
import { Camera } from "lucide-react";

interface Props {
	open: boolean;
	onClose: () => void;
	username?: string;
	graphSlug?: string;
	boardId: string | null;
	/** Restore a state — forks it into a new canvas the caller opens. */
	onFork: (versionId: string) => void;
	/** True while a fork is in flight (disables the restore buttons). */
	isForking: boolean;
	/** Explicitly capture the current canvas as a new state. */
	onSave: () => void;
	/** True while a manual save is in flight (disables the Save button). */
	isSaving: boolean;
}

/**
 * A **drawn** board's version history (docs/for-developers/modules/explore/features/boards.md): the append-only
 * timeline of a canvas' states, newest first. Each row shows the state's banner
 * thumbnail, a label, and when it was captured, with "Open as new canvas" to
 * restore it (a non-destructive fork). Floats over the canvas like the styling /
 * fine-tune panels.
 *
 * The shell and the row are `BoardHistoryCard`, shared with a declared board's
 * `Reports` ([B21](../../../../../docs/for-developers/building-engine/boards-migration.md));
 * what belongs to *this* binding is the fetch by `board_id`, the banner, and a
 * row that forks rather than opens ([B22](../../../../../docs/for-developers/building-engine/boards-migration.md)).
 */
export function BoardHistoryPanel({
	open,
	onClose,
	username,
	graphSlug,
	boardId,
	onFork,
	isForking,
	onSave,
	isSaving,
}: Props) {
	const { data, isLoading } = useCanvasStatesQuery(
		username,
		graphSlug,
		boardId,
		open,
	);

	if (!open) return null;

	return (
		<BoardHistoryCard
			title="History"
			onClose={onClose}
			isLoading={isLoading}
			versions={data?.items ?? []}
			fallbackLabel="Board state"
			empty="No saved states yet. Run a query, expand a node, or load a result — each is captured here so you can go back to it."
			toolbar={
				<Button
					variant="outline"
					size="sm"
					className="h-8 w-full gap-1.5 text-sm"
					disabled={isSaving || !boardId}
					onClick={onSave}
				>
					<Camera className="h-3.5 w-3.5" />
					Save current state
				</Button>
			}
			thumbnail={(state) => (
				<Thumbnail
					state={state}
					username={username}
					graphSlug={graphSlug}
					boardId={boardId}
				/>
			)}
			action={(state) => ({
				label: "Open as new canvas",
				disabled: isForking,
				onClick: () => onFork(state.id),
			})}
		/>
	);
}

function Thumbnail({
	state,
	username,
	graphSlug,
	boardId,
}: {
	state: BoardVersionSummary;
	username?: string;
	graphSlug?: string;
	boardId: string | null;
}) {
	// Only fetch the (heavy) thumbnail for rows the summary says have one.
	const { data: banner, isLoading } = useCanvasStateBannerQuery(
		username,
		graphSlug,
		boardId,
		state.hasBanner ? state.id : null,
	);

	if (!state.hasBanner) return null;
	if (isLoading)
		return (
			<div className="aspect-video w-full animate-pulse rounded bg-muted" />
		);
	if (!banner) return null;
	return (
		<img
			src={banner}
			alt=""
			loading="lazy"
			className="aspect-video w-full rounded border border-border object-cover"
		/>
	);
}
