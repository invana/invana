/**
 * The history card — one shell and one row shape, two bindings
 * ([B21](../../../../../docs/for-developers/building-engine/boards-migration.md)).
 *
 * A drawn board's versions and a declared board's reports are the same
 * reading — *what was kept of this board, newest first* — and they are
 * addressed differently: `boardVersions` by `board_id`, `boardReports` by a
 * `(kind, subject_id)` pair, because a live dashboard has no row until the
 * first report creates one ([B18](../../../../../docs/for-developers/building-engine/boards-migration.md)).
 * So the fetch and the act belong to the binding and everything a reader sees
 * belongs here.
 *
 * The row's act differs too, and deliberately: a canvas' version **forks**
 * into a new board, because the one you are standing on is what you would
 * otherwise overwrite; a report **opens**, because the live dashboard is
 * always there and there is nothing to fork into ([B22](../../../../../docs/for-developers/building-engine/boards-migration.md)).
 */

import { formatRelativeTime } from "@/lib/time";
import type { BoardVersionSummary } from "@/types/board";
import { Button, ScrollArea } from "@invana/ui";
import { History, X } from "lucide-react";
import type { ReactNode } from "react";

/** What the row's one button does — the half that is not shared. */
export interface BoardHistoryAction {
	label: string;
	onClick: () => void;
	disabled?: boolean;
}

export interface BoardHistoryCardProps {
	/** `History` on a canvas, `Reports` on a dashboard. */
	title: string;
	onClose: () => void;
	isLoading: boolean;
	versions: BoardVersionSummary[];
	/** Said when nothing was ever kept — the binding's own words. */
	empty: string;
	/**
	 * Above the list. A canvas puts `Save current state` here; a dashboard puts
	 * nothing, because `Save report` is on its own header (B21).
	 */
	toolbar?: ReactNode;
	/** A row's thumbnail, for the binding that has one. */
	thumbnail?: (version: BoardVersionSummary) => ReactNode;
	action: (version: BoardVersionSummary) => BoardHistoryAction;
	/** What a row without a label is called. */
	fallbackLabel: string;
}

export function BoardHistoryCard({
	title,
	onClose,
	isLoading,
	versions,
	empty,
	toolbar,
	thumbnail,
	action,
	fallbackLabel,
}: BoardHistoryCardProps) {
	return (
		<div className="absolute right-3 top-3 z-20 flex max-h-[calc(100%-1.5rem)] w-80 flex-col rounded-lg border border-border bg-background shadow-lg">
			<div className="flex items-center justify-between border-b border-border px-3 py-2">
				<span className="flex items-center gap-1.5 font-medium text-base">
					<History className="h-4 w-4" />
					{title}
				</span>
				<Button
					variant="ghost"
					size="icon"
					className="h-6 w-6"
					aria-label={`Close ${title}`}
					onClick={onClose}
				>
					<X className="h-4 w-4" />
				</Button>
			</div>
			{toolbar ? (
				<div className="border-b border-border p-2">{toolbar}</div>
			) : null}
			<ScrollArea className="min-h-0 flex-1">
				<div className="space-y-2 p-3">
					{isLoading && (
						<p className="text-center text-muted-foreground text-base">
							Loading…
						</p>
					)}
					{!isLoading && versions.length === 0 && (
						<p className="text-center text-muted-foreground text-base">
							{empty}
						</p>
					)}
					{versions.map((version) => {
						const act = action(version);
						return (
							<div
								key={version.id}
								className="space-y-1.5 rounded border border-border p-2"
							>
								{thumbnail?.(version)}
								<div className="flex items-center justify-between gap-2">
									<span
										className="min-w-0 truncate text-base"
										title={version.label}
									>
										{version.label || fallbackLabel}
									</span>
									<span
										className="shrink-0 text-muted-foreground text-sm"
										title={version.createdAt.toLocaleString()}
									>
										{formatRelativeTime(version.createdAt)}
									</span>
								</div>
								<Button
									variant="outline"
									size="sm"
									className="h-7 w-full text-sm"
									disabled={act.disabled}
									onClick={act.onClick}
								>
									{act.label}
								</Button>
							</div>
						);
					})}
				</div>
			</ScrollArea>
		</div>
	);
}
