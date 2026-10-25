/**
 * **Fleet** — every agent in the Graph: how it is doing, what it needs from
 * you, and how it is wired, at `/agents/fleet` (the-agents-shell.md › Fleet).
 *
 * Three tabs, each the path's last segment:
 *
 * - **Overview** (`/agents/fleet`) — the fleet dashboard: tiles for the
 *   agents, runs today, served over 7 days, tokens this month and what waits
 *   on you; *Needs attention* beside *Runs a day*; the *Agents* card
 *   ({@link FleetAgentsCard}) beside *Changed recently*. On a Graph nothing
 *   has run on, *Start here* takes their place above the *Agents* card: ask
 *   the assistant to build an agent, or write a skill first.
 * - **Map** (`/agents/fleet/map`) — agents → skills → function namespaces
 *   ({@link FleetMap}).
 * - **Table** (`/agents/fleet/table`) — every agent's or skill's numbers over
 *   7 days ({@link FleetTable}).
 *
 * *New agent* in the head makes a draft agent and opens it on its builder.
 * Otherwise nothing is decided here: every act opens the place it already lives — a
 * run, an agent or Performance as a workbook tab, Activity › Approvals, the
 * change log's compare. Every number comes from the engine's fleet read.
 * Tokens, never currency.
 */

import { StackedBarChartV } from "@invana/charts";
import {
	Badge,
	Button,
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemTitle,
	MetricGrid,
	MetricTile,
} from "@invana/ui";
import {
	approvalsPath,
	comparePath,
	useRightSection,
} from "@invana-studio/shell";
import { PanelSection } from "@invana-studio/ui";
import { Pencil, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { NewAgentButton } from "../agents/NewAgentButton";
import { type AgentsOpen, useAgentsOpen } from "../open";
import {
	changeText,
	changeTone,
	day,
	FleetReadState,
	pct,
	spreadTicks,
	TONE_TEXT,
	tokens,
} from "../overview/fleetParts";
import { SectionBody, SectionPage } from "../sections/SectionPage";
import type { SectionPageProps } from "../sections/spec";
import { useFleetAgentRows } from "./agentRows";
import { FleetAgentsCard } from "./FleetAgentsCard";
import { FleetMap } from "./FleetMap";
import { FleetTable } from "./FleetTable";
import { useFleetOverviewQuery, useFleetPerformanceQuery } from "./queries";
import type {
	AttentionItem,
	DayCount,
	FleetOverview,
	OverviewTiles,
	RecentChange,
} from "./types";

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

interface Graph {
	username: string;
	graphSlug: string;
}

export function FleetSectionPage({
	username,
	graphSlug,
	tab,
	onTab,
}: SectionPageProps) {
	const overview = useFleetOverviewQuery(username, graphSlug);
	const data = overview.data;
	const graph = { username, graphSlug };

	return (
		<SectionPage
			section="fleet"
			tab={tab}
			onTab={onTab}
			actions={<NewAgentButton username={username} graphSlug={graphSlug} />}
			chips={
				data ? (
					<Badge variant="outline" tone="muted" size="xs">
						{plural(data.agents, "agent")} · {plural(data.skills, "skill")}
					</Badge>
				) : null
			}
		>
			{tab === "map" ? (
				<FleetMap {...graph} />
			) : tab === "table" ? (
				<SectionBody>
					<FleetTable {...graph} overview={data} />
				</SectionBody>
			) : (
				<SectionBody>
					{data ? (
						<OverviewBody data={data} graph={graph} />
					) : (
						<FleetReadState
							loading={overview.isLoading}
							error={overview.error}
							what="the fleet"
						/>
					)}
				</SectionBody>
			)}
		</SectionPage>
	);
}

function OverviewBody({ data, graph }: { data: FleetOverview; graph: Graph }) {
	const agents = useFleetAgentRows(graph.username, graph.graphSlug);
	// The longest window Performance reads, and the one before it: no runs in
	// either is a Graph nothing has run on yet.
	const longest = useFleetPerformanceQuery(
		graph.username,
		graph.graphSlug,
		"90d",
	).data?.tiles.runs;
	const nothingRan = longest != null && !longest.value && !longest.prior;
	const agentsCard = (
		<FleetAgentsCard
			rows={agents.rows}
			loading={agents.loading}
			error={agents.error}
		/>
	);
	return (
		<>
			<Tiles
				agents={data.agents}
				helpers={agents.page?.ephemeral}
				tiles={data.tiles}
			/>
			{nothingRan ? (
				// Nothing to attend to, chart or compare yet.
				<>
					<StartHere />
					{agentsCard}
				</>
			) : (
				<>
					<div className="grid gap-3 lg:grid-cols-2">
						<NeedsAttention items={data.attention} graph={graph} />
						<RunsADay daily={data.daily} />
					</div>
					<div className="grid gap-3 lg:grid-cols-3">
						<div className="min-w-0 lg:col-span-2">{agentsCard}</div>
						<ChangedRecently changes={data.changes} graph={graph} />
					</div>
				</>
			)}
		</>
	);
}

function Tiles({
	agents,
	helpers,
	tiles: t,
}: {
	agents: number;
	/** Spawned helpers the Agents list counts; undefined until it is read. */
	helpers: number | undefined;
	tiles: OverviewTiles;
}) {
	// Today's weekday is the one a week ago.
	const weekday = new Date().toLocaleDateString(undefined, {
		weekday: "long",
	});
	return (
		<MetricGrid minTileWidth={160}>
			<MetricTile
				label="Agents"
				value={agents}
				caption={
					helpers == null ? undefined : plural(helpers, "spawned helper")
				}
				captionTone="muted"
			/>
			<MetricTile
				label="Runs today"
				value={t.runs_today}
				caption={
					t.runs_change == null
						? t.runs_week_ago === 0
							? `none last ${weekday}`
							: undefined
						: `${changeText(t.runs_change)} on last ${weekday}`
				}
				captionTone="muted"
			/>
			<MetricTile
				label="Served · 7 days"
				value={pct(t.success.value)}
				caption={
					t.success.change
						? `${changeText(t.success.change)} on the 7 days before`
						: undefined
				}
				captionTone={changeTone(t.success.change)}
			/>
			<MetricTile
				label="Tokens this month"
				value={tokens(t.tokens_this_month)}
				caption={
					t.max_tokens_month == null
						? "no live agent"
						: `of ${tokens(t.max_tokens_month)}`
				}
				captionTone="muted"
				meter={
					t.max_tokens_month
						? Math.min(1, t.tokens_this_month / t.max_tokens_month)
						: undefined
				}
			/>
			<MetricTile
				label="Waiting on you"
				value={t.waiting}
				caption={t.waiting_latest ?? "nobody waiting"}
				captionTone={t.waiting > 0 ? "warning" : "muted"}
			/>
		</MetricGrid>
	);
}

/**
 * A Graph nothing has run on: the two ways in. The assistant drafts an agent
 * on the right; a skill is written first in Skills.
 */
function StartHere() {
	const right = useRightSection();
	const open = useAgentsOpen();
	return (
		<PanelSection card title="Start here">
			<div className="flex flex-col gap-2 py-1">
				<p className="text-muted-foreground">
					Nothing has run on this Graph yet. Tell the assistant what an agent
					should do and it drafts one for you to review — or write the skill it
					will be offered first.
				</p>
				<div className="flex flex-wrap gap-2">
					<Button size="sm" onClick={() => right.open("assistant")}>
						<Sparkles />
						Ask the assistant to build one
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => open.section("skills")}
					>
						<Pencil />
						Write a skill first
					</Button>
				</div>
			</div>
		</PanelSection>
	);
}

/** The act that answers an item: a tab it opens, or a path it moves to. */
function attentionAct(
	item: AttentionItem,
	graph: Graph,
	open: AgentsOpen,
): { label: string; act: () => void } | { label: string; to: string } | null {
	switch (item.kind) {
		case "failing": {
			const runId = item.run_id;
			return runId ? { label: "Open run", act: () => open.run(runId) } : null;
		}
		case "waiting":
			return { label: "Review", to: approvalsPath(graph) };
		case "degraded":
			return {
				label: "Investigate",
				act: () => open.section("performance"),
			};
		default:
			return null;
	}
}

function NeedsAttention({
	items,
	graph,
}: {
	items: AttentionItem[];
	graph: Graph;
}) {
	const navigate = useNavigate();
	const open = useAgentsOpen();
	return (
		<PanelSection
			card
			title="Needs attention"
			action={
				<span className="text-sm text-muted-foreground">{items.length}</span>
			}
		>
			{items.length ? (
				<ItemGroup>
					{items.map((item) => {
						const act = attentionAct(item, graph, open);
						return (
							<Item
								key={`${item.kind}:${item.approval_id ?? item.run_id ?? item.agent_id ?? item.title}`}
								size="sm"
							>
								<ItemContent>
									<ItemTitle>{item.title}</ItemTitle>
									<ItemDescription>{item.detail}</ItemDescription>
								</ItemContent>
								{act ? (
									<ItemActions>
										<Button
											variant="outline"
											size="sm"
											onClick={() =>
												"act" in act ? act.act() : navigate(act.to)
											}
										>
											{act.label}
										</Button>
									</ItemActions>
								) : null}
							</Item>
						);
					})}
				</ItemGroup>
			) : (
				<p className="py-2 text-muted-foreground">Nothing needs attention</p>
			)}
		</PanelSection>
	);
}

function RunsADay({ daily }: { daily: DayCount[] }) {
	// The chart's scale, not a figure on screen: the tallest day's stack.
	const top = Math.max(1, ...daily.map((d) => d.succeeded + d.failed));
	return (
		<PanelSection
			card
			title="Runs a day"
			action={
				<span className="text-sm text-muted-foreground">
					succeeded vs failed
				</span>
			}
		>
			<StackedBarChartV
				max={top}
				gridlines={[Math.ceil(top / 2), top]}
				ticks={spreadTicks(daily.length)}
				series={[
					{
						key: "succeeded",
						label: "succeeded",
						color: "var(--color-success)",
					},
					{ key: "failed", label: "failed", color: "var(--color-destructive)" },
				]}
				data={daily.map((d) => ({
					label: day(d.date),
					values: { succeeded: d.succeeded, failed: d.failed },
				}))}
				empty="Nothing ran in the last 30 days"
			/>
		</PanelSection>
	);
}

/** `p95 ▲ 62% since`, or the runs and failures when too few ran to say. */
function ChangeEffect({ change: c }: { change: RecentChange }) {
	if (c.p95_change != null) {
		return (
			<span className={TONE_TEXT[changeTone(c.p95_change)]}>
				p95 {changeText(c.p95_change, ["▲", "▼"])}
				{c.p95_change.direction === "flat" ? "" : " since"}
			</span>
		);
	}
	return (
		<span>
			{plural(c.runs, "run")} · {c.failed} failed
		</span>
	);
}

function ChangedRecently({
	changes,
	graph,
}: {
	changes: RecentChange[];
	graph: Graph;
}) {
	const navigate = useNavigate();
	const open = useAgentsOpen();
	return (
		<PanelSection
			card
			title="Changed recently"
			action={
				<span className="text-sm text-muted-foreground">
					with what happened after
				</span>
			}
		>
			{changes.length ? (
				<ItemGroup>
					{changes.map((c) => {
						const meta = [
							c.actor_name,
							c.at ? day(c.at) : null,
							c.summary || null,
						].filter(Boolean);
						return (
							<Item
								key={`${c.record_kind}:${c.record_id}:${c.version}`}
								size="sm"
							>
								<ItemContent>
									<ItemTitle>
										{c.name}{" "}
										{c.previous != null
											? `v${c.previous} → v${c.version}`
											: `v${c.version}`}
									</ItemTitle>
									<ItemDescription>
										{meta.map((m) => `${m} · `).join("")}
										<ChangeEffect change={c} />
									</ItemDescription>
								</ItemContent>
								<ItemActions>
									{c.record_kind === "skill" ? (
										c.previous != null && (
											<Button
												variant="outline"
												size="sm"
												onClick={() =>
													navigate(
														comparePath(graph, "skill", c.record_id, {
															a: c.previous,
															b: c.version,
														}),
													)
												}
											>
												Compare
											</Button>
										)
									) : (
										<Button
											variant="outline"
											size="sm"
											onClick={() => open.agent(c.record_id)}
										>
											{c.previous != null ? "History" : "Open"}
										</Button>
									)}
								</ItemActions>
							</Item>
						);
					})}
				</ItemGroup>
			) : (
				<p className="py-2 text-muted-foreground">Nothing changed yet</p>
			)}
		</PanelSection>
	);
}
