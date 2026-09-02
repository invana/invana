import { Button, ScrollArea } from "@invana/ui";
import { Archive, ArchiveRestore, MessageSquare, Pin } from "lucide-react";
import { useMemo, useState } from "react";
import { useCanvasBannerQuery } from "../../../../hooks/queries/useCanvases";
import { formatRelativeTime } from "../../../../lib/time";
import type { SessionSort } from "../../../../services/api/sessions";
import type { Session } from "../../../../types/session";
import { ListRow } from "./ListPanel";

// How many sessions show before the "MORE" expander kicks in.
const VISIBLE_LIMIT = 8;

export interface SessionListProps {
	sessions: Session[];
	sort: SessionSort;
	search: string;
	username?: string;
	graphSlug?: string;
	/** sessionId → canvasId for sessions whose 1:1 canvas has a banner
	 *  screenshot (RFC-045). Rows in this map render the preview above the title. */
	bannerCanvasIdBySession?: Map<string, string>;
	onOpen: (id: string) => void;
	/** LLM providers excluded from the list (client-side). Empty = show all. */
	excludedLLMs: ReadonlySet<string>;
	onPin: (id: string, pinned: boolean) => void;
	onArchive: (id: string, archived: boolean) => void;
}

/**
 * The Sessions panel's list view: past sessions as rail rows (RFC-043's
 * `ListRow`), filtered by the header search, with the two most recent showing
 * their canvas banner (RFC-045) and pin/archive revealing on hover.
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

	const shown = expanded ? filtered : filtered.slice(0, VISIBLE_LIMIT);
	const hasMore = filtered.length > VISIBLE_LIMIT;

	return (
		<div className="flex flex-col h-full min-h-0">
			{/* Radix's viewport wraps children in a `display:table; min-width:100%`
			    div, which sizes to the widest row and defeats `truncate` (titles
			    spill past the panel edge instead of clipping). Forcing the wrapper
			    back to `block` gives the rows a real width to truncate against, so
			    they reflow as the panel is resized. */}
			<ScrollArea className="flex-1 min-h-0 [&_[data-radix-scroll-area-viewport]>div]:!block">
				{filtered.length === 0 ? (
					<div className="flex flex-col items-center justify-center gap-2 text-muted-foreground px-6 py-16">
						<MessageSquare className="w-8 h-8 opacity-20" />
						<p className="text-center">
							{sessions.length === 0
								? "No sessions yet. Ask a question below to start one."
								: "No sessions match your search."}
						</p>
					</div>
				) : (
					<div className="flex flex-col py-1">
						{shown.map((session, i) => (
							<SessionRow
								key={session.id}
								session={session}
								sort={sort}
								username={username}
								graphSlug={graphSlug}
								// Preview only the two most-recent rows — enough to orient the
								// eye without turning the whole list into a wall of images.
								bannerCanvasId={
									i < 2 ? bannerCanvasIdBySession?.get(session.id) : undefined
								}
								onClick={() => onOpen(session.id)}
								onPin={onPin}
								onArchive={onArchive}
							/>
						))}
						{hasMore && (
							<button
								type="button"
								onClick={() => setExpanded((v) => !v)}
								className="flex items-center justify-between px-4 py-2 text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
							>
								<span>{expanded ? "Less" : "More"}</span>
								<span>{filtered.length}</span>
							</button>
						)}
					</div>
				)}
			</ScrollArea>
		</div>
	);
}

/**
 * The canvas preview shown above a session row's title (RFC-045). Lazily pulls
 * the (heavy) banner screenshot off the session's 1:1 canvas — the caller only
 * mounts this for rows whose canvas advertised `hasBanner`. While it loads a
 * skeleton holds the space; if it resolves empty nothing renders.
 */
function SessionBanner({
	username,
	graphSlug,
	canvasId,
}: {
	username?: string;
	graphSlug?: string;
	canvasId: string;
}) {
	const { data: banner, isLoading } = useCanvasBannerQuery(
		username,
		graphSlug,
		canvasId,
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
	/** The session's 1:1 canvas id when that canvas has a banner (RFC-045). */
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
						canvasId={bannerCanvasId}
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
