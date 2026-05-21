import { defaultKeymap } from "@codemirror/commands";
import { StreamLanguage } from "@codemirror/language";
import { cypher } from "@codemirror/legacy-modes/mode/cypher";
import { groovy } from "@codemirror/legacy-modes/mode/groovy";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import {
	Button,
	ScrollArea,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	TabbedPanel,
} from "@invana/ui";
import { Clock, Paperclip, Play, Terminal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { QueryLanguage } from "../../../../types/graphs";
import type { LLMProvider } from "../../../../types/llm";
import type { QueryHistoryEntry } from "../../../../types/query";

// ── Query type + payload shapes ──────────────────────────────────────────────

export type QueryMode = "nl" | "ql";

/** Unified payload — ExplorerPage dispatches on `mode`. */
export type QueryRunPayload =
	| { mode: "ql"; query: string; language: QueryLanguage }
	| {
			mode: "nl";
			query: string;
			llmProviderId: string;
			attachments: File[];
	  };

// ── CodeMirror dark theme ─────────────────────────────────────────────────────

const darkTheme = EditorView.theme(
	{
		"&": {
			color: "#d4d4d4",
			backgroundColor: "transparent",
			// Fill the resizable wrapper; the wrapper owns the height via
			// `resize: vertical`. CM's default `.cm-editor` is flex column +
			// `.cm-scroller` flex:1, so clicks anywhere inside focus.
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

// Stream-language wrappers for CM 6. Cypher is supported natively in
// legacy-modes; Gremlin's host language is Groovy, so groovy gives us the
// closest highlighting (strings, comments, keywords, numbers).
const LANGUAGE_EXTENSION: Record<
	QueryLanguage,
	ReturnType<typeof StreamLanguage.define>
> = {
	cypher: StreamLanguage.define(cypher),
	gremlin: StreamLanguage.define(groovy),
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface QueryPanelProps {
	availableLanguages: readonly QueryLanguage[];
	defaultLanguage: QueryLanguage;
	llmProviders: readonly LLMProvider[];
	onRun: (payload: QueryRunPayload) => void;
	isRunning: boolean;
	history: QueryHistoryEntry[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function QueryPanel({
	availableLanguages,
	defaultLanguage,
	llmProviders,
	onRun,
	isRunning,
	history,
}: QueryPanelProps) {
	const [mode, setMode] = useState<QueryMode>("ql");
	const [language, setLanguage] = useState<QueryLanguage>(defaultLanguage);
	const [llmProviderId, setLlmProviderId] = useState<string>("");
	const [nlQuery, setNlQuery] = useState("");
	const [attachments, setAttachments] = useState<File[]>([]);

	const editorContainerRef = useRef<HTMLDivElement>(null);
	const editorViewRef = useRef<EditorView | null>(null);
	const languageCompartmentRef = useRef(new Compartment());
	const fileInputRef = useRef<HTMLInputElement>(null);

	// ── Keep selectors valid if the available list shifts ────────────────────
	useEffect(() => {
		if (!availableLanguages.includes(language)) {
			setLanguage(defaultLanguage);
		}
	}, [availableLanguages, language, defaultLanguage]);

	useEffect(() => {
		if (llmProviders.length === 0) {
			setLlmProviderId("");
			return;
		}
		const stillValid = llmProviders.some((p) => p.id === llmProviderId);
		if (stillValid) return;
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
				: "MATCH (n) RETURN n LIMIT 25";

		const state = EditorState.create({
			doc: defaultQuery,
			extensions: [
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
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	// Reconfigure the language compartment on language switch — keeps the
	// editor state (doc, selection, undo history) intact.
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
		} else {
			const query = nlQuery.trim();
			if (!query || !llmProviderId) return;
			onRun({ mode: "nl", query, llmProviderId, attachments });
		}
	};

	const handleAttachClick = () => {
		fileInputRef.current?.click();
	};

	const handleAttachChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files) return;
		setAttachments((prev) => [...prev, ...Array.from(files)]);
		// Reset so the same file can be re-picked after removal.
		e.target.value = "";
	};

	const removeAttachment = (index: number) => {
		setAttachments((prev) => prev.filter((_, i) => i !== index));
	};

	const loadHistoryEntry = (entry: QueryHistoryEntry) => {
		if (!editorViewRef.current) return;
		const view = editorViewRef.current;
		view.dispatch({
			changes: { from: 0, to: view.state.doc.length, insert: entry.query },
		});
		if (availableLanguages.includes(entry.language)) {
			setLanguage(entry.language);
		}
		setMode("ql");
	};

	const noLlmProviders = llmProviders.length === 0;
	const runDisabled =
		isRunning || (mode === "nl" && (noLlmProviders || !nlQuery.trim()));

	// ── Query form — selects + editor + attach/run, in that order ────────────
	// All selects are @invana/ui's Radix-based <Select> so tab key navigates:
	// query-type → LLM/lang → editor → (attach) → Run.
	// Rendered as an "island" card: bg-card + border + rounded + shadow on
	// a padded wrapper so it visually floats over the panel.
	const queryForm = (
		<div className="flex flex-col shrink-0 bg-card border border-border rounded-md shadow-sm overflow-hidden">
			{/* 1. Inline selects: query-type + LLM/lang on the same row. */}
			<div className="px-2 py-1.5 shrink-0 flex items-center gap-2 flex-wrap">
				<Select value={mode} onValueChange={(v) => setMode(v as QueryMode)}>
					<SelectTrigger className="h-7 w-auto">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="nl">Natural Language</SelectItem>
						<SelectItem value="ql">Query Language</SelectItem>
					</SelectContent>
				</Select>

				{mode === "nl" ? (
					noLlmProviders ? (
						<span className="text-muted-foreground">
							No LLM — configure in Settings → LLMs.
						</span>
					) : (
						<Select value={llmProviderId} onValueChange={setLlmProviderId}>
							<SelectTrigger className="h-7 w-auto">
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
					// Single-language connector — show the name as a muted pill so
					// the user still knows what dialect to write, without offering
					// a fake dropdown.
					<span className="inline-flex items-center h-7 px-2 rounded bg-muted text-muted-foreground">
						{LANGUAGE_LABEL[language]}
					</span>
				) : (
					<Select
						value={language}
						onValueChange={(v) => setLanguage(v as QueryLanguage)}
					>
						<SelectTrigger className="h-7 w-auto">
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

			{/* 2. Editor — `bg-background` is one notch darker than the card so
			    the editor surface is visually distinct from the chrome. Both
			    fields are user-resizable via the corner drag handle. The
			    QL CodeMirror is mounted into a flex-1 child so the outer
			    `resize-y` wrapper can grow it without breaking CM's hit-
			    region (CM expects a parent with a resolved height). */}
			<div className="shrink-0 border-t border-border bg-background">
				<div
					className={
						mode === "ql"
							? "h-50 min-h-30 resize-y overflow-hidden flex flex-col"
							: "hidden"
					}
				>
					<div ref={editorContainerRef} className="flex-1 min-h-0" />
				</div>
				{mode === "nl" && (
					<textarea
						value={nlQuery}
						onChange={(e) => setNlQuery(e.target.value)}
						placeholder="Ask anything about your graph…"
						className="block w-full min-h-30 h-50 bg-transparent p-2 text-foreground outline-none resize-y text-base placeholder:text-muted-foreground"
					/>
				)}
			</div>

			{/* 3a. Attachment chips (NL only) — their own row above the action
			    row so a large list never pushes Run off-screen. Wraps + scrolls
			    when the list overflows; each filename truncates at a fixed
			    width. Hidden in QL mode and when the list is empty. */}
			{mode === "nl" && attachments.length > 0 && (
				<div className="px-2 py-1.5 border-t border-border shrink-0 max-h-24 overflow-y-auto flex items-start gap-1 flex-wrap">
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

			{/* 3b. Action row — Attach (NL only) + Run. Part of the form, not a
			    separate footer, so they stay anchored to the editor. */}
			<div className="px-2 py-1.5 border-t border-border shrink-0 flex items-center gap-2">
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
							variant="outline"
							size="sm"
							className="h-7"
							onClick={handleAttachClick}
						>
							<Paperclip className="w-3 h-3 mr-1" />
							Attach
						</Button>
					</>
				)}
				<div className="flex-1" />
				<Button
					size="sm"
					className="h-7 gap-1.5"
					onClick={handleRun}
					disabled={runDisabled}
				>
					<Play className="w-3 h-3" />
					{isRunning ? "Running…" : "Run"}
				</Button>
			</div>
		</div>
	);

	// ── History — its own section below the form ─────────────────────────────
	// The form floats as an island above; padding between them carries the
	// visual separation, so the history doesn't need its own top border.
	const historySection = (
		<div className="flex-1 m-3 min-h-0 flex flex-col border">
			<div className="px-3 py-2 flex items-center gap-1.5 text-muted-foreground bg-muted/40 border-y border-border shrink-0 font-medium uppercase tracking-wide">
				<Clock className="w-3.5 h-3.5" />
				History ({history.length})
			</div>
			<ScrollArea className="flex-1 min-h-0">
				{history.length === 0 ? (
					<div className="px-3 py-4 text-muted-foreground">No queries yet.</div>
				) : (
					<div className="flex flex-col">
						{history.map((entry) => (
							<button
								key={entry.id}
								type="button"
								onClick={() => loadHistoryEntry(entry)}
								className="text-left px-3 py-2 hover:bg-accent transition-colors border-b border-border last:border-0"
							>
								<p className="font-mono text-foreground truncate">
									{entry.query}
								</p>
								<div className="flex items-center gap-2 mt-0.5">
									<span className="text-xs text-muted-foreground">
										{entry.executedAt.toLocaleTimeString()}
									</span>
									<span className="text-xs text-muted-foreground">
										{entry.rowCount} rows
									</span>
									<span className="text-xs text-muted-foreground">
										{entry.executionTimeMs}ms
									</span>
								</div>
							</button>
						))}
					</div>
				)}
			</ScrollArea>
		</div>
	);

	// ── Render ────────────────────────────────────────────────────────────────
	// TabbedPanel wraps the entire surface (left-side panels in Studio always
	// use TabbedPanel, even single-tab). The form's Attach + Run live inside
	// the form itself — history is a separate section below.
	const consoleContent = (
		<div className="flex flex-col h-full min-h-0">
			<div className="p-3 shrink-0">{queryForm}</div>
			{historySection}
		</div>
	);

	return (
		<TabbedPanel
			tabs={[
				{
					value: "console",
					label: "Console",
					icon: Terminal,
					content: consoleContent,
				},
			]}
			defaultTab="console"
		/>
	);
}
