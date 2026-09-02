import { defaultKeymap, insertNewlineAndIndent } from "@codemirror/commands";
import { StreamLanguage } from "@codemirror/language";
import { cypher } from "@codemirror/legacy-modes/mode/cypher";
import { groovy } from "@codemirror/legacy-modes/mode/groovy";
import { Annotation, Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@invana/forms";
import { Button, ChatSessionComposer } from "@invana/ui";
import { ArrowUp, Paperclip, Square, Timer, X } from "lucide-react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { QueryLanguage } from "../../../../types/graphs";
import type { LLMProvider } from "../../../../types/llm";
import type { QueryMode, QueryRunPayload } from "../../../../types/query";
import type { Session } from "../../../../types/session";

// ── CodeMirror theme ──────────────────────────────────────────────────────────
// Reads the design-kit colour tokens so the QL editor follows the active theme
// (light or dark, any preset — RFC-044) instead of a hard-coded dark palette.

const editorTheme = EditorView.theme({
	"&": {
		color: "var(--color-foreground)",
		backgroundColor: "transparent",
		height: "100%",
	},
	".cm-scroller": {
		overflow: "auto",
		fontFamily: "monospace",
		fontSize: "13px",
	},
	".cm-content": { caretColor: "var(--color-foreground)", padding: "8px 0" },
	".cm-cursor": { borderLeftColor: "var(--color-foreground)" },
	".cm-selectionBackground": {
		backgroundColor:
			"color-mix(in srgb, var(--color-primary) 30%, transparent)",
	},
	"&.cm-focused .cm-selectionBackground": {
		backgroundColor:
			"color-mix(in srgb, var(--color-primary) 35%, transparent)",
	},
	".cm-line": { padding: "0 8px" },
	".cm-gutters": { display: "none" },
	".cm-focused": { outline: "none" },
});

const LANGUAGE_LABEL: Record<QueryLanguage, string> = {
	cypher: "Cypher",
	gremlin: "Gremlin",
};

// Starter query shown the first time the QL editor opens for a language.
const DEFAULT_QUERY: Record<QueryLanguage, string> = {
	cypher: "MATCH (n) WITH n LIMIT 10 MATCH (n)-[r]->(m) RETURN n, r, m",
	gremlin: "g.V().hasLabel('Person').limit(25)",
};

// NL-only LLM translation timeout presets (seconds). Default matches the
// engine's translate fallback; longer options give slow local models room.
const TIMEOUT_OPTIONS = [
	{ value: 30, label: "30s" },
	{ value: 60, label: "1m" },
	{ value: 120, label: "2m" },
	{ value: 300, label: "5m" },
] as const;
const DEFAULT_TIMEOUT_S = 120;

// Cypher ships in CM 6 legacy-modes; Gremlin's host language is Groovy, which
// gives the closest highlighting (strings, comments, keywords, numbers).
const LANGUAGE_EXTENSION: Record<
	QueryLanguage,
	ReturnType<typeof StreamLanguage.define>
> = {
	cypher: StreamLanguage.define(cypher),
	gremlin: StreamLanguage.define(groovy),
};

// Toolbar control classes — the same trigger styling the design-kit
// AgentConsole reference uses, so Studio's selects sit flush in the composer.
const FIXED_TRIGGER =
	"h-7 w-auto shrink-0 border-0 bg-transparent gap-1 px-2 hover:bg-accent";
const FILL_TRIGGER =
	"h-7 w-full min-w-0 border-0 bg-transparent gap-1 px-2 hover:bg-accent text-muted-foreground";

// ── Props ─────────────────────────────────────────────────────────────────────

/** Composer defaults restored from the open session's last reply, so reopening
 *  an NL session keeps its model + mode without the user re-selecting. */
export interface ComposerConfig {
	mode: QueryMode;
	language?: QueryLanguage;
	llmProviderId?: string;
	/** NL only — the timeout (seconds) the session's last ask used. */
	timeoutS?: number;
}

/**
 * The mode + model to restore when a session is reopened (RFC-030), read from
 * its last real assistant reply. The engine persists `mode` ("nl" | "ql") per
 * message, so it's read directly — robust even when that reply errored or was a
 * rerun. Older rows predate the field, so it falls back to inferring from `via`
 * ("<provider> · <model>" for NL, "Cypher"/"Gremlin" for QL). Operation turns
 * (expand/load, RFC-046) carry a ql mode but aren't the user's composer choice,
 * so they're skipped. Null until messages load — the composer then keeps the
 * user's current selection.
 */
export function deriveComposerConfig(
	session: Session | null,
	llmProviders: readonly LLMProvider[],
): ComposerConfig | null {
	if (!session) return null;
	const last = [...session.messages]
		.reverse()
		.find((m) => m.role === "assistant" && !m.operation && (m.mode || m.via));
	if (!last) return null;
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
}

export interface SessionComposerProps {
	availableLanguages: readonly QueryLanguage[];
	defaultLanguage: QueryLanguage;
	llmProviders: readonly LLMProvider[];
	onRun: (payload: QueryRunPayload) => void;
	/** Cancel the in-flight run — wired to the stop button shown while running. */
	onStop: () => void;
	isRunning: boolean;
	/** The open session's user prompts, newest first. ↑/↓ walk this like a shell
	 *  history (↑ older, ↓ newer); navigating past the newest restores the draft
	 *  the user was typing. */
	promptHistory?: readonly string[];
	/** Open session id — changing it re-applies `initialConfig` once. Null on the list. */
	sessionKey?: string | null;
	/** Mode/model to restore for the open session; null until derivable. */
	initialConfig?: ComposerConfig | null;
	/** Bump to focus the input — e.g. when the user picks "let me type instead"
	 *  on a clarification (RFC-038). Ignored at 0 (initial). */
	focusSignal?: number;
	/** RFC-031 — which surface the composer serves. A "modeller" composer is
	 *  NL-only (it authors a model): the mode switch is hidden and QL is
	 *  unreachable. Defaults to "explorer" (the full NL/QL composer). */
	surface?: "explorer" | "modeller";
}

// ── Component ─────────────────────────────────────────────────────────────────
// The session's input bar (RFC-054). Natural-language mode is the design-kit
// `ChatSessionComposer` — Studio only supplies the toolbar controls (mode,
// model, timeout, attach) and the attachment chips. Query-language mode needs a
// CodeMirror editor, which the design-kit composer has no slot for, so it
// renders the same card chrome locally with the editor in the input position
// and shares the toolbar nodes. Both keep the ↑/↓ prompt history.

export function SessionComposer({
	availableLanguages,
	defaultLanguage,
	llmProviders,
	onRun,
	onStop,
	isRunning,
	sessionKey,
	initialConfig,
	promptHistory,
	focusSignal,
	surface = "explorer",
}: SessionComposerProps) {
	const isModeller = surface === "modeller";
	const [mode, setMode] = useState<QueryMode>("nl");
	const [language, setLanguage] = useState<QueryLanguage>(defaultLanguage);
	const [llmProviderId, setLlmProviderId] = useState<string>("");
	const [nlQuery, setNlQuery] = useState("");
	const [attachments, setAttachments] = useState<File[]>([]);
	const [timeoutS, setTimeoutS] = useState<number>(DEFAULT_TIMEOUT_S);

	// Wraps the NL composer so Studio can reach its textarea (focus, ↑/↓ keys)
	// — the design-kit composer exposes neither a ref nor a keydown hook yet.
	const rootRef = useRef<HTMLDivElement>(null);
	const editorContainerRef = useRef<HTMLDivElement>(null);
	const editorViewRef = useRef<EditorView | null>(null);
	// The QL editor unmounts while the composer is in NL mode (the design-kit
	// composer owns the input surface), so its text lives here and is restored
	// when the user switches back.
	const qlDocRef = useRef<string>(DEFAULT_QUERY[defaultLanguage]);
	const languageCompartmentRef = useRef(new Compartment());
	const fileInputRef = useRef<HTMLInputElement>(null);
	// Lets the CodeMirror Enter keybinding (wired when the editor mounts) call
	// the latest handleRun without closing over stale mode/language/query state.
	const handleRunRef = useRef<() => void>(() => {});

	// ── Shell-style prompt history (↑ older / ↓ newer) ───────────────────────
	// All in refs so the CodeMirror keybindings read live values. `historyIndex`
	// is -1 when not navigating (a live draft); 0 is the newest prompt, higher is
	// older. `draft` holds the text being typed before ↑ entered history,
	// restored when ↓ walks back past the newest.
	const historyRef = useRef<readonly string[]>([]);
	historyRef.current = promptHistory ?? [];
	const historyIndexRef = useRef(-1);
	const draftRef = useRef("");

	// Compute the text to show for a history step, or null to leave the editor as
	// is (no history, already at the oldest, or not currently navigating on ↓).
	const stepHistory = (
		dir: "older" | "newer",
		currentText: string,
	): string | null => {
		const history = historyRef.current;
		if (history.length === 0) return null;
		let idx = historyIndexRef.current;
		if (dir === "older") {
			if (idx >= history.length - 1) return null; // already at the oldest
			if (idx === -1) draftRef.current = currentText; // entering: stash the draft
			idx += 1;
			historyIndexRef.current = idx;
			return history[idx];
		}
		if (idx <= -1) return null; // ↓ does nothing unless we're in history
		idx -= 1;
		historyIndexRef.current = idx;
		return idx === -1 ? draftRef.current : history[idx];
	};

	// Marks the CodeMirror recall dispatch so the editor's updateListener can tell
	// a programmatic recall from a user edit (only the latter resets the cursor).
	const recallAnnotationRef = useRef(Annotation.define<boolean>());

	// Replace the QL editor's whole doc with a recalled prompt (caret to end),
	// tagged so it doesn't read as a user edit. Returns whether anything changed
	// — false lets the key fall through to normal cursor movement.
	const applyRecall = (view: EditorView, text: string | null): boolean => {
		if (text == null) return false;
		view.dispatch({
			changes: { from: 0, to: view.state.doc.length, insert: text },
			selection: { anchor: text.length },
			annotations: recallAnnotationRef.current.of(true),
		});
		return true;
	};

	// Focus the NL input when the parent bumps focusSignal (e.g. "let me type
	// instead" on a clarification). 0 is the initial value — don't focus on mount.
	useEffect(() => {
		if (focusSignal) rootRef.current?.querySelector("textarea")?.focus();
	}, [focusSignal]);

	// The session we've already restored the mode/model for — guards against
	// re-applying over the user's manual switches within the same session.
	const appliedSessionRef = useRef<string | null>(null);

	// ── Restore the open session's mode + model once on open (RFC-030) ────────
	useEffect(() => {
		if (!sessionKey) {
			appliedSessionRef.current = null; // back on the list — re-apply on next open
			return;
		}
		if (!initialConfig || appliedSessionRef.current === sessionKey) return;
		appliedSessionRef.current = sessionKey;
		// Modeller sessions are NL-only — never restore a QL mode.
		setMode(isModeller ? "nl" : initialConfig.mode);
		if (initialConfig.language) setLanguage(initialConfig.language);
		if (initialConfig.mode === "nl" && initialConfig.llmProviderId) {
			setLlmProviderId(initialConfig.llmProviderId);
		}
		if (initialConfig.timeoutS != null) setTimeoutS(initialConfig.timeoutS);
	}, [sessionKey, initialConfig, isModeller]);

	// Switching sessions (or back to the list) starts a fresh history walk.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset is keyed on the session only
	useEffect(() => {
		historyIndexRef.current = -1;
		draftRef.current = "";
	}, [sessionKey]);

	// ── Keep selectors valid if the available lists shift ────────────────────
	useEffect(() => {
		if (!availableLanguages.includes(language)) setLanguage(defaultLanguage);
	}, [availableLanguages, language, defaultLanguage]);

	useEffect(() => {
		if (llmProviders.length === 0) {
			setLlmProviderId("");
			return;
		}
		if (llmProviders.some((p) => p.id === llmProviderId)) return;
		const preferred = llmProviders.find((p) => p.is_default) ?? llmProviders[0];
		setLlmProviderId(preferred?.id ?? "");
	}, [llmProviders, llmProviderId]);

	const languageOptions = useMemo(
		() =>
			availableLanguages.map((value) => ({
				value,
				label: LANGUAGE_LABEL[value],
			})),
		[availableLanguages],
	);

	// ── Mount CodeMirror whenever the QL surface is shown ────────────────────
	// The editor is rebuilt from `qlDocRef` each time the mode flips to QL and
	// torn down when it flips back, so the NL composer never carries a hidden
	// editor. Undo history doesn't survive the switch; the text does.
	// biome-ignore lint/correctness/useExhaustiveDependencies: (re)built only when the QL surface mounts
	useEffect(() => {
		if (mode !== "ql" || !editorContainerRef.current) return;

		const state = EditorState.create({
			doc: qlDocRef.current,
			extensions: [
				// Enter submits, Shift-Enter inserts a newline — listed before
				// defaultKeymap so it wins over CM's default Enter binding.
				keymap.of([
					{
						key: "Enter",
						run: () => {
							handleRunRef.current();
							return true;
						},
					},
					{ key: "Shift-Enter", run: insertNewlineAndIndent },
					// ↑/↓ walk the prompt history, but only from the first/last line so
					// they keep their normal cursor movement inside a multi-line query.
					{
						key: "ArrowUp",
						run: (view) => {
							const { doc, selection } = view.state;
							if (doc.lineAt(selection.main.head).number !== 1) return false;
							return applyRecall(view, stepHistory("older", doc.toString()));
						},
					},
					{
						key: "ArrowDown",
						run: (view) => {
							const { doc, selection } = view.state;
							if (doc.lineAt(selection.main.head).number !== doc.lines)
								return false;
							return applyRecall(view, stepHistory("newer", doc.toString()));
						},
					},
				]),
				keymap.of(defaultKeymap),
				EditorView.updateListener.of((update) => {
					if (!update.docChanged) return;
					qlDocRef.current = update.state.doc.toString();
					// A user edit (any doc change that isn't our recall) drops out of the
					// history walk so the next ↑ stashes the new text as the draft.
					if (
						!update.transactions.some((tr) =>
							tr.annotation(recallAnnotationRef.current),
						)
					) {
						historyIndexRef.current = -1;
					}
				}),
				languageCompartmentRef.current.of(LANGUAGE_EXTENSION[language]),
				editorTheme,
				EditorView.lineWrapping,
			],
		});

		const view = new EditorView({ state, parent: editorContainerRef.current });
		editorViewRef.current = view;

		return () => {
			view.destroy();
			editorViewRef.current = null;
		};
	}, [mode]);

	// Reconfigure the language compartment on switch — keeps doc / undo intact.
	useEffect(() => {
		const view = editorViewRef.current;
		if (!view) return;
		view.dispatch({
			effects: languageCompartmentRef.current.reconfigure(
				LANGUAGE_EXTENSION[language],
			),
		});
	}, [language]);

	// ── Handlers ──────────────────────────────────────────────────────────────

	const handleRun = () => {
		// Enter / Cmd-Enter reach here even while a run is in flight (the button is
		// swapped to Stop, but the key bindings stay live) — ignore until it ends.
		if (isRunning) return;
		if (mode === "ql") {
			const query = editorViewRef.current?.state.doc.toString().trim() ?? "";
			if (!query) return;
			onRun({ mode: "ql", query, language, timeoutS });
			historyIndexRef.current = -1; // sent — next ↑ starts from the newest
			return;
		}
		const query = nlQuery.trim();
		if (!query || !llmProviderId) return;
		onRun({ mode: "nl", query, llmProviderId, attachments, timeoutS });
		setNlQuery("");
		setAttachments([]);
		historyIndexRef.current = -1;
	};
	handleRunRef.current = handleRun;

	// ↑/↓ prompt history for the NL textarea. The design-kit composer handles
	// Enter itself and lets other keys bubble, so this listens on the wrapper:
	// only from the first/last line (normal caret movement inside a multi-line
	// prompt) and only with a collapsed selection.
	const handleNlKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
		if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
		const ta = e.target;
		if (!(ta instanceof HTMLTextAreaElement)) return;
		if (ta.selectionStart !== ta.selectionEnd) return;
		if (e.key === "ArrowUp") {
			if (ta.value.slice(0, ta.selectionStart).includes("\n")) return;
			const next = stepHistory("older", nlQuery);
			if (next != null) {
				e.preventDefault();
				setNlQuery(next);
			}
			return;
		}
		if (ta.value.slice(ta.selectionEnd).includes("\n")) return;
		const next = stepHistory("newer", nlQuery);
		if (next != null) {
			e.preventDefault();
			setNlQuery(next);
		}
	};

	const handleAttachChange = (e: ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files) return;
		setAttachments((prev) => [...prev, ...Array.from(files)]);
		e.target.value = ""; // allow re-picking the same file after removal
	};

	const removeAttachment = (index: number) =>
		setAttachments((prev) => prev.filter((_, i) => i !== index));

	const noLlmProviders = llmProviders.length === 0;

	// ── Toolbar (shared by both input surfaces) ──────────────────────────────
	// Mode + language/LLM on the left, timeout + attach on the right. The mode
	// select and buttons stay fixed; the second control absorbs the leftover
	// width and truncates so a long provider name never shoves send off-panel.

	const toolbarStart = (
		<>
			{/* Modeller sessions author a model — NL only, so the mode switch is
			    hidden (QL is unreachable). Explorer keeps the NL/QL toggle. */}
			{!isModeller && (
				<Select value={mode} onValueChange={(v) => setMode(v as QueryMode)}>
					<SelectTrigger className={FIXED_TRIGGER}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="nl">Natural Language</SelectItem>
						<SelectItem value="ql">Query Language</SelectItem>
					</SelectContent>
				</Select>
			)}
			{mode === "nl" ? (
				noLlmProviders ? (
					<span className="text-muted-foreground px-1 truncate">
						No LLM — add one in Settings → LLMs.
					</span>
				) : (
					<Select value={llmProviderId} onValueChange={setLlmProviderId}>
						<SelectTrigger className={FILL_TRIGGER}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{llmProviders.map((p) => (
								<SelectItem key={p.id} value={p.id}>
									{p.provider} · {p.model_id}
									{p.is_default ? " (default)" : ""}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				)
			) : languageOptions.length <= 1 ? (
				<span className="inline-flex items-center h-7 px-2 text-muted-foreground truncate">
					{LANGUAGE_LABEL[language]}
				</span>
			) : (
				<Select
					value={language}
					onValueChange={(v) => setLanguage(v as QueryLanguage)}
				>
					<SelectTrigger className={FILL_TRIGGER}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{languageOptions.map((l) => (
							<SelectItem key={l.value} value={l.value}>
								{l.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			)}
		</>
	);

	const toolbarEnd = (
		<>
			{(mode === "ql" || !noLlmProviders) && (
				<Select
					value={String(timeoutS)}
					onValueChange={(v) => setTimeoutS(Number(v))}
				>
					<SelectTrigger
						className={`${FIXED_TRIGGER} text-muted-foreground`}
						title={mode === "nl" ? "LLM + query timeout" : "Query timeout"}
					>
						<Timer className="w-3.5 h-3.5" />
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{TIMEOUT_OPTIONS.map((t) => (
							<SelectItem key={t.value} value={String(t.value)}>
								{t.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			)}
			{mode === "nl" && (
				<>
					<input
						ref={fileInputRef}
						type="file"
						multiple
						onChange={handleAttachChange}
						className="hidden"
					/>
					<Button
						variant="ghost"
						size="icon"
						className="h-7 w-7 shrink-0 text-muted-foreground"
						onClick={() => fileInputRef.current?.click()}
						title="Attach files"
					>
						<Paperclip className="w-4 h-4" />
					</Button>
				</>
			)}
		</>
	);

	// ── Query-language surface: CodeMirror in the design-kit card chrome ──────
	if (mode === "ql") {
		return (
			<div className="p-3">
				<div className="rounded-control border border-border bg-card shadow-sm overflow-hidden focus-within:border-ring transition-colors">
					{/* The editor mounts into a flex-1 child of a resize-y wrapper so
					    CodeMirror keeps a resolved height (its hit-region needs one). */}
					<div className="min-h-16 h-24 max-h-64 resize-y overflow-hidden flex flex-col">
						<div ref={editorContainerRef} className="flex-1 min-h-0" />
					</div>
					<div className="px-2 py-1.5 border-t border-border flex items-center gap-1.5">
						<div className="flex-1 min-w-0 flex items-center gap-1.5">
							{toolbarStart}
						</div>
						{toolbarEnd}
						{isRunning ? (
							<Button
								size="icon"
								className="h-7 w-7 shrink-0 rounded-control"
								onClick={onStop}
								title="Stop"
								aria-label="Stop"
							>
								<Square className="w-3 h-3 fill-current" />
							</Button>
						) : (
							<Button
								size="icon"
								className="h-7 w-7 shrink-0 rounded-control"
								onClick={handleRun}
								title="Send"
								aria-label="Send"
							>
								<ArrowUp className="w-4 h-4" />
							</Button>
						)}
					</div>
				</div>
			</div>
		);
	}

	// ── Natural-language surface: the design-kit composer ────────────────────
	const attachmentChips =
		attachments.length > 0
			? attachments.map((file, i) => (
					<span
						key={`${file.name}-${i}`}
						className="inline-flex items-center gap-1 bg-muted border border-border rounded-control px-1.5 py-0.5 text-muted-foreground max-w-full"
					>
						<span className="truncate max-w-40" title={file.name}>
							{file.name}
						</span>
						<button
							type="button"
							onClick={() => removeAttachment(i)}
							className="hover:text-foreground shrink-0"
							aria-label={`Remove ${file.name}`}
						>
							<X className="w-3 h-3" />
						</button>
					</span>
				))
			: undefined;

	return (
		<div ref={rootRef} onKeyDown={handleNlKeyDown}>
			<ChatSessionComposer
				value={nlQuery}
				onChange={(v) => {
					setNlQuery(v);
					historyIndexRef.current = -1; // manual edit → live draft again
				}}
				onSend={handleRun}
				onStop={onStop}
				isRunning={isRunning}
				placeholder={
					isModeller
						? "Describe the model to build…"
						: "Ask anything about your graph…"
				}
				toolbarStart={toolbarStart}
				toolbarEnd={toolbarEnd}
				attachments={attachmentChips}
				sendIcon={<ArrowUp className="w-4 h-4" />}
				stopIcon={<Square className="w-3 h-3 fill-current" />}
				sendDisabled={noLlmProviders || !nlQuery.trim()}
			/>
		</div>
	);
}
