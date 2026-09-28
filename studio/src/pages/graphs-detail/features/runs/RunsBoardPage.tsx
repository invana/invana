/**
 * **Runs, drawn wide** — the journal as a page in `mainSection`, opened from
 * `Dashboard` on the Runs panel's header (see-what-ran.md SR70 ·
 * `operate.runs.list`).
 *
 * The panel and this page read **one query under one set of chips**, so the
 * list beside it and the table here never disagree. What the page adds is
 * what 420px cannot hold: tiles over the whole journal, and a column per fact
 * the panel's row line packs into one string.
 *
 * It draws only what `GET …/runs` carries. *World* is not on a list row and
 * there is no daily allocation, so neither is drawn — a column of dashes or a
 * bar against a made-up ceiling would both be claims the record cannot back.
 */

import { useTicker } from "@/hooks/useTicker";
import { formatCompact } from "@/lib/format";
import { formatElapsed } from "@/lib/time";
import { usd } from "@/pages/graphs-detail/features/agents/agentDraft";
import { useAgentsQuery } from "@/pages/graphs-detail/features/agents/queries";
import { RunsFilterBar } from "@/pages/graphs-detail/features/runs/RunsFilterBar";
import {
	elapsedOf,
	shortRunId,
} from "@/pages/graphs-detail/features/runs/RunsList";
import {
	type RunListRow,
	useRunListQuery,
} from "@/pages/graphs-detail/features/runs/queries";
import { useRunsFilters } from "@/pages/graphs-detail/features/runs/useRunsFilters";
import { useRunsViewPanel } from "@/pages/graphs-detail/shell/useRunsViewPanel";
import { PanelSection } from "@/ui/PanelSection";
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
} from "@invana/ui";
import { RefreshCw } from "lucide-react";

const LIVE = ["queued", "running", "awaiting_input", "awaiting_approval"];
const WAITING = ["awaiting_input", "awaiting_approval"];

/** How a run stands, in the engine's word and the tone that word carries. */
function statusOf(row: RunListRow): { text: string; tone: string } {
	const t = row.run;
	if (t.outcome === "cannot_answer")
		return { text: "cannot_answer", tone: "text-warning" };
	switch (t.status) {
		case "succeeded":
			return { text: t.status, tone: "text-success" };
		case "running":
			return { text: t.status, tone: "text-info" };
		case "failed":
			return { text: t.status, tone: "text-destructive" };
		case "awaiting_input":
		case "awaiting_approval":
			return { text: t.status, tone: "text-warning" };
		default:
			return { text: t.status, tone: "text-muted-foreground" };
	}
}

function startOfToday(): number {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

function Tiles({ rows, now }: { rows: RunListRow[]; now: number }) {
	const inFlight = rows.filter((r) => LIVE.includes(r.status));
	const waiting = inFlight.filter((r) => WAITING.includes(r.status)).length;

	const cutoff = startOfToday();
	const today = rows.filter(
		(r) => r.startedAt !== null && Date.parse(r.startedAt) >= cutoff,
	);
	const succeeded = today.filter((r) => r.status === "succeeded").length;
	const cannot = today.filter((r) => r.run.outcome === "cannot_answer").length;

	// Absent is not zero: a day with no priced run draws a dash (AG11).
	const priced = today.filter((r) => r.run.cost_usd != null);
	const spent = priced.reduce((sum, r) => sum + (r.run.cost_usd ?? 0), 0);

	let slowest: { row: RunListRow; ms: number } | null = null;
	for (const row of today) {
		const ms = elapsedOf(row, now);
		if (ms !== null && (!slowest || ms > slowest.ms)) slowest = { row, ms };
	}

	return (
		<MetricGrid minTileWidth={160}>
			<MetricTile
				label="In flight"
				value={inFlight.length}
				tone={inFlight.length ? "running" : undefined}
				caption={
					waiting
						? `${waiting === 1 ? "one is" : `${waiting} are`} waiting on a person`
						: "none waiting on a person"
				}
			/>
			<MetricTile
				label="Today"
				value={`${today.length} run${today.length === 1 ? "" : "s"}`}
				caption={[
					`${succeeded} succeeded`,
					...(cannot ? [`${cannot} cannot_answer`] : []),
				].join(" · ")}
			/>
			<MetricTile
				label="Spent today"
				value={priced.length ? usd(spent) : "—"}
				caption={
					priced.length
						? `across ${priced.length} priced run${priced.length === 1 ? "" : "s"}`
						: "nothing priced today"
				}
			/>
			<MetricTile
				label="Slowest"
				value={slowest ? formatElapsed(slowest.ms) : "—"}
				tone={slowest ? "warning" : undefined}
				caption={slowest ? slowest.row.title : "nothing has run today"}
			/>
		</MetricGrid>
	);
}

export interface RunsBoardPageProps {
	username: string;
	graphSlug: string;
}

export function RunsBoardPage({ username, graphSlug }: RunsBoardPageProps) {
	const { runId, openRun } = useRunsViewPanel();
	const { filters, patch } = useRunsFilters();
	const journal = useRunListQuery(username, graphSlug, filters);
	// The tiles read the whole fetched journal — the same query key, so no
	// second request — while the table reads what the chips leave.
	const all = useRunListQuery(username, graphSlug);
	const agentList = useAgentsQuery(username, graphSlug).data?.items ?? [];
	const agentName = new Map(agentList.map((a) => [a.id, a.name]));
	// A running row's elapsed moves; the ticker keeps it honest.
	const now = useTicker(journal.live > 0);

	const filtered = Object.values(filters).some(Boolean);

	return (
		<div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3">
			<RecordHeader
				crumbs={["Runs"]}
				chips={
					<>
						<Badge variant="outline" size="xs">
							{journal.total}
						</Badge>
						{journal.live ? (
							<Badge variant="outline" tone="info" size="xs">
								{journal.live} running
							</Badge>
						) : null}
					</>
				}
				actions={
					<Button
						variant="ghost"
						size="icon-xs"
						aria-label="Refresh"
						onClick={() => void journal.refetch()}
					>
						<RefreshCw
							className={journal.isFetching ? "animate-spin" : undefined}
						/>
					</Button>
				}
			/>
			<RunsFilterBar
				filters={filters}
				onChange={patch}
				agents={agentList.map((a) => ({ id: a.id, name: a.name }))}
			/>

			<Tiles rows={all.rows} now={now} />

			<PanelSection
				card
				title="Runs — newest first"
				action={
					<span className="text-muted-foreground">
						{journal.rows.length} of {journal.total} shown
					</span>
				}
			>
				{journal.isLoading ? (
					<Spinner />
				) : !journal.rows.length ? (
					<EmptyState
						title={
							filtered ? "No run matches these filters" : "Nothing has run yet"
						}
						description={
							filtered
								? "Clear a chip to widen the journal."
								: "An ask, a load, a stitch and an enrichment all land here as they run."
						}
					/>
				) : (
					<Table bordered={false} density="compact">
						<TableHeader>
							<TableRow>
								<TableHead>Run</TableHead>
								<TableHead>What it was about</TableHead>
								<TableHead>Kind</TableHead>
								<TableHead>Agent</TableHead>
								<TableHead>Elapsed</TableHead>
								<TableHead>Tokens</TableHead>
								<TableHead>Tasks</TableHead>
								<TableHead>Cost</TableHead>
								<TableHead>Status</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{journal.rows.map((row) => {
								const t = row.run;
								const elapsed = elapsedOf(row, now);
								const tokens = (t.tokens_in ?? 0) + (t.tokens_out ?? 0);
								const status = statusOf(row);
								return (
									<TableRow
										key={row.id}
										// A click drills the panel beside it into this run.
										onClick={() => openRun(row.id)}
										data-state={row.id === runId ? "selected" : undefined}
										className="cursor-pointer"
									>
										<TableCell className="font-mono">
											{shortRunId(row.id)}
										</TableCell>
										<TableCell
											// One line a row; the full text is the title attribute.
											title={row.title}
											className={`w-full max-w-0 truncate${row.isQuery ? " font-mono" : ""}`}
										>
											{row.title}
										</TableCell>
										<TableCell>
											<Badge variant="secondary" size="xs">
												{t.kind ?? "ask"}
											</Badge>
										</TableCell>
										<TableCell>
											{t.agent_id ? (agentName.get(t.agent_id) ?? "—") : "—"}
										</TableCell>
										<TableCell className="font-mono">
											{elapsed === null ? "—" : formatElapsed(elapsed)}
										</TableCell>
										<TableCell className="font-mono">
											{tokens > 0 ? formatCompact(tokens) : "—"}
										</TableCell>
										<TableCell className="font-mono">
											{t.steps_total > 0
												? `${t.steps_done}/${t.steps_total}`
												: "—"}
										</TableCell>
										<TableCell className="font-mono">
											{t.cost_usd == null ? "—" : `$${t.cost_usd.toFixed(3)}`}
										</TableCell>
										<TableCell className={status.tone}>{status.text}</TableCell>
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
