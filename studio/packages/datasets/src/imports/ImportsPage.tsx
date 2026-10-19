/**
 * **Imports** — every load into every Graph the person can read, live and
 * past, at `/datasets/imports` (datasets.md DS-13, board `datasets.imports`).
 *
 * Imports run from the CLI and the API; Studio has no upload. This page
 * watches them: the command to start one, tiles over the last thirty days,
 * the timeline of loads a day, and the journal — runs of kind `import` and
 * `bulk`, newest first, each naming the Graph it landed in. A row opens the
 * run's own page in that Graph's Activity, which carries its steps, log and
 * what it touched.
 *
 * Read-only: nothing here writes. It draws only what a run list row carries,
 * so records written and rejected are left to the run's page.
 */

import { BarChartV } from "@invana/charts";
import {
	Badge,
	Button,
	EmptyState,
	MetricGrid,
	MetricTile,
	RecordHeader,
	Spinner,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Terminal,
	TerminalLine,
} from "@invana/ui";
import { formatElapsed, useTicker } from "@invana-studio/core";
import { activityPath } from "@invana-studio/shell";
import { PanelSection } from "@invana-studio/ui";
import { RefreshCw, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
	type ImportRow,
	importStats,
	importsByDay,
	WINDOW_DAYS,
} from "./journal";
import { useImportsJournal } from "./queries";

const IMPORT_COMMAND =
	"invana records import --graph <owner>/<graph> --model <model> --name <name> --path <folder>";

/** A run's status word and the token it is inked in. */
function toneOf(status: string): string {
	switch (status) {
		case "succeeded":
			return "text-success";
		case "running":
		case "queued":
			return "text-info";
		case "failed":
			return "text-destructive";
		default:
			return "text-muted-foreground";
	}
}

function dayLabel(ms: number): string {
	return new Date(ms).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
	});
}

/** `Oct 11, 12:19` — the day and the minute; the full stamp is on hover. */
function startedLabel(iso: string): string {
	return new Date(iso).toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

/** The engine's stored duration; an import still running ticks from its start. */
function elapsedOf(row: ImportRow, now: number): number | null {
	const { started_at, finished_at, duration_ms } = row.run;
	if (duration_ms != null) return duration_ms;
	if (!started_at || finished_at) return null;
	return Math.max(0, now - Date.parse(started_at));
}

function CommandHint() {
	return (
		<Terminal>
			<TerminalLine kind="comment">
				Bring data in from the CLI — records are validated against the model you
				name; what fails is reported, not written.
			</TerminalLine>
			<TerminalLine kind="prompt">{IMPORT_COMMAND}</TerminalLine>
		</Terminal>
	);
}

function Timeline({ rows, now }: { rows: ImportRow[]; now: number }) {
	const days = importsByDay(rows, now);
	const last = days.length - 1;
	return (
		<BarChartV
			height={80}
			highlightIndex={null}
			labelMode="none"
			data={days.map((d, i) => ({
				// Only the window's ends are named; thirty dates would be texture.
				label: i === 0 || i === last ? dayLabel(d.day) : "",
				value: d.count,
				display: `${d.count} import${d.count === 1 ? "" : "s"}`,
			}))}
		/>
	);
}

export function ImportsPage() {
	const navigate = useNavigate();
	const journal = useImportsJournal();
	const stats = importStats(journal.rows, Date.now());
	// A running row's elapsed moves; the ticker keeps it honest.
	const now = useTicker(stats.live > 0);

	return (
		<div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3">
			<RecordHeader
				crumbs={["Imports"]}
				chips={
					<>
						{stats.live ? (
							<Badge variant="outline" tone="info" size="xs">
								{stats.live} running
							</Badge>
						) : null}
						{stats.failed ? (
							<Badge variant="outline" tone="destructive" size="xs">
								{stats.failed} failed
							</Badge>
						) : null}
					</>
				}
				actions={
					<Button
						variant="ghost"
						size="icon-xs"
						aria-label="Refresh"
						onClick={journal.refetch}
					>
						<RefreshCw
							className={journal.isFetching ? "animate-spin" : undefined}
						/>
					</Button>
				}
			/>

			<CommandHint />

			<MetricGrid minTileWidth={160}>
				<MetricTile
					label="Imports"
					value={stats.total}
					caption={`last ${WINDOW_DAYS} days`}
				/>
				<MetricTile
					label="Running"
					value={stats.live}
					tone={stats.live ? "running" : undefined}
					caption={stats.live ? "steps paint as they run" : "nothing loading"}
				/>
				<MetricTile
					label="Failed"
					value={stats.failed}
					tone={stats.failed ? "error" : undefined}
					caption={`last ${WINDOW_DAYS} days`}
				/>
				<MetricTile
					label="Median time"
					value={stats.medianMs === null ? "—" : formatElapsed(stats.medianMs)}
					caption="of the loads that finished"
				/>
			</MetricGrid>

			<PanelSection card title="Imports a day">
				<Timeline rows={journal.rows} now={now} />
			</PanelSection>

			<PanelSection
				card
				title="Imports — newest first"
				action={
					<span className="text-muted-foreground">
						{journal.unreadable
							? `${journal.unreadable} of ${journal.graphCount} Graphs could not be read`
							: `across ${journal.graphCount} Graph${journal.graphCount === 1 ? "" : "s"}`}
					</span>
				}
			>
				{journal.isLoading ? (
					<Spinner />
				) : !journal.rows.length ? (
					<EmptyState
						icon={<Upload className="size-6" />}
						title="Nothing has been imported yet"
						description="An import loads a folder of records into a Graph's model from the CLI or the API. Run the command above; the load shows here as it runs."
					/>
				) : (
					<Table bordered={false} density="compact">
						<TableHeader>
							<TableRow>
								<TableHead>What it loaded</TableHead>
								<TableHead>Graph</TableHead>
								<TableHead>Kind</TableHead>
								<TableHead>Started</TableHead>
								<TableHead>Elapsed</TableHead>
								<TableHead>Status</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{journal.rows.map((row) => {
								const elapsed = elapsedOf(row, now);
								return (
									<TableRow
										key={`${row.graph.username}/${row.graph.graphSlug}/${row.id}`}
										onClick={() =>
											navigate(activityPath(row.graph, "runs", row.id))
										}
										className="cursor-pointer"
									>
										<TableCell
											title={row.title}
											className="w-full max-w-0 truncate"
										>
											{row.title}
										</TableCell>
										<TableCell>{row.graph.name}</TableCell>
										<TableCell>
											<Badge variant="secondary" size="xs">
												{row.kind === "bulk" ? "bulk load" : "import"}
											</Badge>
										</TableCell>
										<TableCell
											className="whitespace-nowrap font-mono"
											title={row.queuedAt ?? undefined}
										>
											{row.queuedAt ? startedLabel(row.queuedAt) : "—"}
										</TableCell>
										<TableCell className="font-mono">
											{elapsed === null ? "—" : formatElapsed(elapsed)}
										</TableCell>
										<TableCell className={toneOf(row.status)}>
											{row.status}
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				)}
			</PanelSection>
		</div>
	);
}
