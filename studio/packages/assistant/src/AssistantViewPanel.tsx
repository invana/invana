import {
	Badge,
	Button,
	ChatSessionTaskRow,
	EmptyState,
	SearchInput,
} from "@invana/ui";
import type {
	QueryLanguage,
	QueryResponse,
	QueryRunPayload,
	RunView,
	Session,
	SessionContextTurn,
	SessionMessage,
} from "@invana-studio/core";
import { formatCompactCount, useRunStore } from "@invana-studio/core";
import {
	Check,
	History,
	MessageSquare,
	Plus,
	Settings2,
	Star,
	X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type { AssistantAttachment, LLMProvider } from "./SessionComposer";
import { deriveComposerConfig, SessionComposer } from "./SessionComposer";
import { SessionList } from "./SessionList";
import { SessionSettings } from "./SessionSettings";
import { stepsFor } from "./SessionStepsTimeline";
import { SessionThread } from "./SessionThread";

export interface AssistantViewPanelProps {
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
	/** The engine's count of the list — `sessions` is one page of it. */
	sessionsTotal: number;
	activeSession: Session | null;
	onOpenSession: (id: string) => void;
	onBack: () => void;
	/** Re-run a past assistant message's query in place (a new run). */
	onRerun: (messageId: string) => void;
	/** Fetch the conversation context the model was given for an assistant reply
	 *  (docs/for-developers/modules/ask/spec.md · docs/for-developers/modules/ask/features/reasoning-trace.md) — lazily, when its disclosure is opened. */
	onFetchContext: (messageId: string) => Promise<SessionContextTurn[]>;
	/** Transient per-message query results, keyed by assistant message id (docs/for-developers/modules/ask/features/the-answer-surface.md). */
	results: Record<string, QueryResponse | null>;
	/** Project a graph result onto the canvas (logs a `load` turn, docs/for-developers/modules/explore/features/boards.md). The
	 *  message is the reply the result belongs to — its query is what was loaded. */
	onLoadToCanvas: (result: QueryResponse, message: SessionMessage) => void;
	/** Draw a table reply's rows by asking its whole-node twin. */
	onLoadCanvasQuery?: (message: SessionMessage) => void;
	/** Open the console under the board — on Records from a reply's record
	 *  count, on Log from a failure. Absent where the page has no console. */
	onOpenConsole?: (tab: "data" | "queries", messageId?: string) => void;
	/** Keep the board as it stands as a view — a reply's *Save view*. */
	onSaveView?: () => void;
	/** Close the assistant. Its sessions live on the RIGHT and nowhere else,
	 *  so this closes the region — it never touches the left rail. */
	onClose: () => void;
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
	 *  (the-assistant.md). Null when nothing is attached. */
	attachment?: AssistantAttachment | null;
	/** Take the attachment off; the next ask goes without it. */
	onRemoveAttachment?: () => void;
	/** The world picker, placed in the composer. */
	worldControl?: ReactNode;
	/** Set the open thread's token cap per run; null is the agent's budget. */
	onSetTokensPerRun?: (
		sessionId: string,
		tokens: number | null,
	) => Promise<unknown>;
}

// ── Panel ─────────────────────────────────────────────────────────────────────
// The assistant, docked right (docs/products/explorer.md): a header —
// *Assistant* and what is open — over one of two views, the open thread or
// the history of sessions, with the composer under both. Asking from the
// history opens a fresh session and drops you into its thread. While a run
// runs, a strip above the composer names its current step. The list is
// `SessionList`, the transcript `SessionThread`, the input `SessionComposer`;
// this file is the chrome and the glue.

export function AssistantViewPanel({
	availableLanguages,
	defaultLanguage,
	llmProviders,
	onRun,
	onStop,
	isRunning,
	sessions,
	sessionsTotal,
	activeSession,
	onOpenSession,
	onBack,
	onRerun,
	onFetchContext,
	results,
	onLoadToCanvas,
	onLoadCanvasQuery,
	onOpenConsole,
	onSaveView,
	onClose,
	onPin,
	onArchive,
	surface = "explorer",
	onCommit,
	canCommit,
	isCommitting,
	attachment,
	onRemoveAttachment,
	worldControl,
	onSetTokensPerRun,
}: AssistantViewPanelProps) {
	const isModeller = surface === "modeller";
	// Bumped to focus the composer when the user picks "let me type instead" on a
	// clarification (docs/for-developers/modules/ask/features/clarifying-questions.md).
	const [composerFocus, setComposerFocus] = useState(0);
	// The thread's settings — its spend per run, from the header.
	const [settingsOpen, setSettingsOpen] = useState(false);
	const runViews = useRunStore((s) => s.views);

	// The history is a view over the open thread, not a way out of it: the
	// board keeps its canvas while the person looks back. It opens only when
	// asked for — with no thread open, the panel is a blank new session.
	const [historyOpen, setHistoryOpen] = useState(false);
	const inDetail = !historyOpen;
	// The history, searched by title.
	const [search, setSearch] = useState("");
	// A new session is a blank thread until its first ask creates the row.
	const startNew = () => {
		setHistoryOpen(false);
		onBack();
		setComposerFocus((n) => n + 1);
	};

	// `esc` stops the run, from anywhere on the page — like a console.
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
	// engine resumes the waiting run with it. Reuses the session's
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
			timeoutS: composerConfig?.timeoutS ?? 120,
		});
	};

	// "Let me type instead" on a clarification — focus the composer so the user
	// answers in their own words (docs/for-developers/modules/ask/features/clarifying-questions.md).
	const handleTypeInstead = () => setComposerFocus((n) => n + 1);

	// Jump from the running strip to its reply in the thread.
	const jumpTo = (messageId: string) => {
		window.setTimeout(() => {
			document
				.getElementById(`turn-${messageId}`)
				?.scrollIntoView({ block: "start", behavior: "smooth" });
		}, 50);
	};

	// ── Live turns: the pinned strip + status line ────────────────
	const liveTurns = useMemo(() => {
		if (!activeSession)
			return [] as { message: SessionMessage; view: RunView }[];
		// One row per *run*, not per reply: a run resumed after a
		// clarification spans two replies (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md), and messages are in
		// order, so the last one wins — the reply the run is writing now.
		const byRun = new Map<string, { message: SessionMessage; view: RunView }>();
		for (const m of activeSession.messages) {
			const v = m.runId ? runViews[m.runId] : undefined;
			if (
				v &&
				m.runId &&
				(v.status === "queued" ||
					v.status === "run" ||
					v.status === "awaiting_input")
			) {
				byRun.set(m.runId, { message: m, view: v });
			}
		}
		return [...byRun.values()];
	}, [activeSession, runViews]);

	const strip =
		liveTurns.length > 0 ? (
			<div className="shrink-0 border-t border-border px-3 py-1.5 flex flex-col gap-px">
				{liveTurns.map(({ message, view: v }) => {
					const steps = stepsFor(message, v);
					const current =
						steps.find((s) => s.status === "running") ??
						steps.find((s) => s.status === "needs_input") ??
						steps.find((s) => s.status === "queued");
					// The engine's sum, carried on each finished step.
					const tokens = v.runTokens ?? 0;
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

	// Modeller: a Commit bar above the composer publishes the bound draft —
	// identical to the Modeller's Publish, in the session's context (docs/for-developers/modules/ask/spec.md).
	const commitBar =
		isModeller && inDetail && activeSession && onCommit ? (
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
				// Asking from the history returns to the thread the ask lands in.
				onRun={(payload) => {
					setHistoryOpen(false);
					onRun(payload);
				}}
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
				worldControl={worldControl}
			/>
		</>
	);

	return (
		<div className="flex h-full min-h-0 flex-col bg-card">
			<div className="flex h-control-lg shrink-0 items-center gap-2 border-b border-border pr-2 pl-3">
				<Star className="size-3.5 shrink-0 text-primary" aria-hidden />
				<span className="shrink-0 font-semibold">Assistant</span>
				<span
					className="min-w-0 truncate text-xs text-muted-foreground"
					title={activeSession?.title || undefined}
				>
					{historyOpen ? "History" : activeSession?.title || "New session"}
				</span>
				<span className="flex-1" />
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label="New session"
					title="New session"
					onClick={startNew}
				>
					<Plus />
				</Button>
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label="Sessions"
					aria-pressed={historyOpen}
					title={historyOpen ? "Back to the thread" : "Sessions"}
					onClick={() => setHistoryOpen((v) => !v)}
				>
					<History />
				</Button>
				{inDetail && activeSession && onSetTokensPerRun && (
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label="Session settings"
						title="Session settings"
						onClick={() => setSettingsOpen((v) => !v)}
					>
						<Settings2 />
					</Button>
				)}
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label="Close the assistant"
					title="Close the assistant"
					onClick={onClose}
				>
					<X />
				</Button>
			</div>
			<div className="min-h-0 flex-1 overflow-hidden">
				{inDetail && !activeSession ? (
					<EmptyState
						className="h-full"
						icon={<Star className="size-5" />}
						title="New session"
						description="Ask a question about the graph, or say what to draw."
					/>
				) : activeSession && inDetail ? (
					<>
						{onSetTokensPerRun && (
							<SessionSettings
								session={activeSession}
								open={settingsOpen}
								onOpenChange={setSettingsOpen}
								onSave={(tokens) => onSetTokensPerRun(activeSession.id, tokens)}
							/>
						)}
						<SessionThread
							session={activeSession}
							isRunning={isRunning}
							results={results}
							onRerun={onRerun}
							onFetchContext={onFetchContext}
							onSelectOption={handleSelectOption}
							onTypeInstead={handleTypeInstead}
							onLoadToCanvas={onLoadToCanvas}
							onLoadCanvasQuery={onLoadCanvasQuery}
							onOpenConsole={onOpenConsole}
							onSaveView={onSaveView}
						/>
					</>
				) : (
					<div className="flex h-full min-h-0 flex-col">
						<div className="flex shrink-0 flex-col gap-2 border-b border-border p-3">
							<div className="flex items-center gap-2">
								<MessageSquare className="size-3.5 text-muted-foreground" />
								<span className="font-semibold">Sessions</span>
								<Badge variant="secondary">{sessionsTotal}</Badge>
								<span className="flex-1" />
								<Button variant="outline" size="sm" onClick={startNew}>
									<Plus />
									New
								</Button>
							</div>
							<SearchInput
								value={search}
								onChange={setSearch}
								placeholder="Search sessions…"
								aria-label="Search sessions"
							/>
						</div>
						<div className="min-h-0 flex-1 overflow-auto">
							<SessionList
								sessions={sessions}
								search={search}
								onOpen={(id) => {
									setHistoryOpen(false);
									onOpenSession(id);
								}}
								onPin={onPin}
								onArchive={onArchive}
							/>
						</div>
					</div>
				)}
			</div>
			{footer}
		</div>
	);
}
