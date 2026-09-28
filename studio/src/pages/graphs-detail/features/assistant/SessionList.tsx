import { useCanvasBannerQuery } from "@/hooks/queries/useBoards";
import { formatRelativeTime } from "@/lib/time";
import { ListRow } from "@/pages/graphs-detail/shared/ListPanel";
import type { SessionSort } from "@/services/api/sessions";
import type { Session } from "@/types/session";
import { Button, ScrollArea } from "@invana/ui";
import { Archive, ArchiveRestore, MessageSquare, Pin } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// How many sessions show before the "MORE" expander kicks in.
const VISIBLE_LIMIT = 8;

export interface SessionListProps {
	sessions: Session[];
	sort: SessionSort;
	search: string;
	username?: string;
	graphSlug?: string;
	/** sessionId → boardId for sessions whose 1:1 canvas has a banner
	 *  screenshot (docs/for-developers/modules/explore/features/graph-canvas.md). Rows in this map render the preview above the title. */
	bannerCanvasIdBySession?: Map<string, string>;
	onOpen: (id: string) => void;
	/** LLM providers excluded from the list (client-side). Empty = show all. */
	excludedLLMs: ReadonlySet<string>;
	onPin: (id: string, pinned: boolean) => void;
	onArchive: (id: string, archived: boolean) => void;
}

/**
 * The Sessions panel's list view: past sessions as rail rows (docs/for-developers/modules/explore/features/boards.md's
 * `ListRow`), filtered by the header search, with the two most recent showing
 * their canvas banner (docs/for-developers/modules/explore/features/graph-canvas.md) and pin/archive revealing on hover.
 *
 * Reads bottom-up, like the thread it sits above: the newest session is the row
 * nearest the composer and history runs upwards, so the `MORE` expander — which
 * reveals *older* sessions — sits at the top of the list. The view parks at the
 * bottom, on the newest row.
 */
export function SessionList({
	sessions,
	sort,
	search,
	username,
	graphSlug,
	bannerCanvasIdBySession,
	onOpen,
	excludedLLMs,
	onPin,
	onArchive,
}: SessionListProps) {
	const [expanded, setExpanded] = useState(false);

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		return sessions.filter((s) => {
			if (q && !s.title.toLowerCase().includes(q)) return false;
			// Forward-looking: only sessions with a known, excluded provider hide.
			if (s.llmProviderId && excludedLLMs.has(s.llmProviderId)) return false;
			return true;
		});
	}, [sessions, search, excludedLLMs]);

	// `filtered` is newest-first (the API's sort), so the visible window is its
	// head and a row's index in it is its recency rank. Rendering reverses that
	// window without disturbing the rank, so "the two most recent" stays the two
	// most recent — now the bottom two rows rather than the top two.
	const shown = expanded ? filtered : filtered.slice(0, VISIBLE_LIMIT);
	const hasMore = filtered.length > VISIBLE_LIMIT;
	const rows = useMemo(
		() => shown.map((session, rank) => ({ session, rank })).reverse(),
		[shown],
	);

	// Park on the newest row: on open, and whenever the window changes (a new
	// session arrives, or MORE unfolds older ones above). Older rows grow upward
	// from a fixed bottom edge, so the newest never moves under the eye.
	const scrollRef = useRef<HTMLDivElement>(null);
	const pinnedRef = useRef(true);
	const newestId = filtered[0]?.id;
	const viewportOf = useCallback(
		() =>
			scrollRef.current?.querySelector<HTMLElement>(
				"[data-radix-scroll-area-viewport]",
			) ?? null,
		[],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: rows.length/newestId are trigger-only — the effect reads the live viewport, not either value
	useEffect(() => {
		pinnedRef.current = true;
		const viewport = viewportOf();
		if (viewport) viewport.scrollTop = viewport.scrollHeight;
	}, [rows.length, newestId, viewportOf]);

	// Banners (docs/for-developers/modules/explore/features/graph-canvas.md) resolve after the rows first lay out and grow the bottom
	// of the list by a whole thumbnail, which would shove the newest row out of
	// view. Follow that growth — but only while the user is still at the bottom;
	// scrolled up reading history, they stay where they are.
	useEffect(() => {
		const viewport = viewportOf();
		const content = viewport?.firstElementChild;
		if (!viewport || !content || typeof ResizeObserver === "undefined") return;
		const onScroll = () => {
			pinnedRef.current =
				viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <=
				80;
		};
		viewport.addEventListener("scroll", onScroll, { passive: true });
		const observer = new ResizeObserver(() => {
			if (pinnedRef.current) viewport.scrollTop = viewport.scrollHeight;
		});
		observer.observe(content);
		return () => {
			viewport.removeEventListener("scroll", onScroll);
			observer.disconnect();
		};
	}, [viewportOf]);

	return (
		<div className="flex flex-col h-full min-h-0">
			{/* Radix's viewport wraps children in a `display:table; min-width:100%`
			    div, which sizes to the widest row and defeats `truncate` (titles
			    spill past the panel edge instead of clipping). Overriding that
			    display gives the rows a real width to truncate against, so they
			    reflow as the panel is resized — and as a full-height flex column it
			    also lets a short list sit on the bottom edge (`mt-auto` below)
			    instead of stranding the newest session mid-panel with dead space
			    under it. */}
			<ScrollArea
				ref={scrollRef}
				className="flex-1 min-h-0 [&_[data-radix-scroll-area-viewport]>div]:!flex [&_[data-radix-scroll-area-viewport]>div]:!min-h-full [&_[data-radix-scroll-area-viewport]>div]:flex-col"
			>
				{filtered.length === 0 ? (
					<div className="m-auto flex flex-col items-center justify-center gap-2 text-muted-foreground px-6 py-16">
						<MessageSquare className="w-8 h-8 opacity-20" />
						<p className="text-center">
							{sessions.length === 0
								? "No sessions yet. Ask a question below to start one."
								: "No sessions match your search."}
						</p>
					</div>
				) : (
					// Grows upward off the bottom edge: short lists hug the composer,
					// long ones scroll with the newest still last.
					<div className="mt-auto flex w-full min-w-0 flex-col py-1">
						{/* Older sessions live above, so the expander that reveals them
						    heads the list rather than tailing it. */}
						{hasMore && (
							<button
								type="button"
								onClick={() => setExpanded((v) => !v)}
								className="flex items-center justify-between px-3 py-2 text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
							>
								<span>{expanded ? "Less" : "More"}</span>
								<span>{filtered.length}</span>
							</button>
						)}
						{rows.map(({ session, rank }) => (
							<SessionRow
								key={session.id}
								session={session}
								sort={sort}
								username={username}
								graphSlug={graphSlug}
								// Preview only the two most-recent rows — enough to orient the
								// eye without turning the whole list into a wall of images.
								bannerCanvasId={
									rank < 2
										? bannerCanvasIdBySession?.get(session.id)
										: undefined
								}
								onClick={() => onOpen(session.id)}
								onPin={onPin}
								onArchive={onArchive}
							/>
						))}
					</div>
				)}
			</ScrollArea>
		</div>
	);
}

/**
 * The canvas preview shown above a session row's title (docs/for-developers/modules/explore/features/graph-canvas.md). Lazily pulls
 * the (heavy) banner screenshot off the session's 1:1 canvas — the caller only
 * mounts this for rows whose canvas advertised `hasBanner`. While it loads a
 * skeleton holds the space; if it resolves empty nothing renders.
 */
function SessionBanner({
	username,
	graphSlug,
	boardId,
}: {
	username?: string;
	graphSlug?: string;
	boardId: string;
}) {
	const { data: banner, isLoading } = useCanvasBannerQuery(
		username,
		graphSlug,
		boardId,
	);

	if (isLoading) {
		return (
			<div className="mb-1.5 aspect-video max-h-50 w-full animate-pulse rounded-control bg-muted" />
		);
	}
	if (!banner) return null;

	return (
		<img
			src={banner}
			alt=""
			loading="lazy"
			className="mb-1.5 aspect-video max-h-50 w-full rounded-control border border-border object-cover"
		/>
	);
}

function SessionRow({
	session,
	sort,
	username,
	graphSlug,
	bannerCanvasId,
	onClick,
	onPin,
	onArchive,
}: {
	session: Session;
	sort: SessionSort;
	username?: string;
	graphSlug?: string;
	/** The session's 1:1 canvas id when that canvas has a banner (docs/for-developers/modules/explore/features/graph-canvas.md). */
	bannerCanvasId?: string;
	onClick: () => void;
	onPin: (id: string, pinned: boolean) => void;
	onArchive: (id: string, archived: boolean) => void;
}) {
	// List summaries carry no messages, so the status comes from the engine's
	// denormalized `lastStatus`; fall back to the last loaded message (detail
	// view / freshly-sent session) when it's present.
	const status =
		session.lastStatus ?? session.messages[session.messages.length - 1]?.status;
	const hasCounts = session.nodeCount + session.edgeCount > 0;
	// Same status vocabulary as the thread's activity rows (design-kit tokens):
	// error → destructive, running → warning (pulsing), has results → info.
	const dotClass =
		status === "error"
			? "bg-destructive"
			: status === "running"
				? "bg-warning animate-pulse motion-reduce:animate-none"
				: hasCounts
					? "bg-info"
					: "bg-muted-foreground/40";

	return (
		<ListRow
			onClick={onClick}
			// Reserve room for the action buttons only when they're visible: on
			// hover (both buttons), or always for a pinned row (the pin stays shown).
			titlePadding={`group-hover:pr-12 ${session.pinned ? "pr-8" : "pr-2"}`}
			leading={
				<span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
			}
			banner={
				bannerCanvasId ? (
					<SessionBanner
						username={username}
						graphSlug={graphSlug}
						boardId={bannerCanvasId}
					/>
				) : undefined
			}
			title={session.title || "New session"}
			subtitle={
				<>
					{hasCounts && (
						<>
							<span className="text-blue-400" title="nodes">
								{session.nodeCount}
							</span>
							<span className="text-purple-400" title="relationships">
								{session.edgeCount}
							</span>
							<span>·</span>
						</>
					)}
					{/* Show the timestamp the list is ordered by, so the visible times
					    always match the sort (otherwise a Created-sorted list shows
					    updated times and the order looks arbitrary). */}
					<span title={sort === "created" ? "Created" : "Last updated"}>
						{formatRelativeTime(
							sort === "created" ? session.createdAt : session.updatedAt,
						)}
					</span>
				</>
			}
			actions={
				<>
					{/* Pinned rows always show the (filled) pin; otherwise both actions
					    reveal on hover. Archive flips to a restore action when archived. */}
					<Button
						variant="ghost"
						size="icon"
						className={`h-6 w-6 ${
							session.pinned
								? "text-foreground"
								: "text-muted-foreground opacity-0 group-hover:opacity-100"
						}`}
						onClick={(e) => {
							e.stopPropagation();
							onPin(session.id, !session.pinned);
						}}
						title={session.pinned ? "Unpin" : "Pin"}
					>
						<Pin
							className={`w-3.5 h-3.5 ${session.pinned ? "fill-current" : ""}`}
						/>
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className="h-6 w-6 text-muted-foreground opacity-0 group-hover:opacity-100"
						onClick={(e) => {
							e.stopPropagation();
							onArchive(session.id, !session.archived);
						}}
						title={session.archived ? "Unarchive" : "Archive"}
					>
						{session.archived ? (
							<ArchiveRestore className="w-3.5 h-3.5" />
						) : (
							<Archive className="w-3.5 h-3.5" />
						)}
					</Button>
				</>
			}
		/>
	);
}
