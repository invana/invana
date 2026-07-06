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
	LayoutGrid,
	MoreVertical,
	Pencil,
	Pin,
	PinOff,
	Plus,
	Save,
	Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "../../../../components/ConfirmDialog";
import {
	useCanvasesQuery,
	useDeleteCanvasMutation,
	useUpdateCanvasMutation,
} from "../../../../hooks/queries/useCanvases";
import { formatRelativeTime } from "../../../../lib/time";
import type { CanvasSort } from "../../../../services/api/canvases";
import type { CanvasSummary } from "../../../../types/canvas";
import { CanvasFormDialog } from "./CanvasFormDialog";
import { ListFilterMenu, ListPanelChrome, ListRow } from "./ListPanel";

const PAGE_SIZE = 20;

interface Props {
	username: string;
	graphSlug: string;
	/** The canvas currently painted on the Explorer canvas (highlighted). */
	activeCanvasId: string | null;
	/** Hydrate the Explorer canvas from this saved canvas. */
	onOpen: (id: string) => void;
	/** Start a fresh, empty canvas (new session + blank tab). The `+` action. */
	onNewCanvas: () => void;
	/** True while a new canvas is being created. */
	isCreating: boolean;
	/** Snapshot the current view into / over the active canvas. The save action. */
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
 * beside Sessions and Model. Shares the Sessions panel chrome ({@link
 * ListPanelChrome}): a paginated list of the graph's shared canvases, with
 * search, sort/archive filters, and per-row hover actions (edit · pin · archive
 * · delete). The header carries two distinct actions: `+` starts a fresh blank
 * canvas, and Save snapshots the current view onto the active canvas.
 */
export function CanvasesPanel({
	username,
	graphSlug,
	activeCanvasId,
	onOpen,
	onNewCanvas,
	isCreating,
	onSaveCurrent,
	canSave,
	isSaving,
	onClose,
}: Props) {
	const [sort, setSort] = useState<CanvasSort>("updated");
	const [showArchived, setShowArchived] = useState(false);
	const [offset, setOffset] = useState(0);
	const [editing, setEditing] = useState<CanvasSummary | null>(null);
	const [deleting, setDeleting] = useState<CanvasSummary | null>(null);

	const { data, isLoading, isFetching, refetch } = useCanvasesQuery(
		username,
		graphSlug,
		{ limit: PAGE_SIZE, offset, sort, includeArchived: showArchived },
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

	const resetToFirstPage = () => setOffset(0);

	return (
		<>
			<ListPanelChrome
				tab={{ value: "canvases", label: "Canvases", icon: LayoutGrid }}
				onRefresh={() => void refetch()}
				isRefreshing={isFetching}
				refreshLabel="Refresh canvases"
				searchable
				searchLabel="Search canvases"
				onClose={onClose}
				leadingActions={[
					{
						key: "new",
						name: "New canvas",
						icon: Plus,
						onClick: () => {
							if (!isCreating) onNewCanvas();
						},
					},
					{
						key: "save",
						name: canSave
							? "Save the current view to the active canvas"
							: "Run a query first to have something to save",
						icon: Save,
						iconClassName: canSave ? undefined : "opacity-40",
						onClick: () => {
							if (canSave && !isSaving) onSaveCurrent();
						},
					},
				]}
				filterMenu={
					<ListFilterMenu
						sort={sort}
						onSortChange={(s) => {
							setSort(s as CanvasSort);
							resetToFirstPage();
						}}
						showArchived={showArchived}
						onShowArchivedChange={(v) => {
							setShowArchived(v);
							resetToFirstPage();
						}}
						onReset={() => {
							setSort("updated");
							setShowArchived(false);
							resetToFirstPage();
						}}
					/>
				}
			>
				{({ search }) => (
					<CanvasList
						items={items}
						search={search}
						sort={sort}
						isLoading={isLoading}
						activeCanvasId={activeCanvasId}
						total={total}
						offset={offset}
						onOpen={onOpen}
						onEdit={setEditing}
						onDelete={setDeleting}
						onTogglePin={togglePin}
						onToggleArchive={toggleArchive}
						onPrev={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
						onNext={() => setOffset((o) => o + PAGE_SIZE)}
					/>
				)}
			</ListPanelChrome>

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
		</>
	);
}

// ── List ──────────────────────────────────────────────────────────────────────

interface CanvasListProps {
	items: CanvasSummary[];
	search: string;
	sort: CanvasSort;
	isLoading: boolean;
	activeCanvasId: string | null;
	total: number;
	offset: number;
	onOpen: (id: string) => void;
	onEdit: (c: CanvasSummary) => void;
	onDelete: (c: CanvasSummary) => void;
	onTogglePin: (c: CanvasSummary) => void;
	onToggleArchive: (c: CanvasSummary) => void;
	onPrev: () => void;
	onNext: () => void;
}

function CanvasList({
	items,
	search,
	sort,
	isLoading,
	activeCanvasId,
	total,
	offset,
	onOpen,
	onEdit,
	onDelete,
	onTogglePin,
	onToggleArchive,
	onPrev,
	onNext,
}: CanvasListProps) {
	// Client-side title filter over the current page — mirrors the Sessions list.
	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return items;
		return items.filter((c) => (c.title || "").toLowerCase().includes(q));
	}, [items, search]);

	return (
		<div className="flex h-full min-h-0 flex-col">
			{/* Radix's viewport wraps children in a `display:table` div that defeats
			    `truncate`; forcing it back to `block` gives rows a real width to
			    truncate against as the panel resizes. */}
			<ScrollArea className="flex-1 min-h-0 [&_[data-radix-scroll-area-viewport]>div]:!block">
				{isLoading ? (
					<p className="px-3 py-6 text-center text-muted-foreground text-sm">
						Loading…
					</p>
				) : filtered.length === 0 ? (
					<div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-muted-foreground">
						<LayoutGrid className="h-8 w-8 opacity-20" />
						<p className="text-center">
							{items.length === 0
								? 'No canvases yet. Paint a graph, then "Save view".'
								: "No canvases match your search."}
						</p>
					</div>
				) : (
					<div className="flex flex-col py-1">
						{filtered.map((c) => (
							<CanvasRow
								key={c.id}
								canvas={c}
								sort={sort}
								active={c.id === activeCanvasId}
								onOpen={() => onOpen(c.id)}
								onEdit={() => onEdit(c)}
								onDelete={() => onDelete(c)}
								onTogglePin={() => onTogglePin(c)}
								onToggleArchive={() => onToggleArchive(c)}
							/>
						))}
					</div>
				)}
			</ScrollArea>

			{/* Pagination — server-side, so it stays outside the client search. */}
			{total > PAGE_SIZE && (
				<div className="flex items-center justify-between border-t border-border px-3 py-1.5 text-muted-foreground text-xs">
					<span>
						{offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
					</span>
					<div className="flex gap-1">
						<Button
							size="sm"
							variant="ghost"
							className="h-6 px-2"
							disabled={offset === 0}
							onClick={onPrev}
						>
							Prev
						</Button>
						<Button
							size="sm"
							variant="ghost"
							className="h-6 px-2"
							disabled={offset + PAGE_SIZE >= total}
							onClick={onNext}
						>
							Next
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}

function CanvasRow({
	canvas: c,
	sort,
	active,
	onOpen,
	onEdit,
	onDelete,
	onTogglePin,
	onToggleArchive,
}: {
	canvas: CanvasSummary;
	sort: CanvasSort;
	active: boolean;
	onOpen: () => void;
	onEdit: () => void;
	onDelete: () => void;
	onTogglePin: () => void;
	onToggleArchive: () => void;
}) {
	return (
		<ListRow
			active={active}
			onClick={onOpen}
			// Pinned rows keep the pin shown, so reserve room for it always; the
			// full action cluster reveals on hover.
			titlePadding={
				c.pinned ? "pr-8 group-hover:pr-24" : "pr-2 group-hover:pr-24"
			}
			title={c.title || "Untitled canvas"}
			subtitle={
				<>
					{c.instructions && (
						<span className="min-w-0 truncate">{c.instructions}</span>
					)}
					<span
						className="shrink-0"
						title={sort === "created" ? "Created" : "Last updated"}
					>
						{c.archived ? "Archived · " : ""}
						{formatRelativeTime(sort === "created" ? c.createdAt : c.updatedAt)}
					</span>
				</>
			}
			actions={
				<>
					<Button
						variant="ghost"
						size="icon"
						className={`h-6 w-6 ${
							c.pinned
								? "text-foreground"
								: "text-muted-foreground opacity-0 group-hover:opacity-100"
						}`}
						onClick={(e) => {
							e.stopPropagation();
							onTogglePin();
						}}
						title={c.pinned ? "Unpin" : "Pin"}
					>
						<Pin className={`h-3.5 w-3.5 ${c.pinned ? "fill-current" : ""}`} />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className="h-6 w-6 text-muted-foreground opacity-0 group-hover:opacity-100"
						onClick={(e) => {
							e.stopPropagation();
							onToggleArchive();
						}}
						title={c.archived ? "Unarchive" : "Archive"}
					>
						{c.archived ? (
							<ArchiveRestore className="h-3.5 w-3.5" />
						) : (
							<Archive className="h-3.5 w-3.5" />
						)}
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-6 w-6 text-muted-foreground opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
								onClick={(e) => e.stopPropagation()}
								title="More actions"
							>
								<MoreVertical className="h-3.5 w-3.5" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem
								onClick={(e) => {
									e.stopPropagation();
									onEdit();
								}}
							>
								<Pencil className="mr-2 h-4 w-4" /> Edit
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={(e) => {
									e.stopPropagation();
									onTogglePin();
								}}
							>
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
							<DropdownMenuSeparator />
							<DropdownMenuItem
								className="text-destructive focus:text-destructive"
								onClick={(e) => {
									e.stopPropagation();
									onDelete();
								}}
							>
								<Trash2 className="mr-2 h-4 w-4" /> Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</>
			}
		/>
	);
}
