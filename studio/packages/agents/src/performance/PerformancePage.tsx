/**
 * **Performance** — speed, success and tokens for every agent, skill, plan and
 * model of a Graph, each against its own baseline, at `/agents/performance`
 * (board `agents.performance`, story AG-15).
 *
 * A full-width page: the host draws it as the whole `mainSection`, with no
 * `leftSection` beside it. Its regions, top to bottom:
 *
 * - **Header** — *Performance* and the `n degraded` · `n failing` badges.
 * - **Tabs and window** — *Agents · Skills · Plans · LLMs*, and the 7 · 30 · 90
 *   days control. Both ride the URL (`?tab=` · `?window=`), so a reload or a
 *   shared link reopens the same reading.
 * - **Tiles** — success rate, p50, p95, runs, tokens per run and degraded over
 *   the window, each against the window before.
 * - **The trend** beside **What changed** — p95 a day for the most degraded
 *   agent (else the busiest), its baseline dashed and the publishes in the
 *   window marked; and the change named before its first slow run, with a link
 *   to compare the two versions.
 * - **The tables** — *Each agent* and *Each skill* on Agents; one table on each
 *   of the other tabs.
 *
 * Read-only: the compare is the change log's, and rollback lives on the
 * skill's History. Tokens, never currency.
 */

import { LineChart } from "@invana/charts";
import {
	Badge,
	Button,
	cn,
	MetricGrid,
	MetricTile,
	RecordHeader,
	SegmentedControl,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Tabs,
	TabsList,
	TabsTrigger,
} from "@invana/ui";
import { comparePath } from "@invana-studio/shell";
import { PanelSection } from "@invana-studio/ui";
import { useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { FleetPageProps } from "../fleet/FleetPageProps";
import { useFleetPerformanceQuery } from "../fleet/queries";
import {
	FLEET_WINDOWS,
	type FleetPerformance,
	type FleetTiles,
	type FleetWindow,
	type PerformanceRow,
	type PerformanceTrend,
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
} from "../overview/fleetParts";

const TABS = [
	{ id: "agents", label: "Agents" },
	{ id: "skills", label: "Skills" },
	{ id: "plans", label: "Plans" },
	{ id: "llms", label: "LLMs" },
] as const;

type Tab = (typeof TABS)[number]["id"];

const isTab = (v: string | null): v is Tab => TABS.some((t) => t.id === v);
const isWindow = (v: string | null): v is FleetWindow =>
	FLEET_WINDOWS.includes(v as FleetWindow);

/** `?tab=` and `?window=`, read and written in place (a reading, not a visit). */
function usePerformanceView() {
	const [params, setParams] = useSearchParams();
	const rawTab = params.get("tab");
	const rawWindow = params.get("window");
	const tab: Tab = isTab(rawTab) ? rawTab : "agents";
	const window: FleetWindow = isWindow(rawWindow) ? rawWindow : "7d";
	const set = useCallback(
		(key: "tab" | "window", value: string) =>
			setParams(
				(prev) => {
					const next = new URLSearchParams(prev);
					next.set(key, value);
					return next;
				},
				{ replace: true },
			),
		[setParams],
	);
	return { tab, window, set };
}

export function PerformancePage(props: FleetPageProps) {
	const { username, graphSlug } = props;
	const { tab, window, set } = usePerformanceView();
	const query = useFleetPerformanceQuery(username, graphSlug, window);
	const data = query.data;

	return (
		<FleetPage>
			<RecordHeader
				size="lg"
				variant="page"
				crumbs={["Performance"]}
				chips={
					data ? (
						<>
							<Badge
								variant="outline"
								tone={data.tiles.degraded ? "warning" : "muted"}
								size="xs"
							>
								{data.tiles.degraded} degraded
							</Badge>
							<Badge
								variant="outline"
								tone={data.tiles.failing ? "destructive" : "muted"}
								size="xs"
							>
								{data.tiles.failing} failing
							</Badge>
						</>
					) : null
				}
			/>
			<div className="flex items-center gap-3 border-b pr-3">
				<Tabs
					className="min-w-0 flex-1"
					value={tab}
					onValueChange={(next) => set("tab", next)}
				>
					<TabsList className="w-full justify-start gap-1 px-3">
						{TABS.map((t) => (
							<TabsTrigger key={t.id} value={t.id}>
								{t.label}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
				<SegmentedControl
					size="sm"
					aria-label="Window"
					value={window}
					onValueChange={(next) => set("window", next)}
					options={FLEET_WINDOWS.map((w) => ({
						value: w,
						label: `${w.slice(0, -1)} days`,
					}))}
				/>
			</div>
			<FleetBody>
				{data ? (
					<PerformanceBody data={data} tab={tab} graph={props} />
				) : (
					<FleetReadState
						loading={query.isLoading}
						error={query.error}
						what="performance"
					/>
				)}
			</FleetBody>
		</FleetPage>
	);
}

function PerformanceBody({
	data,
	tab,
	graph,
}: {
	data: FleetPerformance;
	tab: Tab;
	graph: FleetPageProps;
}) {
	const span = `${data.window_days} days`;
	return (
		<>
			<Tiles tiles={data.tiles} agents={data.agents} span={span} />
			<div className="grid gap-3 lg:grid-cols-2">
				<Trend trend={data.trend} span={span} />
				<WhatChanged data={data} span={span} graph={graph} />
			</div>
			{tab === "agents" ? (
				<>
					<SubjectTable
						title="Each agent"
						nameLabel="Agent"
						rows={data.agents}
						span={span}
					/>
					<SkillTable rows={data.skills} span={span} />
				</>
			) : tab === "skills" ? (
				<SkillTable rows={data.skills} span={span} />
			) : tab === "plans" ? (
				<SubjectTable
					title="Each plan"
					nameLabel="Plan"
					rows={data.plans}
					span={span}
					showVersion
				/>
			) : (
				<SubjectTable
					title="Each model"
					nameLabel="Model"
					rows={data.models}
					span={span}
				/>
			)}
		</>
	);
}

function Tiles({
	tiles: t,
	agents,
	span,
}: {
	tiles: FleetTiles;
	agents: PerformanceRow[];
	span: string;
}) {
	const p50 = measureCaption(t.p50_ms, span);
	const p95 = measureCaption(t.p95_ms, span);
	const runs = measureCaption(t.runs, span);
	const perRun = measureCaption(t.tokens_per_run, span);
	const success = t.success.change;
	const degraded = agents.find((a) => a.signal === "degraded");

	return (
		<MetricGrid minTileWidth={160}>
			<MetricTile
				label="Success rate"
				value={pct(t.success.value)}
				caption={
					success && success.direction !== "flat"
						? `${span} · ${changeText(success, ["▲", "▼"])}`
						: span
				}
				captionTone={success?.tone === "worse" ? "warning" : "muted"}
			/>
			<MetricTile
				label="p50 run time"
				value={ms(t.p50_ms.value)}
				caption={p50.caption}
				captionTone={p50.tone}
			/>
			<MetricTile
				label="p95 run time"
				value={ms(t.p95_ms.value)}
				caption={p95.caption}
				captionTone={p95.tone}
			/>
			<MetricTile
				label="Runs"
				value={t.runs.value ?? 0}
				caption={runs.caption}
				captionTone="muted"
			/>
			<MetricTile
				label="Tokens per run"
				value={tokens(t.tokens_per_run.value)}
				caption={perRun.caption}
				captionTone={perRun.tone}
			/>
			<MetricTile
				label="Degraded"
				value={t.degraded}
				caption={
					degraded
						? degraded.degradation
							? `${degraded.name} since ${day(degraded.degradation.since)}`
							: degraded.name
						: "none"
				}
				captionTone={t.degraded ? "warning" : "muted"}
			/>
		</MetricGrid>
	);
}

function Trend({
	trend,
	span,
}: {
	trend: PerformanceTrend | null;
	span: string;
}) {
	if (!trend) {
		return (
			<PanelSection card title="p95 run time a day">
				<p className="py-2 text-muted-foreground">
					Nothing ran in the last {span}
				</p>
			</PanelSection>
		);
	}
	const values = trend.points.map((p) => p.p95_ms);
	const labels = trend.points.map((p) => day(p.date));
	const marks = trend.marks
		.map((m) => ({
			index: trend.points.findIndex((p) => p.date === m.date.slice(0, 10)),
			label: m.label,
		}))
		.filter((m) => m.index >= 0);
	const top = Math.max(
		1,
		trend.baseline_p95_ms ?? 0,
		...values.map((v) => v ?? 0),
	);
	const hint = [
		trend.baseline_p95_ms != null
			? `dashed: 7-day baseline ${ms(trend.baseline_p95_ms)}`
			: null,
		marks.length
			? `marked: ${marks.map((m) => m.label).join(", ")} published`
			: null,
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<PanelSection
			card
			title={`${trend.name} · p95 run time a day`}
			action={
				hint ? (
					<span className="text-sm text-muted-foreground">{hint}</span>
				) : undefined
			}
		>
			<LineChart
				values={values}
				labels={labels}
				ticks={spreadTicks(labels.length)}
				marks={marks}
				max={top}
				gridlines={[0, top]}
				reference={
					trend.baseline_p95_ms != null
						? { value: trend.baseline_p95_ms, label: "baseline" }
						: undefined
				}
				format={(v) => (v <= 0 ? "0" : ms(v))}
				empty={`Nothing ran in the last ${span}`}
			/>
		</PanelSection>
	);
}

/** The trend agent's degradation and the change named before it. */
function WhatChanged({
	data,
	span,
	graph,
}: {
	data: FleetPerformance;
	span: string;
	graph: FleetPageProps;
}) {
	const navigate = useNavigate();
	const subject = data.trend
		? data.agents.find((a) => a.id === data.trend?.subject_id)
		: undefined;
	const deg = subject?.degradation ?? null;
	const change = deg?.change ?? null;

	return (
		<PanelSection
			card
			title={change?.at ? `What changed on ${day(change.at)}` : "What changed"}
		>
			{!deg ? (
				<p className="py-2 text-muted-foreground">
					Nothing degraded in the last {span}
				</p>
			) : (
				<div className="flex flex-col items-start gap-2 py-1">
					{change ? (
						<p>
							<span className="font-medium">
								{change.name} v{change.version}
							</span>{" "}
							was published{change.actor_name ? ` by ${change.actor_name}` : ""}
							.{change.summary ? ` ${change.summary}` : ""}
						</p>
					) : null}
					<p className="text-sm text-muted-foreground">
						{subject?.name} · p95 {ms(deg.p95_ms)}, up from{" "}
						{ms(deg.baseline_p95_ms)} since {day(deg.since)}
					</p>
					{change && change.previous != null ? (
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								navigate(
									comparePath(graph, change.record_kind, change.record_id, {
										a: change.previous,
										b: change.version,
									}),
								)
							}
						>
							Compare v{change.previous} and v{change.version}
						</Button>
					) : null}
				</div>
			)}
		</PanelSection>
	);
}

/** ▲ 62% since skill v8 · 3 failures · flat · ▼ 12%. */
function TrendCell({ row }: { row: PerformanceRow }) {
	if (row.failing >= 2)
		return <span className="text-destructive">{row.failing} failures</span>;
	const change = row.p95_change;
	if (change == null) return <span className="text-muted-foreground">—</span>;
	const text = changeText(change, ["▲", "▼"]);
	const since = row.degradation?.change;
	return (
		<span className={TONE_TEXT[changeTone(change)]}>
			{text}
			{text !== "flat" && since
				? ` since ${since.record_kind} v${since.version}`
				: ""}
		</span>
	);
}

function SignalBadge({ row }: { row: PerformanceRow }) {
	if (!row.signal) return <span className="text-muted-foreground">—</span>;
	return (
		<Badge
			variant="outline"
			tone={row.signal === "failing" ? "destructive" : "warning"}
			size="xs"
		>
			{row.signal}
		</Badge>
	);
}

function EmptyLine({ span }: { span: string }) {
	return (
		<p className="py-2 text-muted-foreground">Nothing ran in the last {span}</p>
	);
}

/** One row per agent, plan or model. */
function SubjectTable({
	title,
	nameLabel,
	rows,
	span,
	showVersion,
}: {
	title: string;
	nameLabel: string;
	rows: PerformanceRow[];
	span: string;
	showVersion?: boolean;
}) {
	return (
		<PanelSection
			card
			title={title}
			action={<span className="text-sm text-muted-foreground">{span}</span>}
		>
			{rows.length ? (
				<Table bordered={false} density="compact">
					<TableHeader>
						<TableRow>
							<TableHead>{nameLabel}</TableHead>
							{showVersion ? <TableHead>Version</TableHead> : null}
							<TableHead className="text-right">Runs</TableHead>
							<TableHead className="text-right">Success</TableHead>
							<TableHead className="text-right">p50</TableHead>
							<TableHead className="text-right">p95</TableHead>
							<TableHead>Trend</TableHead>
							<TableHead className="text-right">Tokens / run</TableHead>
							<TableHead>Signal</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((r) => (
							<TableRow key={r.id}>
								<TableCell>{r.name}</TableCell>
								{showVersion ? (
									<TableCell className="font-mono">
										{r.version != null ? `v${r.version}` : "—"}
									</TableCell>
								) : null}
								<TableCell className="text-right font-mono">{r.runs}</TableCell>
								<TableCell
									className={cn(
										"text-right font-mono",
										r.signal === "failing" && "text-destructive",
									)}
								>
									{pct(r.success)}
								</TableCell>
								<TableCell className="text-right font-mono">
									{ms(r.p50_ms)}
								</TableCell>
								<TableCell
									className={cn(
										"text-right font-mono",
										r.signal === "degraded" && "text-warning",
									)}
								>
									{ms(r.p95_ms)}
								</TableCell>
								<TableCell>
									<TrendCell row={r} />
								</TableCell>
								<TableCell className="text-right font-mono">
									{tokens(r.tokens_per_run)}
								</TableCell>
								<TableCell>
									<SignalBadge row={r} />
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			) : (
				<EmptyLine span={span} />
			)}
		</PanelSection>
	);
}

/** Each skill at its current version, against the version before it. */
function SkillTable({ rows, span }: { rows: PerformanceRow[]; span: string }) {
	return (
		<PanelSection
			card
			title="Each skill"
			action={
				<span className="text-sm text-muted-foreground">versions compared</span>
			}
		>
			{rows.length ? (
				<Table bordered={false} density="compact">
					<TableHeader>
						<TableRow>
							<TableHead>Skill</TableHead>
							<TableHead>Version</TableHead>
							<TableHead className="text-right">Applied</TableHead>
							<TableHead className="text-right">p95</TableHead>
							<TableHead>Vs previous</TableHead>
							<TableHead className="text-right">Tokens / run</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((r) => {
							const change = r.p95_change;
							const prev =
								r.prior_version != null
									? `v${r.prior_version}`
									: "the window before";
							return (
								<TableRow key={r.id}>
									<TableCell>{r.name}</TableCell>
									<TableCell className="font-mono">
										{r.version != null ? `v${r.version}` : "—"}
									</TableCell>
									<TableCell className="text-right font-mono">
										{r.runs}
									</TableCell>
									<TableCell className="text-right font-mono">
										{ms(r.p95_ms)}
									</TableCell>
									<TableCell>
										{change == null ? (
											<span className="text-muted-foreground">—</span>
										) : (
											<span className={TONE_TEXT[changeTone(change)]}>
												{changeText(change, ["▲", "▼"])}
												{change.direction === "flat" ? "" : ` vs ${prev}`}
											</span>
										)}
									</TableCell>
									<TableCell className="text-right font-mono">
										{tokens(r.tokens_per_run)}
										{r.tokens_per_run_prior != null ? (
											<span className="text-muted-foreground">
												{" "}
												({prev}: {tokens(r.tokens_per_run_prior)})
											</span>
										) : null}
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			) : (
				<EmptyLine span={span} />
			)}
		</PanelSection>
	);
}
