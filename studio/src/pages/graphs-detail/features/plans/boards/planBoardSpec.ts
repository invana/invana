import { usd } from "@/lib/format";

/**
 * The plan page as a board document ([the-library.md](../../../../../../../docs/for-developers/modules/workflows/features/the-library.md)).
 *
 * A report header naming the version, then **Overview · Layers · Flow ·
 * Activity**, with the `7 · 30 · 90 days` window on the right of the tab strip —
 * the run page's layout in the plan's tense. This file composes; the page
 * fetches and answers actions, and `@invana/boards` draws.
 */

import type { MetricOptions } from "@invana/blocks";
import type { BoardSpec, PanelSpec, TabSpec } from "@invana/boards";
import { formatElapsed } from "@/lib/time";
import type { PlanChartWidgets } from "@/pages/graphs-detail/features/plans/boards/PlanChartWidgets";
import { planLayersGantt } from "@/pages/graphs-detail/features/plans/planLayers";
import {
	taskFlowFromTaskPlan,
	WIDE_SPREAD,
} from "@/pages/graphs-detail/features/plans/taskFlowFromTaskPlan";
import type {
	Measure,
	PlanPerformance,
	PlanRunRow,
	PlanRunsPage,
	PlanWindow,
	TaskPlanDetail,
} from "@/pages/graphs-detail/features/plans/types";
import { runAddress } from "@/pages/graphs-detail/features/runs";
import type { FlowOptions } from "@/pages/graphs-detail/shared/boards/TaskFlowWidget";

export type PlanPanels = PlanChartWidgets & {
	flow: FlowOptions;
};

export const PLAN_ACTIONS = {
	tab: "tab",
	window: "window",
	version: "version",
	selectStep: "select-step",
	openRun: "open-run",
	status: "filter-status",
	calledBy: "filter-called-by",
	agent: "filter-agent",
	more: "show-more",
	reading: "open-reading",
} as const;

/** What `⋯` opens, each as its own page beside the plan's. */
const PLAN_READINGS = {
	versions: "Versions",
	arguments: "Arguments",
	export: "Export YAML",
} as const;
export type PlanReading = keyof typeof PLAN_READINGS;

const PLAN_TABS = ["overview", "layers", "flow", "activity"] as const;
export type PlanTab = (typeof PLAN_TABS)[number];

export const WINDOWS: Record<string, PlanWindow> = {
	"7 days": "7d",
	"30 days": "30d",
	"90 days": "90d",
};
const windowLabel = (w: PlanWindow) =>
	Object.keys(WINDOWS).find((k) => WINDOWS[k] === w) ?? w;

/** Every filter offers `all`, and `all` is the absence of the filter. */
export const ALL = "all";
const STATUSES = [
	ALL,
	"running",
	"at a gate",
	"succeeded",
	"failed",
	"cancelled",
];

export interface PlanView {
	tab: PlanTab;
	window: PlanWindow;
	/** The step picked on the Overview table or the Flow canvas. */
	step: string | null;
	status: string;
	calledBy: string;
	/** An agent id, or `ALL`. */
	agent: string;
}

export interface PlanPageData {
	plan: TaskPlanDetail;
	/** Every version of this key, oldest first — the header's switch. */
	versions: number[];
	performance: PlanPerformance | undefined;
	runs: PlanRunsPage[] | undefined;
}

type Panel = PanelSpec<PlanPanels>;

const ms = (v: number | null | undefined) =>
	v == null ? "—" : formatElapsed(Math.round(v));
const pct = (v: number | null | undefined) =>
	v == null ? "—" : `${Math.round(v * 100)}%`;
const day = (iso: string) =>
	new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
const when = (iso: string) =>
	new Date(iso).toLocaleString(undefined, {
		day: "numeric",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
	});

export function planBoardSpec(
	data: PlanPageData,
	view: PlanView,
): BoardSpec<PlanPanels> {
	const { plan, versions, performance } = data;
	const tabs: TabSpec<PlanPanels>[] = [
		{ id: "overview", label: "Overview", rows: overviewRows(data, view) },
		{ id: "layers", label: "Layers", rows: layersRows(plan, performance) },
		{ id: "flow", label: "Flow", rows: flowRows(plan, performance, view) },
		{ id: "activity", label: "Activity", rows: activityRows(data, view) },
	];

	return {
		title: `${plan.key}@${plan.version}`,
		header: {
			crumbs: ["library", `${plan.key}@${plan.version}`],
			chips: [
				{ label: `v${plan.version}` },
				{ label: "published", variant: "outline" },
			],
			actions: [
				// The page reads one version; the switch is here because every
				// tab reads the one the header names.
				...(versions.length > 1
					? [
							{
								id: PLAN_ACTIONS.version,
								options: versions.map((v) => `v${v}`),
								value: `v${plan.version}`,
							},
						]
					: []),
				{
					id: PLAN_ACTIONS.reading,
					label: "More",
					icon: "more",
					menu: true,
					options: Object.keys(PLAN_READINGS),
					optionLabels: PLAN_READINGS,
				},
			],
		},
		rows: [],
		tabs,
		tab: view.tab,
		tabAction: PLAN_ACTIONS.tab,
		tabActions: [
			{
				id: PLAN_ACTIONS.window,
				options: Object.keys(WINDOWS),
				value: windowLabel(view.window),
			},
		],
	};
}

// ── Overview ──────────────────────────────────────────────────────────────────

/** `was 12` under a tile: the same measure over the window before. */
function was(m: Measure, fmt: (v: number) => string): string | undefined {
	return m.prior == null ? undefined : `was ${fmt(m.prior)}`;
}

function overviewRows(data: PlanPageData, view: PlanView) {
	const perf = data.performance;
	if (!perf)
		return [{ panels: [waiting("Reading how this plan has behaved…")] }];
	const ran = perf.tiles.runs.value ?? 0;
	const span = windowLabel(view.window);

	// **Never run** draws no tiles and no charts: a chart of zeros reads as a
	// plan that failed. The steps are still listed, with nothing measured.
	if (ran === 0)
		return [
			{
				panels: [
					{
						kind: "text",
						options: {
							callout: true,
							text: `Nothing ran this plan in the last ${span}. Its steps are listed below with nothing measured; they fill in once it runs.`,
						},
					},
				] as Panel[],
			},
			{ panels: [stepsTable(data, view, 0)] },
		];

	const t = perf.tiles;
	const tiles: MetricOptions[] = [
		{ label: "runs", value: String(ran), delta: was(t.runs, String) },
		{
			label: "served",
			value: pct(t.served.value),
			delta:
				t.served.value == null ? "none verified" : was(t.served, (v) => pct(v)),
		},
		{
			label: "elapsed p50",
			value: ms(t.elapsed_p50_ms.value),
			delta: was(t.elapsed_p50_ms, ms),
		},
		{
			label: "work p50",
			value: ms(t.work_p50_ms.value),
			delta: was(t.work_p50_ms, ms),
		},
		{
			label: "cost per run",
			value: t.cost_per_run.value == null ? "—" : usd(t.cost_per_run.value),
			delta: t.cost_per_run.value == null ? "not priced" : undefined,
		},
		{
			label: "failed",
			value: String(t.failed.value ?? 0),
			delta: was(t.failed, String),
			tone: (t.failed.value ?? 0) > 0 ? "bad" : undefined,
		},
	];

	const labels = perf.daily.map((d) => day(d.date));
	const ticks = [0, Math.floor(labels.length / 2), labels.length - 1];
	const marks = perf.publishes
		.map((p) => ({
			index: perf.daily.findIndex(
				(d) => d.date === p.published_at.slice(0, 10),
			),
			label: `v${p.version}`,
		}))
		.filter((m) => m.index >= 0);

	const rows: TabSpec<PlanPanels>["rows"] = [
		{ panels: [{ kind: "grid", options: { tiles, minTileWidth: 120 } }] },
		{
			panels: [
				{
					kind: "dailyRuns",
					title: "Runs a day",
					grow: 1.9,
					options: {
						days: perf.daily.map((d, i) => ({
							label: labels[i],
							served: d.served,
							failed: d.failed,
						})),
						ticks,
					},
				},
				{
					kind: "workTrend",
					title: "Work p50, a day",
					aside: ms(t.work_p50_ms.value),
					options: {
						values: perf.daily.map((d) => d.work_p50_ms),
						labels,
						ticks,
						marks,
					},
				},
			],
		},
		{ panels: [stepsTable(data, view, ran)] },
	];

	const picked = perf.steps.find((s) => s.step_key === view.step);
	if (picked) rows.push({ panels: stepCard(picked, perf) });

	rows.push({
		panels: [
			perf.failures.length
				? {
						// The panel's id is the action a pick answers — see `routedAction`.
						id: PLAN_ACTIONS.openRun,
						kind: "table",
						title: "Where it fails",
						aside: `${t.failed.value ?? 0} failed · ${span}`,
						flush: true,
						options: {
							columns: [
								{ key: "step", label: "step", mono: true },
								{ key: "cause", label: "why", mono: true },
								{ key: "count", label: "runs", align: "right", mono: true },
							],
							rows: perf.failures.map((f) => ({
								step: f.step_key,
								cause: f.cause,
								count: f.count,
								run: f.last_run_id,
							})),
							rowKey: "run",
						},
					}
				: {
						kind: "text",
						title: "Where it fails",
						options: {
							text: `No run of this plan failed in the last ${span}.`,
							tone: "muted",
						},
					},
			perf.bounds.length
				? {
						kind: "table",
						title: "Bounds it reaches",
						flush: true,
						options: {
							columns: [
								{ key: "step", label: "step", mono: true },
								{ key: "bound", label: "bound" },
								{ key: "used", label: "used", align: "right", mono: true },
								{
									key: "exhausted",
									label: "exhausted",
									align: "right",
									mono: true,
								},
							],
							rows: perf.bounds.map((b) => ({
								step: b.step_key,
								bound: `${b.bound} · ${b.limit}`,
								used: b.used,
								exhausted: b.exhausted,
							})),
						},
					}
				: {
						kind: "text",
						title: "Bounds it reaches",
						options: { text: "No step of this plan retries.", tone: "muted" },
					},
		],
	});
	return rows;
}

/** **Each step, across N runs** — the reason the tab exists. */
function stepsTable(data: PlanPageData, view: PlanView, ran: number): Panel {
	const measured = new Map(data.performance?.steps.map((s) => [s.step_key, s]));
	return {
		// The panel's id is the action a pick answers — see `routedAction`.
		id: PLAN_ACTIONS.selectStep,
		kind: "table",
		title: `Each step, across ${ran} run${ran === 1 ? "" : "s"}`,
		aside: ran ? "pick a step for its runs" : undefined,
		flush: true,
		options: {
			columns: [
				{ key: "step", label: "step", mono: true },
				{ key: "layer", label: "layer" },
				{ key: "ran_in", label: "ran in", align: "right", mono: true },
				{ key: "p50", label: "p50", align: "right", mono: true },
				{ key: "p95", label: "p95", align: "right", mono: true },
				{ key: "failed", label: "failed", align: "right", mono: true },
				{ key: "retried", label: "retried", align: "right", mono: true },
				{ key: "cost", label: "cost/run", align: "right", mono: true },
				{ key: "share", label: "share of work", align: "right", mono: true },
			],
			rows: data.plan.nodes.map((node) => {
				const s = measured.get(node.id);
				const wide =
					s?.p95_ms != null &&
					s.p50_ms != null &&
					s.p95_ms >= WIDE_SPREAD * s.p50_ms;
				return {
					step: node.id,
					layer: node.layer,
					ran_in: pct(s?.ran_in),
					p50: ms(s?.p50_ms),
					// A spread this wide is what makes a step unpredictable, so it
					// is marked rather than left for the reader to divide.
					p95: s?.p95_ms == null ? "—" : `${ms(s.p95_ms)}${wide ? " ▲" : ""}`,
					failed: s ? s.failed : "—",
					retried: pct(s?.retried),
					cost: s?.cost_per_run == null ? "—" : usd(s.cost_per_run),
					share: pct(s?.share_of_work),
				};
			}),
			rowKey: ran ? "step" : undefined,
			selected: view.step,
		},
	};
}

/** A step picked — its numbers, and its slowest runs, each opening its run page. */
function stepCard(
	step: PlanPerformance["steps"][number],
	perf: PlanPerformance,
): Panel[] {
	const slowest = perf.slowest[step.step_key] ?? [];
	return [
		{
			kind: "record",
			title: step.step_key,
			aside: step.layer,
			width: 320,
			options: {
				rows: [
					{ label: "p50", value: ms(step.p50_ms) },
					{ label: "p95", value: ms(step.p95_ms) },
					{ label: "failed", value: String(step.failed) },
					{ label: "retried", value: pct(step.retried) },
					{ label: "ran in", value: pct(step.ran_in) },
					{ label: "share of work", value: pct(step.share_of_work) },
				],
			},
		},
		{
			kind: "list",
			title: "Its slowest runs",
			options: {
				items: slowest.map((r) => ({
					id: r.run_id,
					title: runAddress(r.run_id),
					meta: `${ms(r.ms)} · ${when(r.when)}`,
					mono: true,
					action: PLAN_ACTIONS.openRun,
				})),
			},
		},
	];
}

// ── Layers ────────────────────────────────────────────────────────────────────

function layersRows(plan: TaskPlanDetail, perf: PlanPerformance | undefined) {
	const p50 = new Map(
		(perf?.steps ?? [])
			.filter((s) => s.p50_ms != null)
			.map((s) => [s.step_key, ms(s.p50_ms)]),
	);
	const gantt = planLayersGantt(plan, p50);
	const declared = plan.declared_layers.filter((l) => l.declared).length;
	return [
		{
			panels: [
				{
					kind: "gantt",
					title: "Layers it declares",
					aside: `${declared} of ${plan.declared_layers.length}`,
					flush: true,
					// The layer rows arrive **open**: the tab has the width the section
					// did not.
					options: gantt,
				},
			] as Panel[],
		},
		{
			panels: [
				{
					kind: "text",
					options: {
						text: "The agent spine is not declared — it is what dispatches the rest.",
						tone: "muted",
					},
				},
			] as Panel[],
		},
	];
}

// ── Flow ──────────────────────────────────────────────────────────────────────

const FLOW_HEIGHT = 420;

function flowRows(
	plan: TaskPlanDetail,
	perf: PlanPerformance | undefined,
	view: PlanView,
) {
	const node = plan.nodes.find((n) => n.id === view.step);
	const flow: Panel = {
		kind: "flow",
		grow: 1,
		options: {
			data: taskFlowFromTaskPlan(plan, perf?.steps),
			selectedId: view.step,
			openAction: PLAN_ACTIONS.selectStep,
			height: FLOW_HEIGHT,
			bleed: !node,
			message: "Medians over the window — click a step for its contract",
		},
	};
	if (!node) return [{ panels: [flow] }];

	const step = perf?.steps.find((s) => s.step_key === node.id);
	const after = plan.edges
		.filter((e) => e.target === node.id)
		.map((e) => e.source);
	const feeds = plan.edges
		.filter((e) => e.source === node.id)
		.map((e) => e.target);
	return [
		{
			panels: [
				flow,
				{
					kind: "record",
					title: node.label || node.id,
					aside: node.layer,
					width: 320,
					options: {
						rows: [
							{ label: "task", value: node.task || "a person" },
							{ label: "after", value: after.join(" · ") || "—" },
							{ label: "feeds", value: feeds.join(" · ") || "—" },
							...Object.entries(node.args).map(([k, v]) => ({
								label: k,
								value: String(v),
							})),
							{ label: "p50", value: ms(step?.p50_ms) },
							{ label: "p95", value: ms(step?.p95_ms) },
							{ label: "failed", value: step ? String(step.failed) : "—" },
							{ label: "ran in", value: pct(step?.ran_in) },
						],
					},
				},
			] as Panel[],
		},
	];
}

// ── Activity ──────────────────────────────────────────────────────────────────

function activityRows(data: PlanPageData, view: PlanView) {
	const pages = data.runs;
	if (!pages) return [{ panels: [waiting("Reading this plan's runs…")] }];
	const live = pages[0]?.live;
	const items = pages.flatMap((p) => p.items);
	const callers = [ALL, ...new Set(items.map((r) => r.called_by.kind))];
	const filtered =
		view.status !== ALL || view.calledBy !== ALL || view.agent !== ALL;
	// The agents that *may* run the plan, and any seen running it — named, so
	// the picker shows a name and filters by id.
	const agents = new Map([[ALL, "all agents"]]);
	for (const a of data.plan.used_by) agents.set(a.id, a.name);
	for (const r of items) if (r.agent) agents.set(r.agent.id, r.agent.name);

	const rows: TabSpec<PlanPanels>["rows"] = [
		{
			panels: [
				{
					kind: "grid",
					options: {
						tiles: [
							{ label: "running now", value: String(live?.running ?? 0) },
							{ label: "at a gate", value: String(live?.at_gate ?? 0) },
							{ label: "called by", value: String(live?.called_by ?? 0) },
							{ label: "agents", value: String(live?.agents ?? 0) },
						],
						minTileWidth: 120,
					},
				},
			],
		},
	];

	const filters = [
		{ id: PLAN_ACTIONS.status, options: STATUSES, value: view.status },
		...(callers.length > 2 || view.calledBy !== ALL
			? [
					{
						id: PLAN_ACTIONS.calledBy,
						options: [...new Set([...callers, view.calledBy])],
						value: view.calledBy,
					},
				]
			: []),
		...(agents.size > 2 || view.agent !== ALL
			? [
					{
						id: PLAN_ACTIONS.agent,
						label: "agent",
						picker: true,
						options: [...new Set([...agents.keys(), view.agent])],
						optionLabels: Object.fromEntries(agents),
						value: view.agent,
					},
				]
			: []),
	];

	if (!items.length) {
		rows.push({
			panels: [
				{
					kind: "text",
					title: "Runs",
					actions: filters,
					options: {
						callout: !filtered,
						text: filtered
							? "No run matches these filters."
							: `No run used this plan in the last ${windowLabel(view.window)}. An agent that may run it puts a row here the first time it does, and so does a skill that inlines it.`,
					},
				},
			] as Panel[],
		});
		return rows;
	}

	rows.push({
		panels: [
			{
				// The panel's id is the action a pick answers — see `routedAction`.
				id: PLAN_ACTIONS.openRun,
				kind: "table",
				title: "Runs",
				aside: `${items.length}${pages.at(-1)?.next_cursor ? "+" : ""} · newest first`,
				actions: filters,
				flush: true,
				options: {
					columns: [
						{ key: "run", label: "run", mono: true },
						{ key: "asked", label: "asked" },
						{ key: "called_by", label: "called by" },
						{ key: "agent", label: "agent" },
						{ key: "status", label: "status" },
						{ key: "elapsed", label: "elapsed", align: "right", mono: true },
						{ key: "cost", label: "cost", align: "right", mono: true },
						{ key: "when", label: "when" },
					],
					rows: items.map(runRow),
					rowKey: "id",
				},
			},
		] as Panel[],
	});

	if (pages.at(-1)?.next_cursor)
		rows.push({
			panels: [
				{
					kind: "text",
					options: {
						text: "The Overview's counts are the totals; this list is for finding a run.",
						tone: "muted",
						actions: [{ id: PLAN_ACTIONS.more, label: "Show 50 more" }],
					},
				},
			] as Panel[],
		});
	return rows;
}

function runRow(r: PlanRunRow) {
	return {
		id: r.run_id,
		run: runAddress(r.run_id),
		asked: r.asked || "—",
		called_by: r.called_by.person
			? `${r.called_by.name} · ${r.called_by.person}`
			: r.called_by.name,
		agent: r.agent?.name ?? "—",
		// A failed row names the step it failed at and why, so a list filtered
		// to failures is a triage list without opening each run.
		status: r.failed_at
			? `failed at ${r.failed_at.step_key} · ${r.failed_at.cause}`
			: r.status,
		elapsed: ms(r.elapsed_ms),
		cost: r.cost == null ? "—" : usd(r.cost),
		when: when(r.when),
	};
}

function waiting(text: string): Panel {
	return { kind: "text", options: { text, tone: "muted" } };
}
