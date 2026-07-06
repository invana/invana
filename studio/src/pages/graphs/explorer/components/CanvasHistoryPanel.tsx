import { Button, ScrollArea } from "@invana/ui";
import { History, X } from "lucide-react";
import {
	useCanvasStateBannerQuery,
	useCanvasStatesQuery,
} from "../../../../hooks/queries/useCanvasStates";
import { formatRelativeTime } from "../../../../lib/time";
import type { CanvasStateSummary } from "../../../../types/canvas";

interface Props {
	open: boolean;
	onClose: () => void;
	username?: string;
	graphSlug?: string;
	canvasId: string | null;
	/** Restore a state — forks it into a new canvas the caller opens. */
	onFork: (stateId: string) => void;
	/** True while a fork is in flight (disables the restore buttons). */
	isForking: boolean;
}

/**
 * Canvas version history (RFC-047): the append-only timeline of a canvas'
 * states, newest first. Each row shows the state's banner thumbnail, a label,
 * and when it was captured, with "Open as new canvas" to restore it (a
 * non-destructive fork). Floats over the canvas like the styling / fine-tune
 * panels.
 */
export function CanvasHistoryPanel({
	open,
	onClose,
	username,
	graphSlug,
	canvasId,
	onFork,
	isForking,
}: Props) {
	const { data, isLoading } = useCanvasStatesQuery(
		username,
		graphSlug,
		canvasId,
		open,
	);

	if (!open) return null;

	const states = data?.items ?? [];

	return (
		<div className="absolute right-3 top-3 z-20 flex max-h-[calc(100%-1.5rem)] w-80 flex-col rounded-lg border border-border bg-background shadow-lg">
			<div className="flex items-center justify-between border-b border-border px-3 py-2">
				<span className="flex items-center gap-1.5 font-medium text-sm">
					<History className="h-4 w-4" />
					History
				</span>
				<Button
					variant="ghost"
					size="icon"
					className="h-6 w-6"
					onClick={onClose}
				>
					<X className="h-4 w-4" />
				</Button>
			</div>
			<ScrollArea className="min-h-0 flex-1">
				<div className="space-y-2 p-3">
					{isLoading && (
						<p className="text-center text-muted-foreground text-sm">
							Loading…
						</p>
					)}
					{!isLoading && states.length === 0 && (
						<p className="text-center text-muted-foreground text-sm">
							No saved states yet. Run a query, expand a node, or load a result
							— each is captured here so you can go back to it.
						</p>
					)}
					{states.map((s) => (
						<HistoryRow
							key={s.id}
							state={s}
							username={username}
							graphSlug={graphSlug}
							canvasId={canvasId}
							onFork={() => onFork(s.id)}
							isForking={isForking}
						/>
					))}
				</div>
			</ScrollArea>
		</div>
	);
}

function HistoryRow({
	state,
	username,
	graphSlug,
	canvasId,
	onFork,
	isForking,
}: {
	state: CanvasStateSummary;
	username?: string;
	graphSlug?: string;
	canvasId: string | null;
	onFork: () => void;
	isForking: boolean;
}) {
	// Only fetch the (heavy) thumbnail for rows the summary says have one.
	const { data: banner, isLoading } = useCanvasStateBannerQuery(
		username,
		graphSlug,
		canvasId,
		state.hasBanner ? state.id : null,
	);

	return (
		<div className="space-y-1.5 rounded border border-border p-2">
			{state.hasBanner &&
				(isLoading ? (
					<div className="aspect-video w-full animate-pulse rounded bg-muted" />
				) : banner ? (
					<img
						src={banner}
						alt=""
						loading="lazy"
						className="aspect-video w-full rounded border border-border object-cover"
					/>
				) : null)}
			<div className="flex items-center justify-between gap-2">
				<span className="min-w-0 truncate text-sm" title={state.label}>
					{state.label || "Canvas state"}
				</span>
				<span className="shrink-0 text-muted-foreground text-xs">
					{formatRelativeTime(state.createdAt)}
				</span>
			</div>
			<Button
				variant="outline"
				size="sm"
				className="h-7 w-full text-xs"
				disabled={isForking}
				onClick={onFork}
			>
				Open as new canvas
			</Button>
		</div>
	);
}
