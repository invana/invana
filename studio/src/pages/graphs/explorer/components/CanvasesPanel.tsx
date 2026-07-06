import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	ScrollArea,
} from "@invana/ui";
import {
	Archive,
	ArchiveRestore,
	MoreVertical,
	PanelLeftClose,
	Pencil,
	Pin,
	PinOff,
	Plus,
	RefreshCw,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "../../../../components/ConfirmDialog";
import {
	useCanvasesQuery,
	useDeleteCanvasMutation,
	useUpdateCanvasMutation,
} from "../../../../hooks/queries/useCanvases";
import { formatRelativeTime } from "../../../../lib/time";
import type { CanvasSummary } from "../../../../types/canvas";
import { CanvasFormDialog } from "./CanvasFormDialog";

const PAGE_SIZE = 20;

interface Props {
	username: string;
	graphSlug: string;
	/** The canvas currently painted on the Explorer canvas (highlighted). */
	activeCanvasId: string | null;
	/** Hydrate the Explorer canvas from this saved canvas. */
	onOpen: (id: string) => void;
	/** Snapshot the current view into a new canvas (backed by the active session). */
	onSaveCurrent: () => void;
	/** Whether there's a session + painted graph to save. Disables "Save view". */
	canSave: boolean;
	/** True while a save is in flight. */
	isSaving: boolean;
	/** Collapse the panel, handing the freed width back to the canvas. */
	onClose: () => void;
}

/**
 * The Explorer's saved-canvases panel (RFC-043) — a native left-rail section
 * beside Sessions and Model. A paginated list of the graph's shared canvases;
 * each row opens on click, and the ⋯ menu edits (title + purpose), pins,
 * archives or deletes it. "Save view" snapshots the current canvas.
 */
export function CanvasesPanel({
	username,
	graphSlug,
	activeCanvasId,
	onOpen,
	onSaveCurrent,
	canSave,
	isSaving,
	onClose,
}: Props) {
	const [showArchived, setShowArchived] = useState(false);
	const [offset, setOffset] = useState(0);
	const [editing, setEditing] = useState<CanvasSummary | null>(null);
	const [deleting, setDeleting] = useState<CanvasSummary | null>(null);

	const { data, isLoading, isFetching, refetch } = useCanvasesQuery(
		username,
		graphSlug,
		{ limit: PAGE_SIZE, offset, includeArchived: showArchived },
	);
	const update = useUpdateCanvasMutation(username, graphSlug);
	const remove = useDeleteCanvasMutation(username, graphSlug);

	const items = data?.items ?? [];
	const total = data?.total ?? 0;

	const togglePin = (c: CanvasSummary) =>
		update.mutate({ id: c.id, data: { pinned: !c.pinned } });
	const toggleArchive = (c: CanvasSummary) =>
		update.mutate({ id: c.id, data: { archived: !c.archived } });
	const confirmDelete = async () => {
		if (!deleting) return;
		const c = deleting;
		setDeleting(null);
		try {
			await remove.mutateAsync(c.id);
		} catch {
			toast.error("Failed to delete canvas.");
		}
	};

	return (
		<div className="flex h-full flex-col">
			{/* Header */}
			<div className="flex items-center justify-between border-b px-3 py-2">
				<span className="font-medium text-sm">Canvases</span>
				<div className="flex items-center gap-1">
					<Button
						size="sm"
						variant="ghost"
						className="h-7 gap-1 px-2"
						disabled={!canSave || isSaving}
						onClick={onSaveCurrent}
						title={
							canSave
								? "Save the current view as a canvas"
								: "Run a query first to have something to save"
						}
					>
						<Plus className="h-4 w-4" />
						{isSaving ? "Saving…" : "Save view"}
					</Button>
					<Button
						size="icon"
						variant="ghost"
						className="h-7 w-7"
						onClick={() => refetch()}
						title="Refresh"
					>
						<RefreshCw
							className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
						/>
					</Button>
					<Button
						size="icon"
						variant="ghost"
						className="h-7 w-7"
						onClick={onClose}
						title="Collapse panel"
					>
						<PanelLeftClose className="h-4 w-4" />
					</Button>
				</div>
			</div>

			{/* Sub-controls */}
			<label className="flex items-center gap-2 border-b px-3 py-1.5 text-muted-foreground text-xs">
				<input
					type="checkbox"
					checked={showArchived}
					onChange={(e) => {
						setShowArchived(e.target.checked);
						setOffset(0);
					}}
				/>
				Show archived
			</label>

			{/* List */}
			<ScrollArea className="flex-1">
				{isLoading ? (
					<p className="px-3 py-6 text-center text-muted-foreground text-sm">
						Loading…
					</p>
				) : items.length === 0 ? (
					<p className="px-3 py-6 text-center text-muted-foreground text-sm">
						No canvases yet. Paint a graph, then "Save view".
					</p>
				) : (
					<ul className="divide-y">
						{items.map((c) => (
							<li key={c.id}>
								<div
									className={`group flex items-start gap-2 px-3 py-2 hover:bg-primary/5 ${
										c.id === activeCanvasId ? "bg-primary/10" : ""
									}`}
								>
									<button
										type="button"
										className="min-w-0 flex-1 text-left"
										onClick={() => onOpen(c.id)}
									>
										<div className="flex items-center gap-1.5">
											{c.pinned && (
												<Pin className="h-3 w-3 shrink-0 text-primary" />
											)}
											<span className="truncate font-medium text-sm">
												{c.title || "Untitled canvas"}
											</span>
										</div>
										{c.instructions && (
											<p className="truncate text-muted-foreground text-xs">
												{c.instructions}
											</p>
										)}
										<p className="text-muted-foreground text-xs">
											{c.archived ? "Archived · " : ""}
											{formatRelativeTime(c.updatedAt)}
										</p>
									</button>
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												size="icon"
												variant="ghost"
												className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100"
												title="Canvas actions"
											>
												<MoreVertical className="h-4 w-4" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem onClick={() => setEditing(c)}>
												<Pencil className="mr-2 h-4 w-4" /> Edit
											</DropdownMenuItem>
											<DropdownMenuItem onClick={() => togglePin(c)}>
												{c.pinned ? (
													<>
														<PinOff className="mr-2 h-4 w-4" /> Unpin
													</>
												) : (
													<>
														<Pin className="mr-2 h-4 w-4" /> Pin
													</>
												)}
											</DropdownMenuItem>
											<DropdownMenuItem onClick={() => toggleArchive(c)}>
												{c.archived ? (
													<>
														<ArchiveRestore className="mr-2 h-4 w-4" />{" "}
														Unarchive
													</>
												) : (
													<>
														<Archive className="mr-2 h-4 w-4" /> Archive
													</>
												)}
											</DropdownMenuItem>
											<DropdownMenuSeparator />
											<DropdownMenuItem
												className="text-destructive focus:text-destructive"
												onClick={() => setDeleting(c)}
											>
												<Trash2 className="mr-2 h-4 w-4" /> Delete
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</div>
							</li>
						))}
					</ul>
				)}
			</ScrollArea>

			{/* Pagination */}
			{total > PAGE_SIZE && (
				<div className="flex items-center justify-between border-t px-3 py-1.5 text-muted-foreground text-xs">
					<span>
						{offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
					</span>
					<div className="flex gap-1">
						<Button
							size="sm"
							variant="ghost"
							className="h-6 px-2"
							disabled={offset === 0}
							onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
						>
							Prev
						</Button>
						<Button
							size="sm"
							variant="ghost"
							className="h-6 px-2"
							disabled={offset + PAGE_SIZE >= total}
							onClick={() => setOffset((o) => o + PAGE_SIZE)}
						>
							Next
						</Button>
					</div>
				</div>
			)}

			<CanvasFormDialog
				open={editing !== null}
				username={username}
				graphSlug={graphSlug}
				canvas={editing}
				onClose={() => setEditing(null)}
			/>
			<ConfirmDialog
				open={deleting !== null}
				title="Delete canvas?"
				description={
					<>
						Delete "{deleting?.title || "Untitled canvas"}"? This permanently
						removes the saved view and can't be undone.
					</>
				}
				confirmLabel="Delete"
				destructive
				onConfirm={confirmDelete}
				onOpenChange={(o) => !o && setDeleting(null)}
			/>
		</div>
	);
}
