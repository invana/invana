/**
 * A run › **Overview** — its numbers, one reading for any size.
 *
 * - **Up to 50 agents**: tiles Elapsed · Tokens · Agents · Steps · Assets ·
 *   Records touched; *Agents over time*, a bar per agent with its state in
 *   words; *Steps a minute*; *Waiting on you*.
 * - **Past 50 agents** (the engine's `large`): tiles Agents · Live · Queued ·
 *   Finishing a minute · Tokens · ETA; *Agents finished a minute*; *Agents
 *   live* against the live limit; *By role*.
 *
 * Every figure is the engine's — tiles, bars, per-minute counts, the ETA and
 * the per-role p50 and p95. A run still going draws its bars open-ended
 * against a live clock.
 */

import { LineChart, StackedBarChartV } from "@invana/charts";
import {
	Button,
	Gantt,
	type GanttRow,
	type GanttStatus,
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemTitle,
	MetricGrid,
	MetricTile,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { formatElapsed } from "@invana-studio/core";
import { PanelSection } from "@invana-studio/ui";
import { useAgentsOpen } from "../../open";
import { ms, spreadTicks, tokens } from "../../overview/fleetParts";
import { clock } from "../runParts";
import type { AgentBar, MinuteCount, RunOverview, RunTiles } from "../types";

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

export function OverviewTab({
	overview,
	live,
}: {
	overview: RunOverview;
	/** Still going — the bars stay open-ended against now. */
	live: boolean;
}) {
	return overview.large ? (
		<LargeOverview overview={overview} />
	) : (
		<SmallOverview overview={overview} live={live} />
	);
}

// ── Up to 50 agents ──────────────────────────────────────────────────────────

function SmallOverview({
	overview,
	live,
}: {
	overview: RunOverview;
	live: boolean;
}) {
	const t = overview.tiles;
	return (
		<div className="flex flex-col gap-3 p-3">
			<SmallTiles t={t} live={live} />
			<PanelSection
				card
				title="Agents over time"
				action={
					<span className="text-sm text-muted-foreground">a bar per agent</span>
				}
			>
				<AgentsOverTime
					bars={overview.agents_over_time}
					origin={overview.head.started_at}
					live={live}
				/>
			</PanelSection>
			<div className="grid gap-3 lg:grid-cols-2">
				<PanelSection card title="Steps a minute">
					<PerMinute
						counts={overview.steps_per_minute}
						label="steps"
						empty="No step has run yet"
					/>
				</PanelSection>
				<WaitingOnYou overview={overview} />
			</div>
		</div>
	);
}

function SmallTiles({ t, live }: { t: RunTiles; live: boolean }) {
	const made = [
		t.files ? plural(t.files, "file") : null,
		t.branches ? plural(t.branches, "branch") : null,
	].filter(Boolean);
	return (
		<MetricGrid minTileWidth={150}>
			<MetricTile
				label="Elapsed"
				value={ms(t.elapsed_ms)}
				caption={[
					live ? "so far" : null,
					t.time_limit_ms != null ? `limit ${ms(t.time_limit_ms)} a run` : null,
				]
					.filter(Boolean)
					.join(" · ")}
				captionTone="muted"
			/>
			<MetricTile
				label="Tokens"
				value={tokens(t.tokens)}
				caption={
					t.max_tokens_run != null
						? `of ${tokens(t.max_tokens_run)}`
						: undefined
				}
				captionTone="muted"
				meter={
					t.max_tokens_run
						? Math.min(1, t.tokens / t.max_tokens_run)
						: undefined
				}
			/>
			<MetricTile
				label="Agents"
				value={t.agents}
				caption={`depth ${t.depth}`}
				captionTone="muted"
			/>
			<MetricTile
				label="Steps"
				value={t.steps}
				caption={t.redelivered ? `${t.redelivered} redelivered` : undefined}
				captionTone="muted"
			/>
			<MetricTile
				label="Assets"
				value={t.assets}
				caption={made.length ? made.join(" · ") : undefined}
				captionTone="muted"
			/>
			<MetricTile
				label="Records touched"
				value={t.records_touched.toLocaleString()}
				caption={
					t.writes_refused
						? `${plural(t.writes_refused, "write")} refused`
						: undefined
				}
				captionTone={t.writes_refused ? "warning" : "muted"}
			/>
		</MetricGrid>
	);
}

/** An agent's status, or its exit reason, as the bar draws it. */
function barStatus(bar: AgentBar): GanttStatus {
	const why = bar.exit_reason;
	if (why === "served") return "succeeded";
	if (why === "parent_ended" || why === "stopped") return "stopped";
	if (why) return "failed";
	switch (bar.status) {
		case "queued":
			return "queued";
		case "running":
			return "running";
		case "awaiting_input":
		case "awaiting_approval":
		case "needs_input":
			return "needs_input";
		case "succeeded":
			return "succeeded";
		case "failed":
			return "failed";
		default:
			return "stopped";
	}
}

function AgentsOverTime({
	bars,
	origin,
	live,
}: {
	bars: AgentBar[];
	origin: string | null;
	live: boolean;
}) {
	if (!bars.length)
		return <p className="text-muted-foreground">No agent has started yet.</p>;
	const rows: GanttRow[] = bars.map((bar) => ({
		key: bar.run_id,
		label: bar.agent_name,
		startedAt: bar.started_at ?? undefined,
		finishedAt: bar.finished_at ?? undefined,
		status: barStatus(bar),
		duration: bar.state_line,
	}));
	const zero = origin ? new Date(origin).getTime() : null;
	return (
		<Gantt
			rows={rows}
			origin={origin ?? undefined}
			nowMs={live && zero != null ? Date.now() - zero : undefined}
			openEnded={live}
			formatTick={(offset) =>
				zero != null
					? clock(new Date(zero + offset).toISOString())
					: formatElapsed(offset)
			}
			showDetail={false}
		/>
	);
}

function PerMinute({
	counts,
	label,
	empty,
}: {
	counts: MinuteCount[];
	label: string;
	empty: string;
}) {
	// The chart's scale, not a figure on screen: the tallest minute.
	const top = Math.max(1, ...counts.map((c) => c.count));
	return (
		<StackedBarChartV
			max={top}
			gridlines={[Math.ceil(top / 2), top]}
			ticks={spreadTicks(counts.length)}
			series={[{ key: "n", label, color: "var(--color-success)" }]}
			data={counts.map((c) => ({
				label: clock(c.minute),
				values: { n: c.count },
			}))}
			empty={empty}
		/>
	);
}

/** The run's pending asks; one routed to the reader opens Approvals › Waiting. */
function WaitingOnYou({ overview }: { overview: RunOverview }) {
	const open = useAgentsOpen();
	return (
		<PanelSection card title="Waiting on you">
			{overview.waiting.length ? (
				<ItemGroup>
					{overview.waiting.map((ask) => (
						<Item key={ask.approval_id} size="sm">
							<ItemContent>
								<ItemTitle className="capitalize">{ask.kind}</ItemTitle>
								<ItemDescription>{ask.line}</ItemDescription>
							</ItemContent>
							{ask.for_you ? (
								<ItemActions>
									<Button
										size="sm"
										variant="outline"
										onClick={() => open.section("approvals", "waiting")}
									>
										Review
									</Button>
								</ItemActions>
							) : null}
						</Item>
					))}
				</ItemGroup>
			) : (
				<p className="py-2 text-muted-foreground">Nothing is waiting on you.</p>
			)}
		</PanelSection>
	);
}

// ── Past 50 agents ───────────────────────────────────────────────────────────

function LargeOverview({ overview }: { overview: RunOverview }) {
	const t = overview.tiles;
	return (
		<div className="flex flex-col gap-3 p-3">
			<MetricGrid minTileWidth={150}>
				<MetricTile
					label="Agents"
					value={t.agents}
					caption={`${t.served} served · ${t.not_served} not`}
					captionTone="muted"
				/>
				<MetricTile
					label="Live"
					value={t.live}
					caption={t.live_limit != null ? `limit ${t.live_limit}` : undefined}
					captionTone="muted"
				/>
				<MetricTile
					label="Queued"
					value={t.queued}
					caption={t.queued === 0 ? "all made" : undefined}
					captionTone="muted"
				/>
				<MetricTile
					label="Finishing a minute"
					value={t.finishing_per_minute}
					caption={
						t.peak_finishing
							? `peak ${t.peak_finishing} at ${clock(t.peak_finishing_at)}`
							: undefined
					}
					captionTone="muted"
				/>
				<MetricTile
					label="Tokens"
					value={tokens(t.tokens)}
					caption={[
						t.max_tokens_run != null ? `of ${tokens(t.max_tokens_run)}` : null,
						t.tokens_per_minute
							? `~${tokens(t.tokens_per_minute)} a minute`
							: null,
					]
						.filter(Boolean)
						.join(" · ")}
					captionTone="muted"
					meter={
						t.max_tokens_run
							? Math.min(1, t.tokens / t.max_tokens_run)
							: undefined
					}
				/>
				<MetricTile
					label="ETA"
					value={t.eta_s != null ? `~${formatElapsed(t.eta_s * 1000)}` : "—"}
					caption={
						t.eta_s != null
							? "at this rate"
							: "nothing finished in the last ten minutes"
					}
					captionTone="muted"
				/>
			</MetricGrid>
			<div className="grid gap-3 lg:grid-cols-2">
				<PanelSection card title="Agents finished a minute">
					<PerMinute
						counts={overview.finished_per_minute}
						label="finished"
						empty="No agent has finished yet"
					/>
				</PanelSection>
				<PanelSection card title="Agents live">
					<LineChart
						values={overview.live_over_time.map((c) => c.count)}
						labels={overview.live_over_time.map((c) => clock(c.minute))}
						ticks={spreadTicks(overview.live_over_time.length)}
						reference={
							t.live_limit != null
								? { value: t.live_limit, label: `live limit ${t.live_limit}` }
								: undefined
						}
						empty="No agent is live yet"
					/>
				</PanelSection>
			</div>
			<PanelSection card title="By role">
				<Table bordered={false} density="compact">
					<TableHeader>
						<TableRow>
							<TableHead>Role</TableHead>
							<TableHead>Agents</TableHead>
							<TableHead>Served</TableHead>
							<TableHead>Not served</TableHead>
							<TableHead>Tokens p50</TableHead>
							<TableHead>p95</TableHead>
							<TableHead>Time p95</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{overview.by_role.map((r) => (
							<TableRow key={`${r.depth}:${r.role}`}>
								<TableCell className="w-full">{r.role}</TableCell>
								<TableCell className="font-mono">{r.agents}</TableCell>
								<TableCell className="font-mono">{r.served}</TableCell>
								<TableCell className="font-mono">{r.not_served}</TableCell>
								<TableCell className="font-mono">
									{tokens(r.tokens_p50)}
								</TableCell>
								<TableCell className="font-mono">
									{tokens(r.tokens_p95)}
								</TableCell>
								<TableCell className="font-mono">{ms(r.time_p95_ms)}</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</PanelSection>
		</div>
	);
}
