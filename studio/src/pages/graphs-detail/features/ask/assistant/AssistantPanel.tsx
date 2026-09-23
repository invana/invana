import { formatCompactCount } from "@/lib/format";
import {
	SessionComposer,
	deriveComposerConfig,
} from "@/pages/graphs-detail/features/ask/assistant/SessionComposer";
import type { AssistantAttachment } from "@/pages/graphs-detail/features/ask/assistant/SessionComposer";
import { SessionLegendDialog } from "@/pages/graphs-detail/features/ask/assistant/SessionLegendDialog";
import { SessionList } from "@/pages/graphs-detail/features/ask/assistant/SessionList";
import {
	SessionTasksView,
	stepsFor,
} from "@/pages/graphs-detail/features/ask/assistant/SessionTasksView";
import { SessionThread } from "@/pages/graphs-detail/features/ask/assistant/SessionThread";
import {
	ListFilterMenu,
	ListPanelChrome,
} from "@/pages/graphs-detail/shared/ListPanel";
import type { SessionSort } from "@/services/api/sessions";
import { useRunStore } from "@/stores/run.store";
import type { QueryLanguage } from "@/types/graphs";
import type { LLMProvider } from "@/types/llm";
import type { QueryResponse, QueryRunPayload } from "@/types/query";
import type { RunView } from "@/types/run";
import type {
	Session,
	SessionContextTurn,
	SessionMessage,
} from "@/types/session";
import {
	Button,
	ChatSessionStatusBar,
	ChatSessionTaskRow,
	DropdownMenuCheckboxItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
} from "@invana/ui";
import {
	Check,
	ChevronRight,
	HelpCircle,
	MessageSquare,
	X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export interface AssistantPanelProps {
	// Composer
	availableLanguages: readonly QueryLanguage[];
	defaultLanguage: QueryLanguage;
	llmProviders: readonly LLMProvider[];
	onRun: (payload: QueryRunPayload) => void;
	/** Cancel the in-flight run (composer stop control, `esc`). */
	onStop: () => void;
	isRunning: boolean;
	// Sessions
	sessions: Session[];
	activeSession: Session | null;
	/** Owning graph coordinates — let bannered rows lazy-fetch their canvas
	 *  preview (docs/for-developers/modules/explore/features/graph-canvas.md). Undefined until the route params resolve. */
	username?: string;
	graphSlug?: string;
	/** sessionId → boardId for sessions whose 1:1 canvas has a banner
	 *  screenshot (docs/for-developers/modules/explore/features/graph-canvas.md). Rows in this map render the preview above the title. */
	bannerCanvasIdBySession?: Map<string, string>;
	onOpenSession: (id: string) => void;
	onBack: () => void;
	/** Re-run a past assistant message's query in place (a new run). */
	onRerun: (messageId: string) => void;
	/** Fetch the conversation context the model was given for an assistant reply
	 *  (docs/for-developers/modules/ask/spec.md · docs/for-developers/modules/ask/features/reasoning-trace.md) — lazily, when its disclosure is opened. */
	onFetchContext: (messageId: string) => Promise<SessionContextTurn[]>;
	/** Record (or clear) a 👍/👎 vote on a reply (docs/for-developers/modules/ask/features/clarifying-questions.md · docs/for-developers/modules/workflows/features/promote-a-plan.md). */
	onSetFeedback: (messageId: string, value: "up" | "down" | null) => void;
	/** Transient per-message query results, keyed by assistant message id (docs/for-developers/modules/ask/features/the-answer-surface.md). */
	results: Record<string, QueryResponse | null>;
	/** Project a graph result onto the canvas (logs a `load` turn, docs/for-developers/modules/explore/features/boards.md). The
	 *  message is the reply the result belongs to — its query is what was loaded. */
	onLoadToCanvas: (result: QueryResponse, message: SessionMessage) => void;
	/** Refetch sessions from the engine (header refresh control). */
	onRefresh: () => void;
	/** True while a refetch is in flight — spins the refresh icon. */
	isRefreshing: boolean;
	/** Close the assistant. Its sessions live on the RIGHT and nowhere else
	 *  (AD1/AD6), so this closes the region — it never touches the left rail. */
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
	/** docs/for-developers/modules/ask/spec.md — which surface this panel serves. "modeller" turns the composer
	 *  NL-only and surfaces the Commit affordance. Defaults to "explorer". */
	surface?: "explorer" | "modeller";
	/** docs/for-developers/modules/ask/spec.md — commit (Publish) the bound model's draft. Shown only on a
	 *  modeller surface, inside an open session. */
	onCommit?: () => void;
	/** Whether the bound draft has something to publish (gates the Commit button). */
	canCommit?: boolean;
	/** True while a commit (activate) is in flight. */
	isCommitting?: boolean;
	/** What the ask is about — drawn as a chip above the composer's input
	 *  (the-assistant.md AD2/AD10). Null when nothing is attached. */
	attachment?: AssistantAttachment | null;
	/** Take the attachment off; the next ask goes without it. */
	onRemoveAttachment?: () => void;
}

// ── Panel ─────────────────────────────────────────────────────────────────────
// Two views in one rail panel (docs/for-developers/modules/platform/features/design-system.md · docs/for-developers/modules/ask/features/streaming-and-the-workflow.md): the list of past sessions, and the
// console transcript of the open one — with a Tasks view (every step of every
// reply) reachable from the status bar. The composer, the pinned strip of what
// is running and the status bar are the footer in every view, so asking from
// the list opens a fresh session and drops you into its thread. The list is
// `SessionList`, the transcript `SessionThread` (design-kit `ChatSession*`),
// the input `SessionComposer`; this file is the chrome and the glue.

/** The panel's one name, in the tab header and the breadcrumb alike (AD14). */
const PANEL_NAME = "Ask Assistant";

export function AssistantPanel({
	availableLanguages,
	defaultLanguage,
	llmProviders,
	onRun,
	onStop,
	isRunning,
	sessions,
	activeSession,
	username,
	graphSlug,
	bannerCanvasIdBySession,
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
	attachment,
	onRemoveAttachment,
}: AssistantPanelProps) {
	const isModeller = surface === "modeller";
	// Bumped to focus the composer when the user picks "let me type instead" on a
	// clarification (docs/for-developers/modules/ask/features/clarifying-questions.md).
	const [composerFocus, setComposerFocus] = useState(0);
	// Chat (the transcript) or Tasks (every step of every reply) — UC11.
	const [view, setView] = useState<"chat" | "tasks">("chat");
	// The "what do the dots mean" legend, opened from the header help icon.
	const [legendOpen, setLegendOpen] = useState(false);
	// LLM providers excluded from the list (client-side). Empty = show all.
	// Sessions don't record their provider yet, so this filters nothing today —
	// it's wired ahead of NL queries landing (see Session.llmProviderId).
	const [excludedLLMs, setExcludedLLMs] = useState<ReadonlySet<string>>(
		() => new Set(),
	);
	const runViews = useRunStore((s) => s.views);

	const inDetail = activeSession !== null;

	// `esc` stops the run, from anywhere on the page — like a console (UC9).
	useEffect(() => {
		if (!isRunning) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				onStop();
			}
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [isRunning, onStop]);

	// Leaving the thread returns the footer to the chat view.
	useEffect(() => {
		if (!inDetail) setView("chat");
	}, [inDetail]);

	// The panel is named for the occupant, not its contents: **Ask Assistant**,
	// because the region holds the assistant and sessions are what it holds
	// (docs/for-developers/modules/ask/features/the-assistant.md AD14).
	//
	// Inside a thread the header becomes a breadcrumb: `Ask Assistant` (click to
	// return to the list — the tab *is* the back affordance, so there's no
	// separate back button) › the open session's title, ellipsized.
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
					{PANEL_NAME}
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
			PANEL_NAME
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

	// Mode/model/timeout to restore for the open session (docs/for-developers/modules/ask/features/ask-in-natural-language.md).
	const composerConfig = useMemo(
		() => deriveComposerConfig(activeSession, llmProviders),
		[activeSession, llmProviders],
	);

	// The open session's user prompts, newest first — walked by the composer's
	// ↑/↓ history (most recent first).
	const promptHistory = useMemo(
		() =>
			activeSession
				? activeSession.messages
						// Skip operation prompts ("Expand …", "Load to canvas") — the ↑/↓
						// history should walk only what the user typed (docs/for-developers/modules/explore/features/boards.md).
						.filter((m) => m.role === "user" && !m.operation)
						.map((m) => m.content)
						.reverse()
				: [],
		[activeSession],
	);

	// Clicking a clarification option sends it as the answer (docs/for-developers/modules/ask/features/clarifying-questions.md): the
	// engine resumes the waiting run with it (UC7). Reuses the session's
	// resolved nl config (provider/timeout), like the composer would.
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
	// answers in their own words (docs/for-developers/modules/ask/features/clarifying-questions.md).
	const handleTypeInstead = () => setComposerFocus((n) => n + 1);

	// 👍/👎 a reply (docs/for-developers/modules/ask/features/clarifying-questions.md · docs/for-developers/modules/workflows/features/promote-a-plan.md). A downvote also kicks off a refinement: it
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

	// Jump from the Tasks view (or the pinned strip) to a reply in the chat.
	const jumpTo = (messageId: string) => {
		setView("chat");
		window.setTimeout(() => {
			document
				.getElementById(`turn-${messageId}`)
				?.scrollIntoView({ block: "start", behavior: "smooth" });
		}, 50);
	};

	// ── Live turns: the pinned strip + status line (UC5, UC7) ────────────────
	const liveTurns = useMemo(() => {
		if (!activeSession)
			return [] as { message: SessionMessage; view: RunView }[];
		// One row per *run*, not per reply: a run resumed after a
		// clarification spans two replies (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md), and messages are in
		// order, so the last one wins — the reply the run is writing now.
		const byThinking = new Map<
			string,
			{ message: SessionMessage; view: RunView }
		>();
		for (const m of activeSession.messages) {
			const v = m.runId ? runViews[m.runId] : undefined;
			if (
				v &&
				m.runId &&
				(v.status === "queued" ||
					v.status === "run" ||
					v.status === "awaiting_input")
			) {
				byThinking.set(m.runId, { message: m, view: v });
			}
		}
		return [...byThinking.values()];
	}, [activeSession, runViews]);

	const strip =
		view === "chat" && liveTurns.length > 0 ? (
			<div className="shrink-0 border-t border-border px-3 py-1.5 flex flex-col gap-px">
				{liveTurns.map(({ message, view: v }) => {
					const steps = stepsFor(message, v);
					const current =
						steps.find((s) => s.status === "running") ??
						steps.find((s) => s.status === "needs_input") ??
						steps.find((s) => s.status === "queued");
					const tokens = steps.reduce(
						(n, s) => n + (s.tokensIn ?? 0) + (s.tokensOut ?? 0),
						0,
					);
					return (
						<ChatSessionTaskRow
							key={message.id}
							status={
								v.status === "awaiting_input"
									? "needs-input"
									: current?.status === "running"
										? "running"
										: "queued"
							}
							name={current?.label ?? "Planning"}
							// The step's own detail — the strip doesn't restate the
							// question, the reply in the chat already carries it.
							description={current?.detail}
							meta={
								tokens > 0
									? `↑ ${formatCompactCount(tokens)} tokens`
									: undefined
							}
							onClick={() => jumpTo(message.id)}
						/>
					);
				})}
			</div>
		) : null;

	const running = liveTurns.filter(
		(t) => t.view.status === "queued" || t.view.status === "run",
	).length;
	const waiting = liveTurns.length - running;
	const stepCount = activeSession
		? activeSession.messages.reduce(
				(n, m) =>
					n +
					(m.role === "assistant"
						? stepsFor(m, m.runId ? runViews[m.runId] : undefined).length
						: 0),
				0,
			)
		: 0;

	const statusStart = inDetail ? (
		<>
			<button
				type="button"
				onClick={() => setView("chat")}
				className={
					view === "chat"
						? "font-medium text-foreground"
						: "hover:text-foreground"
				}
			>
				Chat
			</button>
			<button
				type="button"
				onClick={() => setView("tasks")}
				className={
					view === "tasks"
						? "font-medium text-foreground"
						: "hover:text-foreground"
				}
			>
				Tasks ({stepCount})
			</button>
			{running > 0 ? (
				<span className="text-primary">{running} running</span>
			) : waiting > 0 ? (
				<span className="text-warning">{waiting} needs input</span>
			) : null}
		</>
	) : (
		<span>
			{sessions.length} session{sessions.length === 1 ? "" : "s"}
		</span>
	);

	const statusEnd = isRunning ? (
		<>
			<span>esc stop</span>
			<span>↓ tasks</span>
		</>
	) : (
		<>
			<span>↵ send</span>
			<span>⇧↵ newline</span>
			<span>↑↓ history</span>
		</>
	);

	// Modeller: a Commit bar above the composer publishes the bound draft —
	// identical to the Modeller's Publish, in the session's context (docs/for-developers/modules/ask/spec.md).
	const commitBar =
		isModeller && inDetail && onCommit ? (
			<div className="shrink-0 border-t border-border px-3 py-2 flex items-center justify-between gap-2">
				<span className="text-muted-foreground">
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
			{strip}
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
				agentName={activeSession?.agentName ?? null}
				agentStatus={activeSession?.agentStatus ?? null}
				attachment={attachment}
				onRemoveAttachment={onRemoveAttachment}
			/>
			<ChatSessionStatusBar
				className="pt-0"
				start={statusStart}
				end={statusEnd}
			/>
		</>
	);

	return (
		<>
			<ListPanelChrome
				title={tabLabel}
				icon={MessageSquare}
				leadingActions={[
					{
						key: "legend",
						name: "Status legend",
						icon: HelpCircle,
						onClick: () => setLegendOpen(true),
					},
				]}
				onRefresh={onRefresh}
				isRefreshing={isRefreshing}
				refreshLabel="Refresh sessions"
				searchable
				searchLabel="Search sessions"
				onClose={onClose}
				// The assistant is on the right, so its control is a close ✕ — the hi-fi
				// draws exactly that (`Assistant · the shell`). A left-collapse chevron
				// here promised to fold the left column, and did.
				closeIcon={X}
				closeLabel="Close the assistant"
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
										{/* The endpoint's own name is the address segment a
										    refusal reads back (PM10) — a filter names what a rule
										    names. */}
										{p.name || p.provider}
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
						view === "tasks" ? (
							<SessionTasksView session={activeSession} onJump={jumpTo} />
						) : (
							<SessionThread
								session={activeSession}
								isRunning={isRunning}
								results={results}
								onRerun={onRerun}
								onFetchContext={onFetchContext}
								onSelectOption={handleSelectOption}
								onTypeInstead={handleTypeInstead}
								onVote={handleVote}
								onLoadToCanvas={onLoadToCanvas}
							/>
						)
					) : (
						<SessionList
							sessions={sessions}
							sort={sort}
							search={search}
							username={username}
							graphSlug={graphSlug}
							bannerCanvasIdBySession={bannerCanvasIdBySession}
							onOpen={onOpenSession}
							excludedLLMs={excludedLLMs}
							onPin={onPin}
							onArchive={onArchive}
						/>
					)
				}
			</ListPanelChrome>
			<SessionLegendDialog open={legendOpen} onOpenChange={setLegendOpen} />
		</>
	);
}
