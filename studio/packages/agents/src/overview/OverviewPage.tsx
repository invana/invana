/**
 * **Overview** — what broke, what waits on a person, what slowed down and what
 * changed, across every agent and skill of a Graph, at `/agents/overview`
 * (board `agents.overview`, story AG-01).
 *
 * A full-width page: the host draws it as the whole `mainSection`, with no
 * `leftSection` beside it. Its regions, top to bottom:
 *
 * - **Header** — *Overview*, the `n agents · n skills` count, and *New agent*,
 *   which opens the Agents list's new-agent form.
 * - **Tiles** — runs today against the same weekday last week, failed today
 *   with the newest failure, waiting on a person with the newest, p95 run time
 *   over 7 days against the 7 before, tokens this month against the agents'
 *   month budgets, and success over 7 days.
 * - **Needs attention** beside **Runs a day** — each item carries the one act
 *   that answers it; the chart stacks succeeded over failed for 30 days.
 * - **Changed recently** — the newest agent and skill versions, who made them,
 *   and what ran on them after.
 *
 * Nothing is decided here: every act is a link to the place the act already
 * lives — Activity › Runs, Activity › Approvals, Performance, the change log's
 * compare, the agent's page. Every number comes from the engine's fleet read.
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
	RecordHeader,
} from "@invana/ui";
import { activityPath, comparePath } from "@invana-studio/shell";
import { PanelSection } from "@invana-studio/ui";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { FleetPageProps } from "../fleet/FleetPageProps";
import { useFleetOverviewQuery } from "../fleet/queries";
import type {
	AttentionItem,
	DayCount,
	FleetOverview,
	OverviewTiles,
	RecentChange,
} from "../fleet/types";
import {
	changeText,
	changeTone,
	day,
	FleetBody,
	FleetPage,
	FleetReadState,
	measureCaption,
	ms,
	pct,
	spreadTicks,
	TONE_TEXT,
	tokens,
} from "./fleetParts";

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** The agent's page, opened beside the Agents list. */
const agentPagePath = (
	{ username, graphSlug }: FleetPageProps,
	agentId: string,
) =>
	`/u/${username}/${graphSlug}/agents/agents?page=${encodeURIComponent(`agent:${agentId}`)}`;

export function OverviewPage(props: FleetPageProps) {
	const { username, graphSlug } = props;
	const navigate = useNavigate();
	const query = useFleetOverviewQuery(username, graphSlug);
	const data = query.data;

	return (
		<FleetPage>
			<RecordHeader
				size="lg"
				crumbs={["Overview"]}
				chips={
					data ? (
						<Badge variant="outline" tone="muted" size="xs">
							{plural(data.agents, "agent")} · {plural(data.skills, "skill")}
						</Badge>
					) : null
				}
				actions={
					<Button
						size="sm"
						onClick={() =>
							navigate(`/u/${username}/${graphSlug}/agents/agents/new`)
						}
					>
						<Plus />
						New agent
					</Button>
				}
			/>
			<FleetBody>
				{data ? (
					<OverviewBody data={data} graph={props} />
				) : (
					<FleetReadState
						loading={query.isLoading}
						error={query.error}
						what="the fleet"
					/>
				)}
			</FleetBody>
		</FleetPage>
	);
}

function OverviewBody({
	data,
	graph,
}: {
	data: FleetOverview;
	graph: FleetPageProps;
}) {
	return (
		<>
			<Tiles tiles={data.tiles} />
			<div className="grid gap-3 lg:grid-cols-2">
				<NeedsAttention items={data.attention} graph={graph} />
				<RunsADay daily={data.daily} />
			</div>
			<ChangedRecently changes={data.changes} graph={graph} />
		</>
	);
}

function Tiles({ tiles: t }: { tiles: OverviewTiles }) {
	// Today's weekday is the one a week ago.
	const weekday = new Date().toLocaleDateString(undefined, {
		weekday: "long",
	});
	const p95 = measureCaption(t.p95_ms, "7 days");
	const success = t.success.change;
	const successPt =
		success && success.direction !== "flat" ? ` · ${changeText(success)}` : "";

	return (
		<MetricGrid minTileWidth={160}>
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
				label="Failed"
				value={t.failed_today}
				caption={t.failed_latest ?? "none today"}
				captionTone={t.failed_today > 0 ? "error" : "muted"}
			/>
			<MetricTile
				label="Waiting on a person"
				value={t.waiting}
				caption={t.waiting_latest ?? "nobody waiting"}
				captionTone={t.waiting > 0 ? "warning" : "muted"}
			/>
			<MetricTile
				label="p95 run time"
				value={ms(t.p95_ms.value)}
				caption={p95.caption}
				captionTone={p95.tone}
			/>
			<MetricTile
				label="Tokens this month"
				value={tokens(t.tokens_this_month)}
				caption={
					t.max_tokens_month == null
						? "no month budget"
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
				label="Success rate"
				value={pct(t.success.value)}
				caption={`7 days${successPt}`}
				captionTone={
					t.success.value == null
						? "muted"
						: t.success.change?.tone === "worse"
							? "warning"
							: "success"
				}
			/>
		</MetricGrid>
	);
}

/** The act that answers an item, and where it goes. */
function attentionAct(
	item: AttentionItem,
	graph: FleetPageProps,
): { label: string; to: string } | null {
	switch (item.kind) {
		case "failing":
			return item.run_id
				? { label: "Open run", to: activityPath(graph, "runs", item.run_id) }
				: null;
		case "waiting":
			return { label: "Review", to: activityPath(graph, "approvals") };
		case "degraded":
			return {
				label: "Investigate",
				to: `/u/${graph.username}/${graph.graphSlug}/agents/performance`,
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
	graph: FleetPageProps;
}) {
	const navigate = useNavigate();
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
						const act = attentionAct(item, graph);
						return (
							<Item
								key={`${item.kind}:${item.run_id ?? item.approval_id ?? item.agent_id ?? item.title}`}
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
											onClick={() => navigate(act.to)}
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
	graph: FleetPageProps;
}) {
	const navigate = useNavigate();
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
											onClick={() =>
												navigate(agentPagePath(graph, c.record_id))
											}
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
