import {
	Button,
	ChatSessionStatusBar,
	DropdownMenuCheckboxItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
} from "@invana/ui";
import { Check, ChevronRight, MessageSquare } from "lucide-react";
import { useMemo, useState } from "react";
import type { SessionSort } from "../../../../services/api/sessions";
import type { QueryLanguage } from "../../../../types/graphs";
import type { LLMProvider } from "../../../../types/llm";
import type { QueryResponse, QueryRunPayload } from "../../../../types/query";
import type {
	Session,
	SessionContextTurn,
	SessionMessage,
} from "../../../../types/session";
import { ListFilterMenu, ListPanelChrome } from "./ListPanel";
import { SessionComposer, deriveComposerConfig } from "./SessionComposer";
import { SessionList } from "./SessionList";
import { SessionThread } from "./SessionThread";

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
	/** Owning graph coordinates — let bannered rows lazy-fetch their canvas
	 *  preview (RFC-045). Undefined until the route params resolve. */
	username?: string;
	graphSlug?: string;
	/** sessionId → canvasId for sessions whose 1:1 canvas has a banner
	 *  screenshot (RFC-045). Rows in this map render the preview above the title. */
	bannerCanvasIdBySession?: Map<string, string>;
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
	/** Project a graph result onto the canvas (logs a `load` turn, RFC-046). The
	 *  message is the reply the result belongs to — its query is what was loaded. */
	onLoadToCanvas: (result: QueryResponse, message: SessionMessage) => void;
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
// Two views in one rail panel (RFC-054): the list of past sessions, and the
// console transcript of the open one. The composer + status bar are pinned to
// the footer in both, so asking from the list opens a fresh session and drops
// you into its thread. The list is `SessionList`, the transcript
// `SessionThread` (design-kit `ChatSession*`), the input `SessionComposer`;
// this file is the chrome and the glue between them.

export function SessionsPanel({
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

	// Mode/model/timeout to restore for the open session (RFC-030).
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
						// history should walk only what the user typed (RFC-046).
						.filter((m) => m.role === "user" && !m.operation)
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

	// Status line under the composer (RFC-054): what the session holds on the
	// left, the composer's key bindings on the right.
	const statusStart = isRunning ? (
		<span className="text-primary">
			{isModeller ? "Generating…" : "Running…"}
		</span>
	) : !activeSession ? (
		`${sessions.length} session${sessions.length === 1 ? "" : "s"}`
	) : isModeller ? (
		(() => {
			const prompts = activeSession.messages.filter(
				(m) => m.role === "user",
			).length;
			return `${prompts} prompt${prompts === 1 ? "" : "s"}`;
		})()
	) : activeSession.nodeCount + activeSession.edgeCount > 0 ? (
		`${activeSession.nodeCount} nodes · ${activeSession.edgeCount} relationships`
	) : (
		"No results yet"
	);

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
			<ChatSessionStatusBar
				className="pt-0"
				start={<span className="truncate">{statusStart}</span>}
				end={<span>↵ send · ⇧↵ newline · ↑↓ history</span>}
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
						isRunning={isRunning}
						results={results}
						onRerun={onRerun}
						onFetchContext={onFetchContext}
						onSelectOption={handleSelectOption}
						onTypeInstead={handleTypeInstead}
						onVote={handleVote}
						onLoadToCanvas={onLoadToCanvas}
					/>
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
	);
}
