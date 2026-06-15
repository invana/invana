import { defaultKeymap, insertNewlineAndIndent } from "@codemirror/commands";
import { StreamLanguage } from "@codemirror/language";
import { cypher } from "@codemirror/legacy-modes/mode/cypher";
import { groovy } from "@codemirror/legacy-modes/mode/groovy";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@invana/forms";
import { Button } from "@invana/ui";
import { ArrowUp, Paperclip, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { QueryLanguage } from "../../../../types/graphs";
import type { LLMProvider } from "../../../../types/llm";
import type { QueryMode, QueryRunPayload } from "../../../../types/query";

// ── CodeMirror dark theme ─────────────────────────────────────────────────────

const darkTheme = EditorView.theme(
	{
		"&": {
			color: "#d4d4d4",
			backgroundColor: "transparent",
			height: "100%",
		},
		".cm-scroller": {
			overflow: "auto",
			fontFamily: "monospace",
			fontSize: "13px",
		},
		".cm-content": { caretColor: "#fff", padding: "8px 0" },
		".cm-cursor": { borderLeftColor: "#fff" },
		".cm-selectionBackground": { backgroundColor: "#264f78" },
		"&.cm-focused .cm-selectionBackground": { backgroundColor: "#264f78" },
		".cm-line": { padding: "0 8px" },
		".cm-gutters": { display: "none" },
		".cm-focused": { outline: "none" },
	},
	{ dark: true },
);

const LANGUAGE_LABEL: Record<QueryLanguage, string> = {
	cypher: "Cypher",
	gremlin: "Gremlin",
};

// Cypher ships in CM 6 legacy-modes; Gremlin's host language is Groovy, which
// gives the closest highlighting (strings, comments, keywords, numbers).
const LANGUAGE_EXTENSION: Record<
	QueryLanguage,
	ReturnType<typeof StreamLanguage.define>
> = {
	cypher: StreamLanguage.define(cypher),
	gremlin: StreamLanguage.define(groovy),
};

// ── Props ─────────────────────────────────────────────────────────────────────

/** Composer defaults restored from the open session's last reply, so reopening
 *  an NL session keeps its model + mode without the user re-selecting. */
export interface ComposerConfig {
	mode: QueryMode;
	language?: QueryLanguage;
	llmProviderId?: string;
}

export interface SessionComposerProps {
	availableLanguages: readonly QueryLanguage[];
	defaultLanguage: QueryLanguage;
	llmProviders: readonly LLMProvider[];
	onRun: (payload: QueryRunPayload) => void;
	isRunning: boolean;
	/** Open session id — changing it re-applies `initialConfig` once. Null on the list. */
	sessionKey?: string | null;
	/** Mode/model to restore for the open session; null until derivable. */
	initialConfig?: ComposerConfig | null;
}

// ── Component ─────────────────────────────────────────────────────────────────
// The query box, restyled as a chat-style bottom bar: a bordered card with the
// input on top and a toolbar (mode / language / attach … send) underneath. It
// keeps every capability of the old console — NL/QL toggle, a CodeMirror QL
// editor, attachments — just laid out to match the Sessions UI.

export function SessionComposer({
	availableLanguages,
	defaultLanguage,
	llmProviders,
	onRun,
	isRunning,
	sessionKey,
	initialConfig,
}: SessionComposerProps) {
	const [mode, setMode] = useState<QueryMode>("nl");
	const [language, setLanguage] = useState<QueryLanguage>(defaultLanguage);
	const [llmProviderId, setLlmProviderId] = useState<string>("");
	const [nlQuery, setNlQuery] = useState("");
	const [attachments, setAttachments] = useState<File[]>([]);

	const editorContainerRef = useRef<HTMLDivElement>(null);
	const editorViewRef = useRef<EditorView | null>(null);
	const languageCompartmentRef = useRef(new Compartment());
	const fileInputRef = useRef<HTMLInputElement>(null);
	// Lets the CodeMirror Enter keybinding (wired once on mount) call the
	// latest handleRun without closing over stale mode/language/query state.
	const handleRunRef = useRef<() => void>(() => {});
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
		setMode(initialConfig.mode);
		if (initialConfig.language) setLanguage(initialConfig.language);
		if (initialConfig.mode === "nl" && initialConfig.llmProviderId) {
			setLlmProviderId(initialConfig.llmProviderId);
		}
	}, [sessionKey, initialConfig]);

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

	// ── Initialise CodeMirror once (stays mounted across mode toggles) ────────
	// biome-ignore lint/correctness/useExhaustiveDependencies: editor init runs once on mount
	useEffect(() => {
		if (!editorContainerRef.current) return;

		const defaultQuery =
			defaultLanguage === "gremlin"
				? "g.V().hasLabel('Person').limit(25)"
				: "MATCH (n) WITH n LIMIT 10 MATCH (n)-[r]->(m) RETURN n, r, m";

		const state = EditorState.create({
			doc: defaultQuery,
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
				]),
				keymap.of(defaultKeymap),
				languageCompartmentRef.current.of(LANGUAGE_EXTENSION[defaultLanguage]),
				darkTheme,
				EditorView.lineWrapping,
			],
		});

		const view = new EditorView({ state, parent: editorContainerRef.current });
		editorViewRef.current = view;

		return () => {
			view.destroy();
			editorViewRef.current = null;
		};
	}, []);

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
		if (mode === "ql") {
			const query = editorViewRef.current?.state.doc.toString().trim() ?? "";
			if (!query) return;
			onRun({ mode: "ql", query, language });
			return;
		}
		const query = nlQuery.trim();
		if (!query || !llmProviderId) return;
		onRun({ mode: "nl", query, llmProviderId, attachments });
		setNlQuery("");
		setAttachments([]);
	};
	handleRunRef.current = handleRun;

	const handleAttachChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files) return;
		setAttachments((prev) => [...prev, ...Array.from(files)]);
		e.target.value = ""; // allow re-picking the same file after removal
	};

	const removeAttachment = (index: number) =>
		setAttachments((prev) => prev.filter((_, i) => i !== index));

	const noLlmProviders = llmProviders.length === 0;
	const runDisabled =
		isRunning || (mode === "nl" && (noLlmProviders || !nlQuery.trim()));

	// ── Render ──────────────────────────────────────────────────────────────────
	return (
		<div className="p-3">
			<div className="rounded-md border border-border bg-card shadow-sm overflow-hidden focus-within:border-ring transition-colors">
				{/* Attachment chips (NL only) — pinned above the input so a long
				    list never shoves the toolbar off-screen. */}
				{mode === "nl" && attachments.length > 0 && (
					<div className="px-2 py-1.5 border-b border-border max-h-24 overflow-y-auto flex items-start gap-1 flex-wrap">
						{attachments.map((file, i) => (
							<span
								key={`${file.name}-${i}`}
								className="inline-flex items-center gap-1 bg-muted border border-border rounded px-1.5 py-0.5 text-muted-foreground max-w-full"
							>
								<span className="truncate max-w-40" title={file.name}>
									{file.name}
								</span>
								<button
									type="button"
									onClick={() => removeAttachment(i)}
									className="hover:text-foreground shrink-0"
								>
									<X className="w-3 h-3" />
								</button>
							</span>
						))}
					</div>
				)}

				{/* Input surface — QL CodeMirror or the NL textarea. The QL editor is
				    mounted into a flex-1 child of a resize-y wrapper so CodeMirror
				    keeps a resolved height (its hit-region needs one). */}
				<div
					className={
						mode === "ql"
							? "min-h-16 h-24 max-h-64 resize-y overflow-hidden flex flex-col"
							: "hidden"
					}
				>
					<div ref={editorContainerRef} className="flex-1 min-h-0" />
				</div>
				{mode === "nl" && (
					<textarea
						value={nlQuery}
						onChange={(e) => setNlQuery(e.target.value)}
						onKeyDown={(e) => {
							if (
								e.key === "Enter" &&
								!e.shiftKey &&
								!e.nativeEvent.isComposing
							) {
								e.preventDefault();
								handleRun();
							}
						}}
						placeholder="Ask anything about your graph…"
						className="block w-full min-h-16 h-24 max-h-64 bg-transparent p-2 text-foreground outline-none resize-y placeholder:text-muted-foreground"
					/>
				)}

				{/* Toolbar — mode + language/LLM on the left, attach + send right.
            The mode select and buttons stay fixed; the second control absorbs
            the leftover width and truncates so a long provider name never
            shoves the send button off a narrow panel. */}
				<div className="px-2 py-1.5 border-t border-border flex items-center gap-1.5">
					<Select value={mode} onValueChange={(v) => setMode(v as QueryMode)}>
						<SelectTrigger className="h-7 w-auto shrink-0 border-0 bg-transparent gap-1 px-2 hover:bg-accent">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="nl">Natural Language</SelectItem>
							<SelectItem value="ql">Query Language</SelectItem>
						</SelectContent>
					</Select>

					<div className="flex-1 min-w-0 flex items-center">
						{mode === "nl" ? (
							noLlmProviders ? (
								<span className="text-muted-foreground px-1 truncate">
									No LLM — add one in Settings → LLMs.
								</span>
							) : (
								<Select value={llmProviderId} onValueChange={setLlmProviderId}>
									<SelectTrigger className="h-7 w-full min-w-0 border-0 bg-transparent gap-1 px-2 hover:bg-accent text-muted-foreground">
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
								<SelectTrigger className="h-7 w-full min-w-0 border-0 bg-transparent gap-1 px-2 hover:bg-accent text-muted-foreground">
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
					</div>

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

					<Button
						size="icon"
						className="h-7 w-7 shrink-0 rounded-full"
						onClick={handleRun}
						disabled={runDisabled}
						title="Send"
					>
						<ArrowUp className="w-4 h-4" />
					</Button>
				</div>
			</div>
		</div>
	);
}
