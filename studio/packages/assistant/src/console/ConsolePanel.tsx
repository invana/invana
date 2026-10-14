import {
	ContextBar,
	cn,
	EmptyState,
	SegmentedControl,
	TabbedPanel,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Terminal,
	TerminalLine,
	TypographyPre,
} from "@invana/ui";
import type {
	Emission,
	QueryResponse,
	SessionMessage,
} from "@invana-studio/core";
import { emissionsApi, useRunStore } from "@invana-studio/core";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Play } from "lucide-react";
import { useState } from "react";
import { emissionsFromResult } from "../answer-surface/emissions";
import {
	type ConsoleRecords,
	type ConsoleTab,
	logOf,
	queriesOf,
	recordsOf,
} from "./consoleRecords";

/** Rows drawn at once; the count above the table is always the full one. */
const WINDOW = 200;

export interface ConsolePanelProps {
	username: string;
	graphSlug: string;
	/** The open thread's latest reply — what the canvas in front of it drew. */
	message: SessionMessage | null;
	/** That reply's result, when it is still in hand from this page's run. */
	result: QueryResponse | null | undefined;
	tab: ConsoleTab;
	onTabChange: (tab: ConsoleTab) => void;
	onCollapse: () => void;
	/** Run the reply's query again, as a new run of the same reply. */
	onRerun: () => void;
	isRunning: boolean;
	/** Select a drawn element on the canvas — a row is a view of that element. */
	onSelectElement?: (id: string) => void;
}

function cell(value: unknown): string {
	if (value === null || value === undefined) return "—";
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

function RecordsTable({
	records,
	onSelectElement,
}: {
	records: ConsoleRecords;
	onSelectElement?: (id: string) => void;
}) {
	const shown = records.rows.slice(0, WINDOW);
	return (
		<Table>
			<TableHeader>
				<TableRow>
					{records.columns.map((c) => (
						<TableHead key={c}>{c}</TableHead>
					))}
				</TableRow>
			</TableHeader>
			<TableBody>
				{shown.map((row, i) => {
					const id = records.elementIds?.[i];
					return (
						<TableRow
							// One element can come back on several rows, so the
							// position keeps the key unique; rows are never reordered.
							// biome-ignore lint/suspicious/noArrayIndexKey: the rows are a fixed page of one result
							key={`${i}:${id ?? ""}`}
							className={id && onSelectElement ? "cursor-pointer" : undefined}
							onClick={
								id && onSelectElement ? () => onSelectElement(id) : undefined
							}
						>
							{records.columns.map((c) => {
								// A node's properties are one JSON line, so a cell is capped
								// and the whole value is its hover.
								const text = cell(row[c]);
								return (
									<TableCell
										key={c}
										title={text}
										className={cn(
											"max-w-96 truncate",
											c === "id" ? "font-mono" : "tabular-nums",
										)}
									>
										{text}
									</TableCell>
								);
							})}
						</TableRow>
					);
				})}
			</TableBody>
		</Table>
	);
}

/**
 * The console — the records, the queries and the log behind what the canvas
 * drew, in `bottomSection` under the canvas only.
 *
 * It holds the open thread's latest reply, because the canvas is that thread's
 * layer. Records are read from the reply's emissions (the record, so a reload
 * reads rather than re-runs), falling back to the result this page still has
 * in hand. Query is read-only — writing one is the composer's job. Log lists
 * the run's steps and the error of a failed one, which is where a failed
 * query is read. Re-run and Collapse sit in the tab strip; the counts are its
 * last row. It names no key: the console has no editor, so `⌘↵` is the
 * composer's, named in the chat's status bar.
 */
export function ConsolePanel({
	username,
	graphSlug,
	message,
	result,
	tab,
	onTabChange,
	onCollapse,
	onRerun,
	isRunning,
	onSelectElement,
}: ConsolePanelProps) {
	const [format, setFormat] = useState<"table" | "json">("table");
	const runId = message?.runId;
	const views = useRunStore((s) => s.views);
	const view = runId ? views[runId] : undefined;
	// The same query, and so the same cache entry, as the reply's emission card.
	const persisted = useQuery({
		queryKey: ["emissions", username, graphSlug, runId] as const,
		queryFn: () => emissionsApi.list(username, graphSlug, runId as string),
		enabled: Boolean(runId),
		staleTime: 60_000,
	});
	const emissions: Emission[] = persisted.data?.length
		? persisted.data
		: emissionsFromResult(result ?? view?.result, { onCanvas: true });

	const failed = message?.status === "error";
	const records = failed ? null : recordsOf(emissions);
	const queries = queriesOf(emissions, message);
	const steps = view?.steps ?? message?.steps ?? [];
	const log = logOf(message, steps);
	const doneSteps = steps.filter((s) => s.status === "succeeded").length;

	const counters = failed
		? `failed · ${log.find((l) => l.level === "error")?.source ?? "query"}`
		: [
				records ? `${records.rows.length.toLocaleString()} records` : null,
				`${queries.length} ${queries.length === 1 ? "query" : "queries"}`,
				message?.executionTimeMs != null
					? `${message.executionTimeMs} ms`
					: null,
				steps.length > 0 ? `${doneSteps}/${steps.length} steps` : null,
			]
				.filter(Boolean)
				.join(" · ");

	const nothingRan = (
		<EmptyState
			title="Nothing has run on this canvas"
			description="Ask a question or run a query — its records, the query and the log land here."
		/>
	);

	const recordsBody = !message ? (
		nothingRan
	) : failed ? (
		<EmptyState
			title="Nothing ran"
			description="The query failed before it returned records — Log has the line."
		/>
	) : !records ? (
		<EmptyState
			title="No records in hand"
			description="This canvas was restored, not run — re-run its query to read the rows."
		/>
	) : records.rows.length === 0 ? (
		<EmptyState
			title="0 records"
			description="The query returned nothing to show."
		/>
	) : format === "json" ? (
		<TypographyPre className="m-0 rounded-none border-0">
			{JSON.stringify(records.rows.slice(0, WINDOW), null, 2)}
		</TypographyPre>
	) : (
		<RecordsTable records={records} onSelectElement={onSelectElement} />
	);

	const tabs = [
		{
			value: "records",
			label: "Records",
			content: (
				<div className="flex h-full flex-col overflow-auto">
					{records && records.rows.length > WINDOW ? (
						<p className="px-3 py-1 text-muted-foreground">
							Showing the first {WINDOW} of{" "}
							{records.rows.length.toLocaleString()}
						</p>
					) : null}
					{recordsBody}
				</div>
			),
		},
		{
			value: "query",
			label: "Query",
			content: (
				<div className="flex h-full flex-col gap-3 overflow-auto p-3">
					{queries.length === 0
						? nothingRan
						: queries.map((q, i) => (
								<div key={q.query} className="flex flex-col gap-1">
									<p className="text-muted-foreground">
										query {i + 1} of {queries.length}
										{q.language ? ` · ${q.language}` : ""}
										{q.executionTimeMs != null
											? ` · ${q.executionTimeMs} ms`
											: ""}
									</p>
									<TypographyPre className="m-0">{q.query}</TypographyPre>
								</div>
							))}
				</div>
			),
		},
		{
			value: "log",
			label: "Log",
			content: (
				<div className="flex h-full flex-col overflow-auto">
					{log.length === 0 ? (
						nothingRan
					) : (
						<Terminal
							className="min-h-full border-0"
							columnTemplate="5rem 3rem 10rem minmax(0,1fr)"
						>
							{log.map((l) => (
								<TerminalLine
									key={l.id}
									level={l.level}
									columns={[l.at, l.level, l.source, l.message]}
								/>
							))}
						</Terminal>
					)}
				</div>
			),
		},
	];

	return (
		<TabbedPanel
			className="h-full"
			tabs={tabs}
			activeTab={tab}
			onTabChange={(v) => onTabChange(v as ConsoleTab)}
			headerContent={
				tab === "records" && records && records.rows.length > 0 ? (
					<SegmentedControl
						size="xs"
						aria-label="Records as"
						options={[
							{ value: "table", label: "Table" },
							{ value: "json", label: "JSON" },
						]}
						value={format}
						onValueChange={(v) => setFormat(v as "table" | "json")}
					/>
				) : undefined
			}
			headerActions={[
				{
					name: "Re-run",
					label: "Re-run",
					icon: Play,
					disabled: isRunning || !message?.sourceQuery,
					onClick: onRerun,
				},
				{
					name: "Collapse the console",
					icon: ChevronDown,
					onClick: onCollapse,
				},
			]}
			footerContent={<ContextBar counters={counters} />}
		/>
	);
}
