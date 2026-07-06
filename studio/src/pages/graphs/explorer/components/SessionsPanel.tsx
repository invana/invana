import {
	Button,
	DropdownMenuCheckboxItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	ScrollArea,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@invana/ui";
import {
	Archive,
	ArchiveRestore,
	Check,
	ChevronRight,
	Code,
	Copy,
	Info,
	MessageSquare,
	Pencil,
	Pin,
	RotateCw,
	ThumbsDown,
	ThumbsUp,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import type {
	Session,
	SessionContextTurn,
	SessionMessage,
} from "../../../../types/session";
import { ListFilterMenu, ListPanelChrome, ListRow } from "./ListPanel";
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
	/** Fetch the conversation context the model was given for an assistant reply
	 *  (RFC-036/040) — lazily, when its disclosure is opened. */
	onFetchContext: (messageId: string) => Promise<SessionContextTurn[]>;
	/** Record (or clear) a 👍/👎 vote on a reply (RFC-038/039). */
	onSetFeedback: (messageId: string, value: "up" | "down" | null) => void;
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
	/** RFC-031 — which surface this panel serves. "modeller" turns the composer
	 *  NL-only and surfaces the Commit affordance. Defaults to "explorer". */
	surface?: "explorer" | "modeller";
	/** RFC-031 — commit (Publish) the bound model's draft. Shown only on a
	 *  modeller surface, inside an open session. */
	onCommit?: () => void;
	/** Whether the bound draft has something to publish (gates the Commit button). */
	canCommit?: boolean;
	/** True while a commit (activate) is in flight. */
	isCommitting?: boolean;
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
	onFetchContext,
	onSetFeedback,
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
	surface = "explorer",
	onCommit,
	canCommit,
	isCommitting,
}: SessionsPanelProps) {
	const isModeller = surface === "modeller";
	// Bumped to focus the composer when the user picks "let me type instead" on a
	// clarification (RFC-038).
	const [composerFocus, setComposerFocus] = useState(0);
	// LLM providers excluded from the list (client-side). Empty = show all.
	// Sessions don't record their provider yet, so this filters nothing today —
	// it's wired ahead of NL queries landing (see Session.llmProviderId).
	const [excludedLLMs, setExcludedLLMs] = useState<ReadonlySet<string>>(
		() => new Set(),
	);

	const inDetail = activeSession !== null;

	// When inside a thread, the tab header becomes a breadcrumb: "Sessions" (click
	// to return to the list — the tab *is* the back affordance, so there's no
	// separate back button) › the open session's title, ellipsized. On the list
	// it's just "Sessions" (RFC-045).
	const tabLabel =
		inDetail && activeSession ? (
			<span className="flex min-w-0 items-center gap-1">
				{/* biome-ignore lint/a11y/useSemanticElements: a native <button> can't nest inside the Radix TabsTrigger <button> hosting this label. */}
				<span
					role="button"
					tabIndex={0}
					className="shrink-0 hover:underline"
					onPointerDown={(e) => e.stopPropagation()}
					onClick={(e) => {
						e.stopPropagation();
						onBack();
					}}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.stopPropagation();
							onBack();
						}
					}}
				>
					Sessions
				</span>
				<ChevronRight className="h-3 w-3 shrink-0 opacity-60" />
				<span
					className="min-w-0 truncate"
					title={activeSession.title || "New session"}
				>
					{activeSession.title || "New session"}
				</span>
			</span>
		) : (
			"Sessions"
		);

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

	// Clicking a clarification option sends it as the next NL ask (RFC-038): it
	// re-translates with the clarification now in context and runs. Reuses the
	// session's resolved nl config (provider/timeout), like the composer would.
	const handleSelectOption = (text: string) => {
		const providerId =
			composerConfig?.mode === "nl" ? composerConfig.llmProviderId : undefined;
		const llmProviderId = providerId ?? llmProviders[0]?.id;
		if (!llmProviderId) return;
		onRun({
			mode: "nl",
			query: text,
			llmProviderId,
			attachments: [],
			timeoutS: composerConfig?.timeoutS ?? 120,
		});
	};

	// "Let me type instead" on a clarification — focus the composer so the user
	// answers in their own words (RFC-038).
	const handleTypeInstead = () => setComposerFocus((n) => n + 1);

	// 👍/👎 a reply (RFC-038/039). A downvote also kicks off a refinement: it
	// sends a follow-up NL turn so the model asks what to change (with options),
	// re-translating with this reply now in context. Clearing a vote doesn't.
	const handleVote = (messageId: string, value: "up" | "down" | null) => {
		onSetFeedback(messageId, value);
		if (value === "down") {
			handleSelectOption(
				"That's not what I'm looking for. What can I change to get it right? Offer a few options.",
			);
		}
	};

	// Modeller: a Commit bar above the composer publishes the bound draft —
	// identical to the Modeller's Publish, in the session's context (RFC-031 D7).
	const commitBar =
		isModeller && inDetail && onCommit ? (
			<div className="shrink-0 border-t border-border px-3 py-2 flex items-center justify-between gap-2">
				<span className="text-xs text-muted-foreground">
					Generated into the model's draft — Commit to publish.
				</span>
				<Button
					size="sm"
					className="h-7"
					onClick={onCommit}
					disabled={!canCommit || isCommitting}
				>
					<Check className="w-3 h-3 mr-1" />
					{isCommitting ? "Publishing…" : "Commit"}
				</Button>
			</div>
		) : null;

	const footer = (
		<>
			{commitBar}
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
				focusSignal={composerFocus}
				surface={surface}
			/>
		</>
	);

	return (
		<ListPanelChrome
			tab={{ value: "sessions", label: tabLabel, icon: MessageSquare }}
			onRefresh={onRefresh}
			isRefreshing={isRefreshing}
			refreshLabel="Refresh sessions"
			searchable
			searchLabel="Search sessions"
			onClose={onClose}
			// Search + filter only apply on the list, not inside a thread.
			listControls={!inDetail}
			filterMenu={
				<ListFilterMenu
					sort={sort}
					onSortChange={(s) => onSortChange(s as SessionSort)}
					showArchived={showArchived}
					onShowArchivedChange={onShowArchivedChange}
					onReset={resetFilters}
				>
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
									onCheckedChange={() => toggleLLM(p.id)}
									onSelect={(e) => e.preventDefault()}
								>
									{p.model_id || p.provider}
								</DropdownMenuCheckboxItem>
							))}
						</>
					)}
				</ListFilterMenu>
			}
			footer={footer}
		>
			{({ search }) =>
				activeSession ? (
					<SessionThread
						session={activeSession}
						onRerun={onRerun}
						onFetchContext={onFetchContext}
						onSelectOption={handleSelectOption}
						onTypeInstead={handleTypeInstead}
						onVote={handleVote}
						results={results}
						onLoadToCanvas={onLoadToCanvas}
					/>
				) : (
					<SessionList
						sessions={sessions}
						sort={sort}
						search={search}
						onOpen={onOpenSession}
						excludedLLMs={excludedLLMs}
						onPin={onPin}
						onArchive={onArchive}
					/>
				)
			}
		</ListPanelChrome>
	);
}

// ── List view ─────────────────────────────────────────────────────────────────

interface SessionListProps {
	sessions: Session[];
	sort: SessionSort;
	search: string;
	onOpen: (id: string) => void;
	excludedLLMs: ReadonlySet<string>;
	onPin: (id: string, pinned: boolean) => void;
	onArchive: (id: string, archived: boolean) => void;
}

function SessionList({
	sessions,
	sort,
	search,
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

	return (
		<ListRow
			onClick={onClick}
			// Reserve room for the action buttons only when they're visible: on
			// hover (both buttons), or always for a pinned row (the pin stays shown).
			titlePadding={`group-hover:pr-12 ${session.pinned ? "pr-8" : "pr-2"}`}
			leading={
				<span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
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

// ── Detail view ─────────────────────────────────────────────────────────────

interface SessionThreadProps {
	session: Session;
	onRerun: (messageId: string) => void;
	onFetchContext: (messageId: string) => Promise<SessionContextTurn[]>;
	onSelectOption: (text: string) => void;
	onTypeInstead: () => void;
	onVote: (messageId: string, value: "up" | "down" | null) => void;
	results: Record<string, QueryResponse | null>;
	onLoadToCanvas: (result: QueryResponse) => void;
}

function SessionThread({
	session,
	onRerun,
	onFetchContext,
	onSelectOption,
	onTypeInstead,
	onVote,
	results,
	onLoadToCanvas,
}: SessionThreadProps) {
	// Auto-scroll to the latest message: on open (session change) and whenever a
	// message or its result is added/updated (new ask, running→done, result paint).
	const endRef = useRef<HTMLDivElement>(null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-scroll on any thread change, not just endRef
	useEffect(() => {
		endRef.current?.scrollIntoView({ block: "end" });
	}, [session.id, session.messages, results]);

	return (
		<div className="flex flex-col h-full min-h-0">
			{/* The session title lives in the panel's tab header (a breadcrumb back to
			    the list), so no back+title row here (RFC-045). */}

			<ScrollArea className="flex-1 min-h-0">
				<div className="flex flex-col gap-4 p-3">
					{session.messages.map((message, idx) => {
						if (message.role === "user") {
							return <UserMessage key={message.id} message={message} />;
						}
						// The assistant reply's own question is the preceding user
						// message — shown in the context disclosure as "this question".
						const prev = idx > 0 ? session.messages[idx - 1] : undefined;
						return (
							<AssistantMessage
								key={message.id}
								message={message}
								prompt={prev?.role === "user" ? prev.content : undefined}
								onRerun={onRerun}
								onFetchContext={onFetchContext}
								onSelectOption={onSelectOption}
								onTypeInstead={onTypeInstead}
								onVote={onVote}
								result={results[message.id]}
								onLoadToCanvas={onLoadToCanvas}
							/>
						);
					})}
					{/* Scroll anchor — kept in view so the thread sticks to the latest. */}
					<div ref={endRef} />
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
	prompt,
	onRerun,
	onFetchContext,
	onSelectOption,
	onTypeInstead,
	onVote,
	result,
	onLoadToCanvas,
}: {
	message: SessionMessage;
	/** This reply's own question (the preceding user prompt) — shown in the
	 *  context disclosure so the full exchange the model saw is self-contained. */
	prompt?: string;
	onRerun: (messageId: string) => void;
	onFetchContext: (messageId: string) => Promise<SessionContextTurn[]>;
	onSelectOption: (text: string) => void;
	onTypeInstead: () => void;
	onVote: (messageId: string, value: "up" | "down" | null) => void;
	result: QueryResponse | null | undefined;
	onLoadToCanvas: (result: QueryResponse) => void;
}) {
	const [showQuery, setShowQuery] = useState(false);
	// Conversation context (RFC-036/040), fetched lazily the first time the
	// disclosure is opened. `null` = not yet fetched.
	const [showContext, setShowContext] = useState(false);
	const [context, setContext] = useState<SessionContextTurn[] | null>(null);
	const [contextLoading, setContextLoading] = useState(false);

	// Context applies only to NL replies (ql turns send none). The icon is shown
	// for every nl reply; the disclosure resolves to "first turn" when empty.
	const hasContext = message.mode === "nl";

	const toggleContext = async () => {
		const next = !showContext;
		setShowContext(next);
		if (next && context === null && !contextLoading) {
			setContextLoading(true);
			try {
				setContext(await onFetchContext(message.id));
			} catch {
				toast.error("Couldn't load the context for this reply.");
				setShowContext(false);
			} finally {
				setContextLoading(false);
			}
		}
	};

	const copy = () => {
		navigator.clipboard?.writeText(message.content);
		toast.success("Copied to clipboard");
	};

	// Copy the disclosed context as readable text — handy for debugging / issues.
	const copyContext = () => {
		const parts = (context ?? []).map((t) =>
			t.query
				? `Asked: ${t.prompt}\nQuery: ${t.query}${
						t.rationale ? `\nWhy: ${t.rationale}` : ""
					}`
				: `Asked: ${t.prompt}\nClarified: ${t.question}`,
		);
		if (prompt) parts.push(`This question: ${prompt}`);
		navigator.clipboard?.writeText(parts.join("\n\n"));
		toast.success("Context copied to clipboard");
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
			{/* Clarification options (RFC-038): pick one instead of retyping — it's
			    sent as the next NL ask, which re-translates with this clarification
			    in context and runs. */}
			{message.clarificationOptions &&
				message.clarificationOptions.length > 0 && (
					<div className="flex flex-col items-start gap-1.5 py-1">
						{message.clarificationOptions.map((option, i) => (
							<Button
								key={`${message.id}-opt-${i}`}
								variant="outline"
								size="sm"
								className="h-auto max-w-full whitespace-normal break-words px-3 py-1.5 text-left font-normal"
								onClick={() => onSelectOption(option)}
							>
								{option}
							</Button>
						))}
						<Button
							variant="outline"
							size="sm"
							className="h-auto max-w-full gap-1.5 border-dashed px-3 py-1.5 text-left font-normal text-muted-foreground"
							onClick={onTypeInstead}
						>
							<Pencil className="w-3 h-3 shrink-0" />
							Something else — let me type
						</Button>
					</div>
				)}
			{/* Actions on their own row, meta on the next line — keeping them on one
			    row let a long meta string (model · rows · LLM · query) wrap around
			    the icons and read as crowded. Glyphs are small; the buttons are
			    wider than the glyph so each icon gets horizontal breathing room. */}
			<div className="flex flex-col gap-1 text-muted-foreground">
				<TooltipProvider delayDuration={300}>
					<div className="flex items-center justify-between gap-1">
						<div className="flex items-center gap-1">
							{message.sourceQuery && (
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="icon"
											className="h-6 w-7"
											onClick={() => onRerun(message.id)}
											aria-label="Re-run query"
										>
											<RotateCw className="w-3 h-3" />
										</Button>
									</TooltipTrigger>
									<TooltipContent>Re-run query</TooltipContent>
								</Tooltip>
							)}
							{message.sourceQuery && (
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="icon"
											className="h-6 w-7"
											onClick={() => setShowQuery((v) => !v)}
											aria-label={showQuery ? "Hide query" : "View query"}
										>
											<Code className="w-3 h-3" />
										</Button>
									</TooltipTrigger>
									<TooltipContent>
										{showQuery ? "Hide query" : "View query"}
									</TooltipContent>
								</Tooltip>
							)}
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className="h-6 w-7"
										onClick={copy}
										aria-label="Copy"
									>
										<Copy className="w-3 h-3" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>Copy</TooltipContent>
							</Tooltip>
							{hasContext && (
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="icon"
											className="h-6 w-7"
											onClick={toggleContext}
											aria-label={showContext ? "Hide context" : "View context"}
										>
											<Info className="w-3 h-3" />
										</Button>
									</TooltipTrigger>
									<TooltipContent>
										{showContext ? "Hide context" : "View context"}
									</TooltipContent>
								</Tooltip>
							)}
							{/* 👍/👎 on a real answer (RFC-038/039). A downvote asks the model
					    what to change; clicking the active vote clears it. */}
						</div>
						{message.sourceQuery && (
							<div className="flex items-center gap-1">
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="icon"
											className={`h-6 w-7 ${message.feedback === "up" ? "text-green-500 hover:text-green-500" : ""}`}
											onClick={() =>
												onVote(
													message.id,
													message.feedback === "up" ? null : "up",
												)
											}
											aria-label="Good answer"
										>
											<ThumbsUp className="w-3 h-3" />
										</Button>
									</TooltipTrigger>
									<TooltipContent>Good answer</TooltipContent>
								</Tooltip>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="icon"
											className={`h-6 w-7 ${message.feedback === "down" ? "text-red-500 hover:text-red-500" : ""}`}
											onClick={() =>
												onVote(
													message.id,
													message.feedback === "down" ? null : "down",
												)
											}
											aria-label="Not what I wanted — refine"
										>
											<ThumbsDown className="w-3 h-3" />
										</Button>
									</TooltipTrigger>
									<TooltipContent>Not what I wanted — refine</TooltipContent>
								</Tooltip>
							</div>
						)}
					</div>
				</TooltipProvider>
				{meta && <span>{meta}</span>}
			</div>
			{showQuery && message.sourceQuery && (
				<pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words rounded border border-border bg-muted/50 p-2 font-mono text-muted-foreground">
					{message.sourceQuery}
				</pre>
			)}
			{showContext && (
				<div className="mt-1 rounded border border-border bg-muted/40 p-2.5 text-muted-foreground">
					{contextLoading ? (
						<span className="text-xs">Loading context…</span>
					) : (
						<>
							<div className="mb-2 flex items-center justify-between gap-2">
								<span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
									{context && context.length > 0
										? `What the model saw · ${context.length} earlier turn${
												context.length === 1 ? "" : "s"
											} + this question`
										: "What the model saw · this question only (no earlier turns)"}
								</span>
								<Button
									variant="ghost"
									size="icon"
									className="h-5 w-5 shrink-0"
									onClick={copyContext}
									title="Copy context"
								>
									<Copy className="w-3 h-3" />
								</Button>
							</div>
							<div className="flex flex-col gap-3">
								{context?.map((turn, i) => (
									<div
										key={`${message.id}-ctx-${i}`}
										className="flex flex-col gap-1.5 border-t border-border/60 pt-3 first:border-t-0 first:pt-0"
									>
										<div className="flex flex-col gap-0.5">
											<span className="text-[10px] uppercase tracking-wide text-muted-foreground/60">
												Asked
											</span>
											<p className="whitespace-pre-wrap break-words text-foreground/90">
												{turn.prompt}
											</p>
										</div>
										{turn.query ? (
											<div className="flex flex-col gap-0.5">
												<span className="text-[10px] uppercase tracking-wide text-muted-foreground/60">
													Query
												</span>
												<pre className="overflow-x-auto whitespace-pre-wrap break-words rounded bg-background/70 px-2 py-1.5 font-mono text-[12px] leading-relaxed text-foreground/80">
													{turn.query}
												</pre>
											</div>
										) : (
											<div className="flex flex-col gap-0.5">
												<span className="text-[10px] uppercase tracking-wide text-muted-foreground/60">
													Clarified
												</span>
												<p className="whitespace-pre-wrap break-words text-foreground/80">
													{turn.question}
												</p>
											</div>
										)}
										{turn.rationale && (
											<p className="whitespace-pre-wrap break-words text-[12px] italic leading-relaxed text-muted-foreground/80">
												{turn.rationale}
											</p>
										)}
									</div>
								))}
								{prompt && (
									<div
										className={`flex flex-col gap-0.5 ${
											context && context.length > 0
												? "border-t border-border/60 pt-3"
												: ""
										}`}
									>
										<span className="text-[10px] font-medium uppercase tracking-wide text-foreground/70">
											This question
										</span>
										<p className="whitespace-pre-wrap break-words text-foreground/90">
											{prompt}
										</p>
									</div>
								)}
							</div>
						</>
					)}
				</div>
			)}
			<ResultBlock result={result} onLoadToCanvas={onLoadToCanvas} />
		</div>
	);
}
