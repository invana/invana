import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Skeleton,
} from "@invana/ui";
import {
	ChevronLeft,
	ChevronRight,
	Folder,
	FolderPlus,
	MoreHorizontal,
	Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
	useDeleteGraphMutation,
	useGraphsQuery,
} from "../../hooks/queries/useGraphs";
import type { Graph } from "../../types/graphs";

const PAGE_SIZE = 6;

function formatRelative(iso: string): string {
	const then = new Date(iso).getTime();
	const now = Date.now();
	const diff = Math.max(0, now - then);
	const minutes = Math.floor(diff / 60_000);
	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days}d ago`;
	return new Date(iso).toLocaleDateString();
}

function setupProgress(graph: Graph): { done: number; total: number } {
	const sections = [
		"graph_info",
		"instructions",
		"skills",
		"datasets",
	] as const;
	const done = sections.filter((s) => {
		const entry = graph.setup_state?.[s];
		return !!entry?.completed_at || !!entry?.skipped_at;
	}).length;
	return { done, total: sections.length };
}

function GraphRow({
	graph,
	onOpen,
	onDelete,
}: {
	graph: Graph;
	onOpen: () => void;
	onDelete: () => void;
}) {
	const { done, total } = setupProgress(graph);
	const setupDone = done === total;
	return (
		<div className="flex items-center gap-3 py-1.5 group">
			<div
				className={`w-1.5 h-1.5 rounded-full shrink-0 ${
					setupDone ? "bg-green-500" : "bg-muted-foreground/40"
				}`}
			/>
			<button
				type="button"
				onClick={onOpen}
				className="flex-1 flex items-center gap-2 text-left min-w-0"
			>
				<Folder className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
				<span className="font-medium shrink-0 group-hover:text-primary group-hover:underline underline-offset-4 transition-colors">
					{graph.name}
				</span>
				{/* <span className="text-muted-foreground truncate font-mono">
          /u/{graph.owner_username}/{graph.slug}
          {graph.instructions ? ` — ${graph.instructions}` : ""}
        </span> */}
			</button>
			{/* <span className="text-muted-foreground/60 shrink-0 tabular-nums">
        {done}/{total} setup
      </span> */}
			{/* <span className="text-muted-foreground/60 shrink-0 tabular-nums">
        {graph.member_count} {graph.member_count === 1 ? "member" : "members"}
      </span> */}
			<div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon" className="h-6 w-6">
							<MoreHorizontal className="h-3.5 w-3.5" />
							<span className="sr-only">Actions</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={onOpen}>Open</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							className="text-destructive focus:text-destructive"
							onClick={onDelete}
						>
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}

export function GraphsListPage() {
	const navigate = useNavigate();
	const { data, isLoading, isError, error } = useGraphsQuery();
	const deleteMutation = useDeleteGraphMutation();
	const [deleteTarget, setDeleteTarget] = useState<Graph | null>(null);
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);

	const allGraphs = data?.items ?? [];

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return allGraphs;
		return allGraphs.filter(
			(g) =>
				g.name.toLowerCase().includes(q) ||
				g.slug.toLowerCase().includes(q) ||
				g.owner_username.toLowerCase().includes(q) ||
				(g.instructions ?? "").toLowerCase().includes(q),
		);
	}, [allGraphs, search]);

	const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
	const safePage = Math.min(page, totalPages);
	const paginatedGraphs = filtered.slice(
		(safePage - 1) * PAGE_SIZE,
		safePage * PAGE_SIZE,
	);

	const handleSearch = (val: string) => {
		setSearch(val);
		setPage(1);
	};

	const openGraph = (graph: Graph) => {
		navigate(`/u/${graph.owner_username}/${graph.slug}`);
	};

	const handleDelete = () => {
		if (!deleteTarget) return;
		deleteMutation.mutate(
			{
				username: deleteTarget.owner_username,
				graphSlug: deleteTarget.slug,
			},
			{
				onSuccess: () => {
					toast.success(`"${deleteTarget.name}" deleted`);
					setDeleteTarget(null);
				},
				onError: (err) => {
					toast.error(err.message);
					setDeleteTarget(null);
				},
			},
		);
	};

	return (
		<div className="h-full overflow-auto">
			<div className="max-w-4xl mx-auto px-10 py-16">
				{/* Title block */}
				<div className="mb-14 select-none">
					<h1 className="text-5xl font-black tracking-tight">Invana Studio</h1>
					<p className="text-muted-foreground mt-2 text-xl">
						Graph Intelligence Platform
					</p>
				</div>

				{/* Two-column layout */}
				<div className="grid grid-cols-[300px_1fr] gap-16">
					{/* ── Left column: Create + Recent ── */}
					<div className="flex flex-col gap-8">
						<div>
							<p className="font-semibold uppercase tracking-widest text-muted-foreground mb-4 text-base">
								Create
							</p>
							<button
								type="button"
								onClick={() => navigate("/graphs/new")}
								className="flex items-center gap-2.5 py-1.5 text-left text-foreground hover:text-primary transition-colors group"
							>
								<FolderPlus className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
								<span>New Graph</span>
							</button>
						</div>

						<div>
							<p className="font-semibold uppercase tracking-widest text-muted-foreground mb-4 text-base">
								Recent
							</p>
							{isLoading && (
								<div className="flex flex-col gap-2">
									{["s1", "s2"].map((k) => (
										<Skeleton key={k} className="h-5 w-full" />
									))}
								</div>
							)}
							{!isLoading && allGraphs.length === 0 && (
								<p className="text-muted-foreground">None yet</p>
							)}
							{!isLoading &&
								allGraphs.slice(0, 5).map((graph) => (
									<button
										key={graph.id}
										type="button"
										onClick={() => openGraph(graph)}
										className="flex items-center gap-2 py-1 w-full text-left group"
									>
										<Folder className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
										<span className="font-medium truncate group-hover:text-primary group-hover:underline underline-offset-4 transition-colors">
											{graph.name}
										</span>
									</button>
								))}
						</div>
					</div>

					{/* ── Right column: Graphs ── */}
					<div>
						<div className="flex items-center justify-between mb-4">
							<p className="font-semibold uppercase tracking-widest text-muted-foreground text-base">
								Graphs
							</p>
							{!isLoading && allGraphs.length > 0 && (
								<span className="text-muted-foreground/60 tabular-nums">
									{filtered.length} / {allGraphs.length}
								</span>
							)}
						</div>

						{!isLoading && allGraphs.length > 0 && (
							<div className="relative mb-4">
								<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
								<input
									type="text"
									placeholder="Search by name, slug, owner or intent…"
									value={search}
									onChange={(e) => handleSearch(e.target.value)}
									className="w-full bg-muted/50 border border-border rounded-md pl-8 pr-3 py-1.5 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
								/>
							</div>
						)}

						{isLoading && (
							<div className="flex flex-col gap-3">
								{["s1", "s2", "s3", "s4"].map((k) => (
									<Skeleton key={k} className="h-7 w-full" />
								))}
							</div>
						)}

						{isError && (
							<p className="text-destructive">
								{error instanceof Error
									? error.message
									: "Failed to load graphs"}
							</p>
						)}

						{!isLoading && !isError && allGraphs.length === 0 && (
							<p className="text-muted-foreground">
								No graphs yet — create one to get started.
							</p>
						)}

						{!isLoading &&
							!isError &&
							filtered.length === 0 &&
							allGraphs.length > 0 && (
								<p className="text-muted-foreground">
									No results for &ldquo;{search}&rdquo;
								</p>
							)}

						{!isLoading && !isError && paginatedGraphs.length > 0 && (
							<>
								<div className="flex flex-col">
									{paginatedGraphs.map((graph) => (
										<GraphRow
											key={graph.id}
											graph={graph}
											onOpen={() => openGraph(graph)}
											onDelete={() => setDeleteTarget(graph)}
										/>
									))}
								</div>

								{totalPages > 1 && (
									<div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
										<span className="text-muted-foreground/60">
											Page {safePage} of {totalPages}
										</span>
										<div className="flex items-center gap-1">
											<Button
												variant="ghost"
												size="icon"
												className="h-7 w-7"
												disabled={safePage === 1}
												onClick={() => setPage((p) => Math.max(1, p - 1))}
											>
												<ChevronLeft className="h-4 w-4" />
											</Button>
											{Array.from({ length: totalPages }, (_, i) => i + 1).map(
												(p) => (
													<button
														key={p}
														type="button"
														onClick={() => setPage(p)}
														className={`h-7 w-7 rounded text-center transition-colors ${
															p === safePage
																? "bg-primary text-primary-foreground font-medium"
																: "hover:bg-accent text-muted-foreground hover:text-foreground"
														}`}
													>
														{p}
													</button>
												),
											)}
											<Button
												variant="ghost"
												size="icon"
												className="h-7 w-7"
												disabled={safePage === totalPages}
												onClick={() =>
													setPage((p) => Math.min(totalPages, p + 1))
												}
											>
												<ChevronRight className="h-4 w-4" />
											</Button>
										</div>
									</div>
								)}
							</>
						)}
					</div>
				</div>
			</div>

			{/* Delete confirmation dialog */}
			<Dialog
				open={!!deleteTarget}
				onOpenChange={(open) => !open && setDeleteTarget(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							Delete &ldquo;{deleteTarget?.name}&rdquo;?
						</DialogTitle>
						<DialogDescription>
							This removes the Graph, its connection record, members, and
							invitations. The underlying graph database is not affected. Last
							updated{" "}
							{deleteTarget ? formatRelative(deleteTarget.updated_at) : ""}.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setDeleteTarget(null)}
							disabled={deleteMutation.isPending}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleDelete}
							disabled={deleteMutation.isPending}
						>
							{deleteMutation.isPending ? "Deleting…" : "Delete"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
