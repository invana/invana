import {
	Button,
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	ScrollArea,
	SearchInput,
	TabbedPanel,
} from "@invana/ui";
import {
	Archive,
	ArchiveRestore,
	ArrowLeft,
	Code,
	Copy,
	MessageSquare,
	PanelLeftClose,
	Pin,
	RefreshCw,
	RotateCw,
	Search,
	SlidersHorizontal,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { formatDuration, formatRelativeTime } from "../../../../lib/time";
import type { SessionSort } from "../../../../services/api/sessions";
import type { QueryLanguage } from "../../../../types/graphs";
import type { LLMProvider } from "../../../../types/llm";
import type {
	QueryMode,
	QueryResponse,
	QueryRunPayload,
} from "../../../../types/query";
import type { Session, SessionMessage } from "../../../../types/session";
import { ResultBlock } from "./ResultBlock";
import { SessionComposer } from "./SessionComposer";

// How many sessions show before the "MORE" expander kicks in.
const VISIBLE_LIMIT = 8;

export interface SessionsPanelProps {
	// Composer
	availableLanguages: readonly QueryLanguage[];
	defaultLanguage: QueryLanguage;
	llmProviders: readonly LLMProvider[];
	onRun: (payload: QueryRunPayload) => void;
	/** Cancel the in-flight run (composer stop control). */
	onStop: () => void;
	isRunning: boolean;
	// Sessions
	sessions: Session[];
	activeSession: Session | null;
	onOpenSession: (id: string) => void;
	onBack: () => void;
	/** Re-run a past assistant message's query in place (re-fetches its result). */
	onRerun: (messageId: string) => void;
	/** Transient per-message query results, keyed by assistant message id (RFC-033). */
	results: Record<string, QueryResponse | null>;
	/** Project a graph result onto the canvas. */
	onLoadToCanvas: (result: QueryResponse) => void;
	/** Refetch sessions from the engine (header refresh control). */
	onRefresh: () => void;
	/** True while a refetch is in flight — spins the refresh icon. */
	isRefreshing: boolean;
	/** Collapse the panel, handing the freed width back to the canvas. */
	onClose: () => void;
	/** List ordering (server-side); pinned always float to the top. */
	sort: SessionSort;
	onSortChange: (sort: SessionSort) => void;
	/** Whether archived sessions are included in the list (server-side). */
	showArchived: boolean;
	onShowArchivedChange: (show: boolean) => void;
	/** Toggle a session's pinned flag. */
	onPin: (id: string, pinned: boolean) => void;
	/** Toggle a session's archived flag. */
	onArchive: (id: string, archived: boolean) => void;
}

// ── Panel ─────────────────────────────────────────────────────────────────────
// Two views in one TabbedPanel: a list of past sessions, and the threaded
// detail of the active one. The composer is pinned to the footer in both, so
// asking from the list opens a fresh session and drops you into its thread.

export function SessionsPanel({
	availableLanguages,
	defaultLanguage,
	llmProviders,
	onRun,
	onStop,
	isRunning,
	sessions,
	activeSession,
	onOpenSession,
	onBack,
	onRerun,
	results,
	onLoadToCanvas,
	onRefresh,
	isRefreshing,
	onClose,
	sort,
	onSortChange,
	showArchived,
	onShowArchivedChange,
	onPin,
	onArchive,
}: SessionsPanelProps) {
	const [searchOpen, setSearchOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [filterOpen, setFilterOpen] = useState(false);
	// LLM providers excluded from the list (client-side). Empty = show all.
	// Sessions don't record their provider yet, so this filters nothing today —
	// it's wired ahead of NL queries landing (see Session.llmProviderId).
	const [excludedLLMs, setExcludedLLMs] = useState<ReadonlySet<string>>(
		() => new Set(),
	);

	const inDetail = activeSession !== null;

	const toggleLLM = (id: string) => {
		setExcludedLLMs((prev) => {
			const next = new Set(prev);
			next.has(id) ? next.delete(id) : next.add(id);
			return next;
		});
	};

	const resetFilters = () => {
		onSortChange("updated");
		onShowArchivedChange(false);
		setExcludedLLMs(new Set());
	};

	const body = inDetail ? (
		<SessionThread
			session={activeSession}
			onBack={onBack}
			onRerun={onRerun}
			results={results}
			onLoadToCanvas={onLoadToCanvas}
		/>
	) : (
		<SessionList
			sessions={sessions}
			sort={sort}
			search={searchOpen ? search : ""}
			searchOpen={searchOpen}
			onSearchChange={setSearch}
			onOpen={onOpenSession}
			excludedLLMs={excludedLLMs}
			onPin={onPin}
			onArchive={onArchive}
		/>
	);

	// Restore the open session's mode + model from its last assistant reply. The
	// engine persists `mode` ("nl" | "ql") per message, so we read it directly —
	// robust even when that reply errored or was a rerun. Older rows predate the
	// field, so we fall back to inferring from `via` ("<provider> · <model>" for
	// NL per RFC-030, "Cypher"/"Gremlin" for QL). Null until messages load / on
	// the list — then the composer keeps the user's current selection.
	const composerConfig = useMemo(() => {
		if (!activeSession) return null;
		const last = [...activeSession.messages]
			.reverse()
			.find((m) => m.role === "assistant" && (m.mode || m.via));
		if (!last) return null;
		// Provider resolves off `via` ("<provider> · <model>") when present.
		const provider = last.via?.includes(" · ")
			? llmProviders.find((p) => `${p.provider} · ${p.model_id}` === last.via)
			: undefined;
		const mode: QueryMode =
			last.mode ?? (last.via?.includes(" · ") ? "nl" : "ql");
		if (mode === "nl") {
			return {
				mode,
				language: last.language,
				llmProviderId: provider?.id,
				timeoutS: last.timeoutS,
			};
		}
		return {
			mode,
			language:
				last.language ??
				(last.via ? (last.via.toLowerCase() as QueryLanguage) : undefined),
			timeoutS: last.timeoutS,
		};
	}, [activeSession, llmProviders]);

	// The open session's user prompts, newest first — walked by the composer's
	// ↑/↓ history (most recent first).
	const promptHistory = useMemo(
		() =>
			activeSession
				? activeSession.messages
						.filter((m) => m.role === "user")
						.map((m) => m.content)
						.reverse()
				: [],
		[activeSession],
	);

	const composer = (
		<SessionComposer
			availableLanguages={availableLanguages}
			defaultLanguage={defaultLanguage}
			llmProviders={llmProviders}
			onRun={onRun}
			onStop={onStop}
			isRunning={isRunning}
			sessionKey={activeSession?.id ?? null}
			initialConfig={composerConfig}
			promptHistory={promptHistory}
		/>
	);

	// Refresh + collapse are always available; search and filter only make sense
	// on the list, so they sit between them when we're not inside a session.
	const rightNavItems = [
		{
			key: "refresh",
			name: "Refresh sessions",
			icon: RefreshCw,
			iconClassName: isRefreshing ? "animate-spin" : undefined,
			onClick: onRefresh,
		},
	];
	if (!inDetail) {
		rightNavItems.push(
			{
				key: "search",
				name: "Search sessions",
				icon: Search,
				iconClassName: undefined,
				onClick: () => {
					setSearchOpen((v) => !v);
					setSearch("");
				},
			},
			{
				key: "filter",
				name: "Sort & filter",
				icon: SlidersHorizontal,
				iconClassName: undefined,
				onClick: () => setFilterOpen((v) => !v),
			},
		);
	}
	rightNavItems.push({
		key: "close",
		name: "Collapse panel",
		icon: PanelLeftClose,
		iconClassName: undefined,
		onClick: onClose,
	});
	const headerActions = { rightNavItems };

	// The composer lives inside the tab content (not TabbedPanel's
	// `footerContent`): the panel sizes its body to `calc(100% - header)` and
	// stacks the footer below that, so a footer would overflow the panel. As a
	// bottom-pinned flex child the body scrolls above and the composer stays put.
	const content = (
		<div className="relative flex flex-col h-full min-h-0">
			{/* The panel header API only renders icon buttons, so the filter
			    funnel toggles this controlled menu anchored to an invisible corner
			    element — the menu floats just under the header's funnel icon. */}
			<DropdownMenu open={filterOpen} onOpenChange={setFilterOpen}>
				<DropdownMenuTrigger asChild>
					<span
						aria-hidden
						className="pointer-events-none absolute right-2 top-0 h-0 w-0"
					/>
				</DropdownMenuTrigger>
				<SessionFilterMenu
					sort={sort}
					onSortChange={onSortChange}
					showArchived={showArchived}
					onShowArchivedChange={onShowArchivedChange}
					llmProviders={llmProviders}
					excludedLLMs={excludedLLMs}
					onToggleLLM={toggleLLM}
					onReset={resetFilters}
				/>
			</DropdownMenu>
			<div className="flex-1 min-h-0">{body}</div>
			<div className="shrink-0">{composer}</div>
		</div>
	);

	return (
		<TabbedPanel
			defaultTab="sessions"
			tabs={[
				{
					value: "sessions",
					label: "Sessions",
					icon: MessageSquare,
					content,
				},
			]}
			headerActions={headerActions}
		/>
	);
}

// ── Filter menu ─────────────────────────────────────────────────────────────

const llmLabel = (p: LLMProvider) => p.model_id || p.provider;

interface SessionFilterMenuProps {
	sort: SessionSort;
	onSortChange: (sort: SessionSort) => void;
	showArchived: boolean;
	onShowArchivedChange: (show: boolean) => void;
	llmProviders: readonly LLMProvider[];
	excludedLLMs: ReadonlySet<string>;
	onToggleLLM: (id: string) => void;
	onReset: () => void;
}

/** Sort + filter dropdown (the header funnel). Items keep the menu open on
 *  select so several filters can be adjusted in one pass. */
function SessionFilterMenu({
	sort,
	onSortChange,
	showArchived,
	onShowArchivedChange,
	llmProviders,
	excludedLLMs,
	onToggleLLM,
	onReset,
}: SessionFilterMenuProps) {
	const keepOpen = (e: Event) => e.preventDefault();
	return (
		<DropdownMenuContent align="end" sideOffset={8} className="w-52">
			<DropdownMenuRadioGroup
				value={sort}
				onValueChange={(v) => onSortChange(v as SessionSort)}
			>
				<DropdownMenuRadioItem value="created" onSelect={keepOpen}>
					Sort by Created
				</DropdownMenuRadioItem>
				<DropdownMenuRadioItem value="updated" onSelect={keepOpen}>
					Sort by Updated
				</DropdownMenuRadioItem>
			</DropdownMenuRadioGroup>

			{llmProviders.length > 0 && (
				<>
					<DropdownMenuSeparator />
					<DropdownMenuLabel className="text-muted-foreground">
						LLM
					</DropdownMenuLabel>
					{llmProviders.map((p) => (
						<DropdownMenuCheckboxItem
							key={p.id}
							checked={!excludedLLMs.has(p.id)}
							onCheckedChange={() => onToggleLLM(p.id)}
							onSelect={keepOpen}
						>
							{llmLabel(p)}
						</DropdownMenuCheckboxItem>
					))}
				</>
			)}

			<DropdownMenuSeparator />
			<DropdownMenuCheckboxItem
				checked={showArchived}
				onCheckedChange={onShowArchivedChange}
				onSelect={keepOpen}
			>
				Show archived
			</DropdownMenuCheckboxItem>

			<DropdownMenuSeparator />
			<DropdownMenuItem onSelect={onReset}>Reset</DropdownMenuItem>
		</DropdownMenuContent>
	);
}

// ── List view ─────────────────────────────────────────────────────────────────

interface SessionListProps {
	sessions: Session[];
	sort: SessionSort;
	search: string;
	searchOpen: boolean;
	onSearchChange: (value: string) => void;
	onOpen: (id: string) => void;
	excludedLLMs: ReadonlySet<string>;
	onPin: (id: string, pinned: boolean) => void;
	onArchive: (id: string, archived: boolean) => void;
}

function SessionList({
	sessions,
	sort,
	search,
	searchOpen,
	onSearchChange,
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
			{searchOpen && (
				<div className="p-2 border-b border-border shrink-0">
					<SearchInput value={search} onChange={onSearchChange} />
				</div>
			)}
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
						{shown.map((session) => (
							<SessionRow
								key={session.id}
								session={session}
								sort={sort}
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

function SessionRow({
	session,
	sort,
	onClick,
	onPin,
	onArchive,
}: {
	session: Session;
	sort: SessionSort;
	onClick: () => void;
	onPin: (id: string, pinned: boolean) => void;
	onArchive: (id: string, archived: boolean) => void;
}) {
	// List summaries carry no messages, so the status comes from the engine's
	// denormalized `lastStatus`; fall back to the last loaded message (detail
	// view / freshly-sent session) when it's present.
	const status =
		session.lastStatus ?? session.messages[session.messages.length - 1]?.status;
	const dotClass =
		status === "error"
			? "bg-destructive"
			: status === "running"
				? "bg-amber-400 animate-pulse"
				: session.nodeCount + session.edgeCount > 0
					? "bg-blue-400"
					: "bg-muted-foreground/40";

	const hasCounts = session.nodeCount + session.edgeCount > 0;

	// The main click target is a real <button>; the pin/archive actions are
	// absolutely-positioned siblings (not nested) so the markup stays valid.
	return (
		<div className="group relative flex items-stretch hover:bg-accent transition-colors">
			<button
				type="button"
				onClick={onClick}
				className="flex flex-1 min-w-0 items-start gap-2.5 text-left px-4 py-2"
			>
				<span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
				<span className="min-w-0 flex-1">
					{/* Reserve room for the action buttons only when they're visible:
					    on hover (both buttons), or always for a pinned row (the pin
					    stays shown). Otherwise the title uses the full width. */}
					<span
						className={`block text-foreground truncate group-hover:pr-12 ${
							session.pinned ? "pr-8" : "pr-2"
						}`}
					>
						{session.title}
					</span>
					<span className="flex items-center gap-1.5 text-sm text-muted-foreground">
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
						{/* Show the timestamp the list is ordered by, so the visible
					    times always match the sort (otherwise a Created-sorted list
					    shows updated times and the order looks arbitrary). */}
						<span title={sort === "created" ? "Created" : "Last updated"}>
							{formatRelativeTime(
								sort === "created" ? session.createdAt : session.updatedAt,
							)}
						</span>
					</span>
				</span>
			</button>

			{/* Pinned rows always show the (filled) pin; otherwise both actions
			    reveal on hover. Archive flips to a restore action when archived. */}
			<div className="absolute right-2 top-1.5 flex items-center gap-0.5">
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
					{session.pinned ? (
						<Pin className="w-3.5 h-3.5 fill-current" />
					) : (
						<Pin className="w-3.5 h-3.5" />
					)}
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
			</div>
		</div>
	);
}

// ── Detail view ─────────────────────────────────────────────────────────────

interface SessionThreadProps {
	session: Session;
	onBack: () => void;
	onRerun: (messageId: string) => void;
	results: Record<string, QueryResponse | null>;
	onLoadToCanvas: (result: QueryResponse) => void;
}

function SessionThread({
	session,
	onBack,
	onRerun,
	results,
	onLoadToCanvas,
}: SessionThreadProps) {
	return (
		<div className="flex flex-col h-full min-h-0">
			{/* Back + title bar — the panel header keeps the persistent "Sessions"
			    tab; this row identifies the session you're inside. */}
			<div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
				<Button
					variant="ghost"
					size="icon"
					className="h-6 w-6 shrink-0"
					onClick={onBack}
					title="Back to sessions"
				>
					<ArrowLeft className="w-4 h-4" />
				</Button>
				<span className="uppercase tracking-wide font-medium text-foreground truncate">
					{session.title}
				</span>
			</div>

			<ScrollArea className="flex-1 min-h-0">
				<div className="flex flex-col gap-4 p-3">
					{session.messages.map((message) =>
						message.role === "user" ? (
							<UserMessage key={message.id} message={message} />
						) : (
							<AssistantMessage
								key={message.id}
								message={message}
								onRerun={onRerun}
								result={results[message.id]}
								onLoadToCanvas={onLoadToCanvas}
							/>
						),
					)}
				</div>
			</ScrollArea>
		</div>
	);
}

function UserMessage({ message }: { message: SessionMessage }) {
	return (
		<div className="flex justify-end">
			<div className="max-w-[85%] rounded-2xl rounded-br-sm bg-secondary px-3 py-2 text-secondary-foreground whitespace-pre-wrap break-words">
				{message.content}
			</div>
		</div>
	);
}

/** Three bouncing dots — the "query is running" affordance in the thread. */
function RunningDots() {
	return (
		<span className="inline-flex items-center gap-0.5" aria-label="Running">
			<span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
			<span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
			<span className="w-1 h-1 rounded-full bg-current animate-bounce" />
		</span>
	);
}

function AssistantMessage({
	message,
	onRerun,
	result,
	onLoadToCanvas,
}: {
	message: SessionMessage;
	onRerun: (messageId: string) => void;
	result: QueryResponse | null | undefined;
	onLoadToCanvas: (result: QueryResponse) => void;
}) {
	const [showQuery, setShowQuery] = useState(false);

	const copy = () => {
		navigator.clipboard?.writeText(message.content);
		toast.success("Copied to clipboard");
	};

	if (message.status === "running") {
		return (
			<div className="flex items-center gap-2 text-muted-foreground">
				<span>{message.content}</span>
				<RunningDots />
			</div>
		);
	}

	// User-aborted run (client-only status) — keep the prompt above, note the stop.
	if (message.status === "stopped") {
		return <p className="text-muted-foreground italic">{message.content}</p>;
	}

	// LLM time only exists for NL turns; when present, label both times so it's
	// clear which step dominated. QL turns show the bare query time.
	const hasLlm = message.llmTimeMs != null;
	const meta = [
		message.via,
		message.rowCount != null
			? `${message.rowCount} row${message.rowCount === 1 ? "" : "s"}`
			: null,
		hasLlm ? `LLM ${formatDuration(message.llmTimeMs as number)}` : null,
		message.executionTimeMs != null
			? `${hasLlm ? "query " : ""}${formatDuration(message.executionTimeMs)}`
			: null,
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<div className="flex flex-col gap-1">
			<p
				className={`whitespace-pre-wrap break-words ${
					message.status === "error" ? "text-destructive" : "text-foreground"
				}`}
			>
				{message.content}
			</p>
			{/* Actions on their own row, meta on the next line — keeping them on one
			    row let a long meta string (model · rows · LLM · query) wrap around
			    the icons and read as crowded. Glyphs are small; the buttons are
			    wider than the glyph so each icon gets horizontal breathing room. */}
			<div className="flex flex-col gap-1 text-muted-foreground">
				<div className="flex items-center gap-1">
					{message.sourceQuery && (
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-7"
							onClick={() => onRerun(message.id)}
							title="Re-run query"
						>
							<RotateCw className="w-3 h-3" />
						</Button>
					)}
					{message.sourceQuery && (
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-7"
							onClick={() => setShowQuery((v) => !v)}
							title={showQuery ? "Hide query" : "View query"}
						>
							<Code className="w-3 h-3" />
						</Button>
					)}
					<Button
						variant="ghost"
						size="icon"
						className="h-6 w-7"
						onClick={copy}
						title="Copy"
					>
						<Copy className="w-3 h-3" />
					</Button>
				</div>
				{meta && <span>{meta}</span>}
			</div>
			{showQuery && message.sourceQuery && (
				<pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words rounded border border-border bg-muted/50 p-2 font-mono text-muted-foreground">
					{message.sourceQuery}
				</pre>
			)}
			<ResultBlock result={result} onLoadToCanvas={onLoadToCanvas} />
		</div>
	);
}
