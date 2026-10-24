/**
 * A live agent's Overview — its dashboard (board `agents.agent.detail`).
 *
 * *As a builder, I want an agent's numbers on its page, so that I see when it
 * gets worse.*
 *
 * Five tiles, Runs a day and Tokens a day over 30 days, Exits by reason and
 * Recent runs — every number from `GET …/agents/{id}/overview`, stored by the
 * engine; Studio formats, never derives. A tile's caption is the engine's
 * prior window as it returned it. A run row opens the run's page.
 */

import { LineChart, StackedBarChartV } from "@invana/charts";
import {
	MetricGrid,
	MetricTile,
	StatusDot,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	TypographyInlineCode,
} from "@invana/ui";
import { PanelSection } from "@invana-studio/ui";
import { useContext } from "react";
import { AgentsOpenContext } from "../open";
import { day, ms, pct, spreadTicks, tokens } from "../overview/fleetParts";
import { exitTone, runLabel, TabReadState } from "./agentParts";
import { useAgentOverviewQuery } from "./queries";
import type { Agent } from "./types";

const WINDOW = "30d";
const NOT_RUN = "Not run yet";

export function AgentDashboard({
	username,
	graphSlug,
	agent,
}: {
	username: string;
	graphSlug: string;
	agent: Agent;
}) {
	const open = useContext(AgentsOpenContext);
	const query = useAgentOverviewQuery(username, graphSlug, agent.id, WINDOW);
	const o = query.data;
	if (!o)
		return (
			<TabReadState
				loading={query.isLoading}
				error={query.error}
				what="this agent's numbers"
				onRetry={() => void query.refetch()}
			/>
		);

	const labels = o.daily.map((d) => day(d.date));
	const topRuns = Math.max(1, ...o.daily.map((d) => d.runs));
	const today = o.daily.at(-1);
	const openRun = open ? (id: string) => open.run(id) : undefined;

	return (
		<div className="flex flex-col gap-2.5 p-3.5">
			<MetricGrid minTileWidth={160}>
				<MetricTile
					label="Runs · 30 days"
					value={o.runs.toLocaleString()}
					caption={`${o.served.toLocaleString()} served · ${o.runs_prior.toLocaleString()} the 30 days before`}
					captionTone="muted"
				/>
				<MetricTile
					label="Served"
					value={pct(o.served_rate)}
					caption={
						o.served_rate_prior == null
							? "none the 30 days before"
							: `${pct(o.served_rate_prior)} the 30 days before`
					}
					captionTone="muted"
				/>
				<MetricTile
					label="p95 a run"
					value={ms(o.p95_ms)}
					caption={
						o.p95_prior_ms == null
							? "none the 30 days before"
							: `${ms(o.p95_prior_ms)} the 30 days before`
					}
					captionTone="muted"
				/>
				<MetricTile
					label="Tokens this month"
					value={tokens(o.tokens_this_month)}
					caption={
						o.max_tokens_month == null
							? "no month budget"
							: `of ${tokens(o.max_tokens_month)} tokens`
					}
					captionTone="muted"
					meter={
						o.max_tokens_month
							? Math.min(1, o.tokens_this_month / o.max_tokens_month)
							: undefined
					}
				/>
				<MetricTile
					label="Helpers spawned"
					value={o.spawned.toLocaleString()}
					caption="30 days"
					captionTone="muted"
				/>
			</MetricGrid>

			<div className="grid items-start gap-2.5 @[760px]:grid-cols-2">
				<PanelSection
					card
					title="Runs a day · 30 days"
					action={
						today ? (
							<span className="text-sm text-muted-foreground">
								today {today.runs}
							</span>
						) : null
					}
				>
					<StackedBarChartV
						max={topRuns}
						gridlines={[Math.ceil(topRuns / 2), topRuns]}
						ticks={spreadTicks(o.daily.length)}
						series={[
							{ key: "runs", label: "runs", color: "var(--color-success)" },
						]}
						data={o.daily.map((d, i) => ({
							label: labels[i],
							values: { runs: d.runs },
						}))}
						empty={NOT_RUN}
					/>
				</PanelSection>
				<PanelSection
					card
					title="Tokens a day · 30 days"
					action={
						today ? (
							<span className="text-sm text-muted-foreground">
								today {tokens(today.tokens)}
							</span>
						) : null
					}
				>
					<LineChart
						values={o.daily.map((d) => (d.runs ? d.tokens : null))}
						labels={labels}
						ticks={spreadTicks(labels.length)}
						format={(v) => tokens(v)}
						color="var(--color-success)"
						empty={NOT_RUN}
					/>
				</PanelSection>
			</div>

			<div className="grid items-start gap-2.5 @[760px]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
				<PanelSection card title="Exits · 30 days">
					{o.exits.length ? (
						<Table bordered={false} density="compact">
							<TableHeader>
								<TableRow>
									<TableHead>Exit</TableHead>
									<TableHead>Runs</TableHead>
									<TableHead>Most recent</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{o.exits.map((e) => (
									<TableRow
										key={e.exit}
										className={
											openRun && e.last_run_id ? "cursor-pointer" : undefined
										}
										onClick={
											openRun && e.last_run_id
												? () => openRun(e.last_run_id as string)
												: undefined
										}
									>
										<TableCell>
											<span className="inline-flex items-center gap-1.5">
												<StatusDot tone={exitTone(e.exit)} />
												{e.exit.replaceAll("_", " ")}
											</span>
										</TableCell>
										<TableCell className="font-mono">{e.runs}</TableCell>
										<TableCell className="max-w-0 truncate text-muted-foreground">
											{e.last_title ?? "—"}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					) : (
						<p className="text-muted-foreground">{NOT_RUN}</p>
					)}
				</PanelSection>
				<PanelSection card title="Recent runs">
					{o.recent.length ? (
						<Table bordered={false} density="compact">
							<TableHeader>
								<TableRow>
									<TableHead>Run</TableHead>
									<TableHead>Todo</TableHead>
									<TableHead>Agents</TableHead>
									<TableHead>Tokens</TableHead>
									<TableHead>Time</TableHead>
									<TableHead>Exit</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{o.recent.map((r) => (
									<TableRow
										key={r.id}
										className={openRun ? "cursor-pointer" : undefined}
										onClick={openRun ? () => openRun(r.id) : undefined}
									>
										<TableCell className="whitespace-nowrap">
											<TypographyInlineCode>
												{runLabel(r.id)}
											</TypographyInlineCode>
										</TableCell>
										<TableCell className="w-full max-w-0 truncate">
											{r.title}
										</TableCell>
										<TableCell className="font-mono">
											{r.agents ?? "—"}
										</TableCell>
										<TableCell className="font-mono">
											{tokens(r.tokens)}
										</TableCell>
										<TableCell className="font-mono">
											{ms(r.duration_ms)}
										</TableCell>
										<TableCell className="whitespace-nowrap">
											{r.exit.replaceAll("_", " ")}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					) : (
						<p className="text-muted-foreground">{NOT_RUN}</p>
					)}
				</PanelSection>
			</div>
		</div>
	);
}
