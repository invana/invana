import {
	Button,
	cn,
	EmptyState,
	Eyebrow,
	Item,
	RecordPager,
	ScrollArea,
	SegmentedControl,
	StatusDot,
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
import type { QueryResultItem, Session } from "@invana-studio/core";
import { ChevronDown, ChevronLeft, Play } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import {
	type ConsoleTab,
	countsOf,
	type LabelGroup,
	labelGroupsOf,
	logOf,
	pageOf,
	type QueryStep,
	queryStepsOf,
} from "./consoleRecords";
import type { DataPlace } from "./useConsoleParam";

export interface ConsolePanelProps {
	tab: ConsoleTab;
	/** Data's label and page, from the param; absent is the first label. */
	data: DataPlace | null;
	/** The query open in Queries — its reply's id. */
	query: string | null;
	/** Everything drawn on the canvas in front. */
	items: readonly QueryResultItem[];
	/** The open thread — its replies are the session's queries. */
	session: Session | null;
	onOpenData: (place?: DataPlace) => void;
	onOpenQueries: (messageId?: string | null) => void;
	onCollapse: () => void;
	/** Select a drawn element on the canvas — a row is a view of that element. */
	onSelectElement?: (id: string) => void;
	/**
	 * A query's detail: the run page's own step, which this package cannot
	 * import. Absent, or for a query whose run left no step, the reply's log.
	 */
	renderStep?: (step: QueryStep) => ReactNode;
	/** Run a query again, as a new run of the reply that ran it. */
	onRerun?: (messageId: string) => void;
	/** A run is in flight — Re-run waits for it. */
	isRunning?: boolean;
}

function cell(value: unknown): string {
	if (value === null || value === undefined) return "—";
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

const STATUS_TONE = {
	done: "success",
	failed: "error",
	running: "running",
} as const;

function LabelList({
	groups,
	active,
	onPick,
}: {
	groups: LabelGroup[];
	active: LabelGroup;
	onPick: (g: LabelGroup) => void;
}) {
	const section = (title: string, kind: LabelGroup["kind"]) => {
		const its = groups.filter((g) => g.kind === kind);
		if (its.length === 0) return null;
		return (
			<div className="flex flex-col">
				<Eyebrow className="px-2 pt-2 pb-1">{title}</Eyebrow>
				{its.map((g) => (
					<Item
						key={`${g.kind}:${g.label}`}
						asChild
						size="xs"
						selected={g === active}
						aria-selected={g === active}
					>
						<button type="button" onClick={() => onPick(g)}>
							<span className="min-w-0 flex-1 truncate font-mono">
								{g.label}
							</span>
							<span className="text-muted-foreground tabular-nums">
								{g.items.length.toLocaleString()}
							</span>
						</button>
					</Item>
				))}
			</div>
		);
	};
	return (
		<ScrollArea className="w-52 shrink-0 border-r border-border">
			<div className="flex flex-col p-1">
				{section("Nodes", "node")}
				{section("Relationships", "relationship")}
			</div>
		</ScrollArea>
	);
}

function DataTab({
	items,
	place,
	onOpenData,
	onSelectElement,
}: {
	items: readonly QueryResultItem[];
	place: DataPlace | null;
	onOpenData: (place: DataPlace) => void;
	onSelectElement?: (id: string) => void;
}) {
	const [format, setFormat] = useState<"table" | "json">("table");
	const groups = useMemo(() => labelGroupsOf(items), [items]);
	if (groups.length === 0)
		return (
			<EmptyState
				className="h-full"
				title="Nothing on the canvas"
				description="Ask a question or type a query — what it draws is listed here, one table per label."
			/>
		);
	const active =
		groups.find((g) => g.kind === place?.kind && g.label === place?.label) ??
		groups[0];
	const page = pageOf(active.items, place?.page ?? 1);
	const go = (n: number) =>
		onOpenData({ kind: active.kind, label: active.label, page: n });
	const noun = active.kind === "node" ? "nodes" : "relationships";

	return (
		<div className="flex h-full min-h-0">
			<LabelList
				groups={groups}
				active={active}
				onPick={(g) => onOpenData({ kind: g.kind, label: g.label, page: 1 })}
			/>
			<div className="flex min-w-0 flex-1 flex-col">
				<div className="flex items-center gap-2 border-b border-border px-3 py-1">
					<span className="font-mono font-medium">{active.label}</span>
					<span className="text-muted-foreground">
						{active.items.length.toLocaleString()} {noun} ·{" "}
						{active.columns.length} properties
					</span>
					<span className="flex-1" />
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
					<RecordPager
						position={`${page.first}–${page.last} of ${active.items.length.toLocaleString()}`}
						previousLabel="Previous page"
						nextLabel="Next page"
						onPrevious={page.page > 1 ? () => go(page.page - 1) : undefined}
						onNext={
							page.page < page.pages ? () => go(page.page + 1) : undefined
						}
					/>
				</div>
				<div className="min-h-0 flex-1 overflow-auto">
					{format === "json" ? (
						<TypographyPre className="m-0 rounded-none border-0">
							{JSON.stringify(
								page.rows.map((i) => ({
									id: i.id,
									label: i.label,
									...(i.type === "edge"
										? { source: i.source, target: i.target }
										: {}),
									properties: i.properties,
								})),
								null,
								2,
							)}
						</TypographyPre>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									{active.columns.map((c) => (
										<TableHead key={c}>{c}</TableHead>
									))}
								</TableRow>
							</TableHeader>
							<TableBody>
								{page.rows.map((row) => (
									<TableRow
										key={row.id}
										className={onSelectElement ? "cursor-pointer" : undefined}
										onClick={
											onSelectElement
												? () => onSelectElement(row.id)
												: undefined
										}
									>
										{active.columns.map((c) => {
											// A cell is capped; the whole value is its hover.
											const text = cell(row.properties?.[c]);
											return (
												<TableCell
													key={c}
													title={text}
													className="max-w-96 truncate tabular-nums"
												>
													{text}
												</TableCell>
											);
										})}
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</div>
			</div>
		</div>
	);
}

function QueryList({
	queries,
	onOpen,
}: {
	queries: QueryStep[];
	onOpen: (messageId: string) => void;
}) {
	if (queries.length === 0)
		return (
			<EmptyState
				className="h-full"
				title="No queries yet in this session"
				description="Ask a question or type a query — each one it runs is listed here."
			/>
		);
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead className="w-6" />
					<TableHead>query</TableHead>
					<TableHead>language</TableHead>
					<TableHead>ran</TableHead>
					<TableHead>took</TableHead>
					<TableHead>rows</TableHead>
					<TableHead>asked by</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{queries.map((q) => (
					<TableRow
						key={q.messageId}
						className="cursor-pointer"
						onClick={() => onOpen(q.messageId)}
					>
						<TableCell>
							<StatusDot tone={STATUS_TONE[q.status]} label={q.status} />
						</TableCell>
						<TableCell
							title={q.query}
							className="max-w-[40rem] truncate font-mono"
						>
							{q.query}
						</TableCell>
						<TableCell>{q.language ?? "—"}</TableCell>
						<TableCell className="tabular-nums">
							{q.at.toLocaleTimeString([], { hour12: false })}
						</TableCell>
						<TableCell className="tabular-nums">
							{q.executionTimeMs != null ? `${q.executionTimeMs} ms` : "—"}
						</TableCell>
						<TableCell className="tabular-nums">
							{q.rowCount != null ? q.rowCount.toLocaleString() : "—"}
						</TableCell>
						<TableCell
							title={q.askedBy}
							className={cn(
								"max-w-80 truncate",
								!q.askedBy && "text-muted-foreground",
							)}
						>
							{q.askedBy ?? "typed in the chat"}
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

/**
 * The console — what is on the canvas and the queries this session ran, in
 * `bottomSection` under the canvas only. The footer's counts open it.
 *
 * **Data** is the whole canvas, one table per node label and relationship
 * type, because labels carry different properties: the list names each with
 * its count, the table holds that one's own columns, 20 a page, as a table or
 * the JSON the records arrived in. A row selects its element on the canvas.
 * **Queries** is the session's query steps, newest first; one opens as the run
 * page's own step — never a second drawing of it.
 */
export function ConsolePanel({
	tab,
	data,
	query,
	items,
	session,
	onOpenData,
	onOpenQueries,
	onCollapse,
	onSelectElement,
	renderStep,
	onRerun,
	isRunning = false,
}: ConsolePanelProps) {
	const queries = useMemo(() => queryStepsOf(session), [session]);
	const open = query ? queries.find((q) => q.messageId === query) : undefined;
	const counts = countsOf(items);

	const detail = (q: QueryStep) => {
		const step = q.stepId && q.runId ? renderStep?.(q) : null;
		if (step) return step;
		const message = session?.messages.find((m) => m.id === q.messageId) ?? null;
		const log = logOf(message, message?.steps ?? []);
		return log.length === 0 ? (
			<EmptyState
				className="h-full"
				title="No trace for this query"
				description="Its run left no steps to open."
			/>
		) : (
			<Terminal
				className="min-h-full border-0"
				columnTemplate="5rem 3rem 12rem minmax(0,1fr)"
			>
				{log.map((l) => (
					<TerminalLine
						key={l.id}
						level={l.level}
						columns={[l.at, l.level, l.source, l.message]}
					/>
				))}
			</Terminal>
		);
	};

	const tabs = [
		{
			value: "data",
			name: "Data",
			label: (
				<span className="flex items-center gap-1.5">
					Data
					<span className="text-muted-foreground tabular-nums">
						{(counts.nodes + counts.relationships).toLocaleString()}
					</span>
				</span>
			),
			content: (
				<DataTab
					items={items}
					place={data}
					onOpenData={onOpenData}
					onSelectElement={onSelectElement}
				/>
			),
		},
		{
			value: "queries",
			name: "Queries",
			label: (
				<span className="flex items-center gap-1.5">
					Queries
					<span className="text-muted-foreground tabular-nums">
						{queries.length}
					</span>
				</span>
			),
			content: open ? (
				<div className="flex h-full min-h-0 flex-col">
					<div className="flex items-center border-b border-border px-1 py-0.5">
						<Button variant="ghost" size="sm" onClick={() => onOpenQueries()}>
							<ChevronLeft aria-hidden />
							All queries
						</Button>
						<span className="flex-1" />
						{onRerun ? (
							<Button
								variant="ghost"
								size="sm"
								disabled={isRunning || open.status === "running"}
								onClick={() => onRerun(open.messageId)}
							>
								<Play aria-hidden />
								Re-run
							</Button>
						) : null}
					</div>
					<div className="min-h-0 flex-1 overflow-auto">{detail(open)}</div>
				</div>
			) : (
				<div className="h-full overflow-auto">
					<QueryList queries={queries} onOpen={(id) => onOpenQueries(id)} />
				</div>
			),
		},
	];

	return (
		<TabbedPanel
			className="h-full"
			tabs={tabs}
			activeTab={tab}
			onTabChange={(v) => (v === "data" ? onOpenData() : onOpenQueries())}
			headerActions={[
				{
					name: "Collapse the console",
					icon: ChevronDown,
					onClick: onCollapse,
				},
			]}
		/>
	);
}
