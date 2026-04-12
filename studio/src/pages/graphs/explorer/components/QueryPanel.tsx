import { defaultKeymap } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { Button, ScrollArea, TabbedPanel } from "@invana/ui";
import { Clock, Play, Terminal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { QueryHistoryEntry } from "../../../../types/query";

// ── Query language options ────────────────────────────────────────────────────

const LANGUAGES = ["Gremlin", "Cypher"] as const;
type Language = (typeof LANGUAGES)[number];

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

// ── Props ─────────────────────────────────────────────────────────────────────

export interface QueryPanelProps {
	defaultLanguage: "cypher" | "gremlin";
	onRun: (query: string, language: "cypher" | "gremlin") => void;
	isRunning: boolean;
	history: QueryHistoryEntry[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function QueryPanel({
	defaultLanguage,
	onRun,
	isRunning,
	history,
}: QueryPanelProps) {
	const [activeTab, setActiveTab] = useState<"console" | "history">("console");
	const [language, setLanguage] = useState<Language>(
		defaultLanguage === "cypher" ? "Cypher" : "Gremlin",
	);
	const editorContainerRef = useRef<HTMLDivElement>(null);
	const editorViewRef = useRef<EditorView | null>(null);

	// ── Initialise CodeMirror ─────────────────────────────────────────────────
	// biome-ignore lint/correctness/useExhaustiveDependencies: editor init runs once on mount
	useEffect(() => {
		if (!editorContainerRef.current) return;

		const defaultQuery =
			language === "Gremlin"
				? "g.V().hasLabel('Person').limit(25)"
				: "MATCH (n) RETURN n LIMIT 25";

		const state = EditorState.create({
			doc: defaultQuery,
			extensions: [
				keymap.of(defaultKeymap),
				javascript(),
				darkTheme,
				EditorView.lineWrapping,
			],
		});

		const view = new EditorView({
			state,
			parent: editorContainerRef.current,
		});

		editorViewRef.current = view;

		return () => {
			view.destroy();
			editorViewRef.current = null;
		};
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	const handleRun = () => {
		const query = editorViewRef.current?.state.doc.toString().trim() ?? "";
		if (!query) return;
		onRun(query, language === "Cypher" ? "cypher" : "gremlin");
	};

	const loadHistoryEntry = (entry: QueryHistoryEntry) => {
		if (!editorViewRef.current) return;
		const view = editorViewRef.current;
		view.dispatch({
			changes: { from: 0, to: view.state.doc.length, insert: entry.query },
		});
		setLanguage(entry.language === "cypher" ? "Cypher" : "Gremlin");
		setActiveTab("console");
	};

	// ── Tab contents ──────────────────────────────────────────────────────────

	const consoleContent = (
		<div className="flex flex-col h-full">
			{/* Language selector */}
			<div className="px-2 py-1.5 border-b border-border shrink-0">
				<select
					value={language}
					onChange={(e) => setLanguage(e.target.value as Language)}
					className="text-xs bg-muted border border-border rounded px-2 py-1 text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
				>
					{LANGUAGES.map((l) => (
						<option key={l} value={l}>
							{l}
						</option>
					))}
				</select>
			</div>
			{/* Editor */}
			<div
				ref={editorContainerRef}
				className="flex-1 overflow-hidden min-h-0"
			/>
		</div>
	);

	const historyContent = (
		<ScrollArea className="h-full">
			{history.length === 0 ? (
				<div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
					<p className="text-xs">No queries yet</p>
				</div>
			) : (
				<div className="flex flex-col">
					{history.map((entry) => (
						<button
							key={entry.id}
							type="button"
							onClick={() => loadHistoryEntry(entry)}
							className="text-left px-3 py-2 hover:bg-accent transition-colors border-b border-border last:border-0"
						>
							<p className="text-xs font-mono text-foreground truncate">
								{entry.query}
							</p>
							<div className="flex items-center gap-2 mt-0.5">
								<span className="text-[10px] text-muted-foreground">
									{entry.executedAt.toLocaleTimeString()}
								</span>
								<span className="text-[10px] text-muted-foreground">
									{entry.rowCount} rows
								</span>
								<span className="text-[10px] text-muted-foreground">
									{entry.executionTimeMs}ms
								</span>
							</div>
						</button>
					))}
				</div>
			)}
		</ScrollArea>
	);

	return (
		<TabbedPanel
			activeTab={activeTab}
			onTabChange={(v) => setActiveTab(v as "console" | "history")}
			tabs={[
				{
					value: "console",
					label: "Console",
					icon: Terminal,
					content: consoleContent,
				},
				{
					value: "history",
					label: `History (${history.length})`,
					icon: Clock,
					content: historyContent,
				},
			]}
			footerContent={
				<div className="p-2 w-full">
					<Button
						className="w-full h-8 text-xs gap-1.5"
						onClick={handleRun}
						disabled={isRunning || activeTab === "history"}
					>
						<Play className="w-3 h-3" />
						{isRunning ? "Running…" : "Run Query"}
					</Button>
				</div>
			}
		/>
	);
}
