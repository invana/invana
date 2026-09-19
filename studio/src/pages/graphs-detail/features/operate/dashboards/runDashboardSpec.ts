/**
 * The run dashboard, composed — artboard **D1** ([34k](../../../../../../docs/for-developers/the-screens.md)).
 *
 * A pure function of one `GET …/runs/{id}/trace` ([SR30](../../../../../../docs/for-developers/modules/operate/features/see-what-ran.md)):
 * tiles · the flow with status on it · the Gantt · what opened the run and
 * `result.json` · the log. Nothing here fetches, nothing here renders — the
 * page does the first and `@invana/dashboard` does the second, and this file is
 * the whole of what the two have to agree on.
 *
 * Bands with nothing behind them are **absent, not empty**
 * ([SR34](../../../../../../docs/for-developers/modules/operate/features/see-what-ran.md)):
 * a run whose model has no published rate draws no Cost tile, and a run with no
 * agent draws its spend with no meter — because a spend without its ceiling is
 * a number nobody can act on ([SR20](../../../../../../docs/for-developers/modules/operate/features/see-what-ran.md) ·
 * [SR41](../../../../../../docs/for-developers/modules/operate/features/see-what-ran.md)).
 */

import { formatDuration } from "@/lib/time";
import type {
	FlowNodeSpec,
	WithFlow,
} from "@/pages/graphs-detail/features/operate/dashboards/TaskFlowPanel";
import {
	type TaskGroup,
	VIEW_ACTION,
	VIEW_DASHBOARD,
	VIEW_SPEC,
	boundOf,
	compact,
	count,
	durationMs,
	ganttStatusOf,
	groupSteps,
	isLive,
	meterOf,
	offsetOf,
	omit,
	originOf,
	runTitle,
	specPanel,
	statusChip,
	tileToneOf,
	toneOf,
	usd,
} from "@/pages/graphs-detail/features/operate/dashboards/shared";
import type { TraceRead, TraceStepRead } from "@/services/api/runs";
import type { DashboardSpec, LogOptions, PanelSpec } from "@invana/dashboard";
import type { TaskGanttSegment, TaskGanttTask, TaskNodeTag } from "@invana/ui";

/** Action ids the page answers. The spec carries the string; the page carries the behaviour. */
export const RUN_ACTIONS = {
	view: VIEW_ACTION,
	cancel: "cancel",
	/** A Gantt row — filters the log to that task (SR15). */
	selectTask: "select-task",
	/** A flow card — opens that task's own dashboard (SR36). */
	openStep: "open-step",
} as const;

export interface RunDashboardView {
	/** `Dashboard` or `spec.json`. */
	view: string;
	/** The task the log is filtered to, by group key. */
	selectedKey: string | null;
}

/** How many cards the flow lays across before it wraps. */
const FLOW_COLUMNS = 4;

export function runDashboardSpec(
	trace: TraceRead,
	{ view, selectedKey }: RunDashboardView,
): DashboardSpec<WithFlow> {
	const groups = groupSteps(trace.steps);
	const live = isLive(trace.status);
	const selected = groups.find((g) => g.key === selectedKey) ?? null;

	const header: DashboardSpec<WithFlow>["header"] = {
		tone: toneOf(trace.status),
		crumbs: [runTitle(trace)],
		chips: omit([
			trace.ask_kind ? { label: trace.ask_kind } : null,
			statusChip(trace.status),
			trace.outcome && trace.outcome !== trace.status
				? { label: trace.outcome }
				: null,
			{ label: "run dashboard" },
		]),
		actions: omit([
			{
				id: RUN_ACTIONS.view,
				options: [VIEW_DASHBOARD, VIEW_SPEC],
				value: view,
			},
			// Cancel is the one thing this surface writes (SR8), and only while
			// there is something to stop.
			live
				? {
						id: RUN_ACTIONS.cancel,
						label: "Cancel",
						variant: "outline" as const,
					}
				: null,
		]),
	};

	const rows = bands(trace, groups, selected, selectedKey);
	const spec: DashboardSpec<WithFlow> = {
		title: runTitle(trace),
		header,
		rows,
	};

	// `spec.json` renders the document it is inside — the same spec, in one code
	// panel — which is what makes "a dashboard is data" checkable rather than
	// claimed ([CV13](../../../../../../docs/for-developers/modules/explore/features/boards.md)).
	return view === VIEW_SPEC
		? { ...spec, rows: [{ panels: [specPanel(spec)] }] }
		: spec;
}

/** The five bands, top to bottom — the artboard's own order. */
function bands(
	trace: TraceRead,
	groups: TaskGroup[],
	selected: TaskGroup | null,
	selectedKey: string | null,
): DashboardSpec<WithFlow>["rows"] {
	return omit([
		{ panels: [tiles(trace, groups)] },
		groups.length
			? { height: flowHeight(groups.length), panels: [flow(groups, selected)] }
			: null,
		groups.length
			? { panels: [performance(trace, groups, selectedKey)] }
			: null,
		{ panels: omit([input(trace), resultJson(trace)]) },
		{ panels: [log(trace, selected)] },
	]);
}

// ── the bands ───────────────────────────────────────────────────────────────

/** Tiles, bare — no `title`, so the strip sits on the surface rather than in a box. */
function tiles(trace: TraceRead, groups: TaskGroup[]): PanelSpec<WithFlow> {
	const done = groups.filter((g) => g.head.finished_at).length;
	const total = groups.length;
	const ms =
		trace.duration_ms ?? durationMs(originOf(trace), trace.finished_at);
	const tokens = (trace.tokens_in ?? 0) + (trace.tokens_out ?? 0);
	const rows = trace.emissions.reduce(
		(n, e) => n + (e.citation.record_count ?? 0),
		0,
	);
	const retried = groups.filter((g) => g.attempts > 1);
	const fanned = groups.filter((g) => g.lanes > 1);
	const live = isLive(trace.status);
	const ceilings = trace.budget ?? { max_tokens: null, max_cost_usd: null };

	return {
		kind: "metrics",
		options: {
			tiles: omit([
				total
					? {
							label: "Tasks",
							value: `${done} / ${total}`,
							caption: live ? trace.status : (trace.outcome ?? trace.status),
							tone: tileToneOf(trace.status),
							meter: total ? done / total : undefined,
						}
					: null,
				ms == null
					? null
					: {
							label: live ? "Elapsed" : "Duration",
							value: formatDuration(ms),
							caption: live ? "still running" : `${total} tasks`,
						},
				// `8.2k of 40k`, with the meter — and a bare `8.2k` when the run
				// had no agent, because the ceiling is the agent's (SR41).
				tokens
					? {
							label: "Tokens",
							value: ceilings.max_tokens
								? `${compact(tokens)} of ${compact(ceilings.max_tokens)}`
								: compact(tokens),
							caption: `in ${count(trace.tokens_in ?? 0)} · out ${count(trace.tokens_out ?? 0)}`,
							meter: meterOf(tokens, ceilings.max_tokens),
						}
					: null,
				// Absent when nothing this run ran had a published rate — never
				// `$0.00`, which would claim the run was free (SR40 · OB4).
				trace.cost_usd != null
					? {
							label: "Cost",
							value: ceilings.max_cost_usd
								? `${usd(trace.cost_usd)} of ${usd(ceilings.max_cost_usd)}`
								: usd(trace.cost_usd),
							caption: ceilings.max_cost_usd
								? "against the agent's ceiling"
								: "no ceiling on this run",
							meter: meterOf(trace.cost_usd, ceilings.max_cost_usd),
						}
					: null,
				rows
					? {
							label: "Rows",
							value: count(rows),
							caption: `${trace.emissions.length} emission${trace.emissions.length === 1 ? "" : "s"}`,
						}
					: null,
				retried.length
					? {
							label: "Retries",
							value: String(retried.length),
							caption: retried[0].taskKey,
							tone: "warning" as const,
						}
					: null,
				fanned.length
					? {
							label: "Lanes",
							value: String(Math.max(...fanned.map((g) => g.lanes))),
							caption: fanned[0].taskKey,
						}
					: null,
			]),
		},
	};
}

function flowHeight(nodes: number): number {
	// A card is ~96px on a 4-up grid; two rows is the artboard's own height.
	return Math.min(348, 84 + Math.ceil(nodes / FLOW_COLUMNS) * 108);
}

function flow(
	groups: TaskGroup[],
	selected: TaskGroup | null,
): PanelSpec<WithFlow> {
	const nodes: FlowNodeSpec[] = groups.map((group, i) => ({
		id: group.head.id,
		taskKey: group.key,
		bound: boundOf(group.head) ?? "none",
		// A task that never ran has no status of its own, and draws dim.
		status:
			group.head.status === "stopped" ? undefined : toneOf(group.head.status),
		dim: group.head.status === "stopped" || group.head.status === "queued",
		tags: omit<TaskNodeTag>([
			group.lanes > 1 ? { label: `${group.lanes} lanes` } : null,
			group.attempts > 1
				? { label: `attempt ${group.attempts}`, tone: "warning" as const }
				: null,
		]),
		meta: metaOf(group),
		gate: group.head.status === "needs_input",
		col: (i % FLOW_COLUMNS) + 1,
		row: Math.floor(i / FLOW_COLUMNS) + 1,
	}));

	return {
		kind: "flow",
		title: "The flow · status as it ran",
		aside: "click a task for its step detail ›",
		flush: true,
		options: {
			nodes,
			columns: FLOW_COLUMNS,
			selectedId: selected?.head.id ?? null,
			openAction: RUN_ACTIONS.openStep,
		},
	};
}

/** The one line under a card: what it did, and how long it took doing it. */
function metaOf(group: TaskGroup): string | undefined {
	const ms =
		group.head.duration_ms ??
		durationMs(group.head.started_at, group.head.finished_at);
	const parts = omit([
		group.head.detail || null,
		ms == null ? null : formatDuration(ms),
	]);
	return parts.length ? parts.join(" · ") : undefined;
}

function performance(
	trace: TraceRead,
	groups: TaskGroup[],
	selectedKey: string | null,
): PanelSpec<WithFlow> {
	const origin = originOf(trace);
	const live = isLive(trace.status);

	const tasks: TaskGanttTask[] = groups.map((group) => {
		const earlier = group.steps.slice(0, -1);
		return {
			key: group.key,
			label: group.label,
			status: ganttStatusOf(group.head.status),
			startedAt: group.head.started_at ?? undefined,
			finishedAt: group.head.finished_at ?? undefined,
			// A retry is segments to the left of the bar that stuck (SR21).
			attempts: earlier.length ? earlier.map(segmentOf) : undefined,
			log: group.head.detail || undefined,
			result: group.head.result ?? group.head.output ?? undefined,
			error: group.head.error
				? {
						code: String(group.head.error.cls ?? group.head.error.code ?? ""),
						message: String(group.head.error.message ?? ""),
						detail: String(group.head.error.cause ?? ""),
					}
				: undefined,
		};
	});

	return {
		id: "performance",
		kind: "gantt",
		title: "Performance",
		aside: performanceAside(groups, selectedKey),
		options: {
			tasks,
			labelWidth: 124,
			density: "comfortable",
			selectedKey,
			selectAction: RUN_ACTIONS.selectTask,
			nowMs:
				live && origin ? Date.now() - new Date(origin).getTime() : undefined,
			openEnded: live,
		},
	};
}

function segmentOf(step: TraceStepRead): TaskGanttSegment {
	return {
		startedAt: step.started_at ?? undefined,
		finishedAt: step.finished_at ?? undefined,
		status: ganttStatusOf(step.status),
	};
}

function performanceAside(
	groups: TaskGroup[],
	selectedKey: string | null,
): string | undefined {
	if (selectedKey) {
		const group = groups.find((g) => g.key === selectedKey);
		const ms =
			group?.head.duration_ms ??
			durationMs(group?.head.started_at, group?.head.finished_at);
		return group && ms != null
			? `${group.key} · ${formatDuration(ms)}`
			: undefined;
	}
	const retried = groups.filter((g) => g.attempts > 1).length;
	const never = groups.filter((g) => g.head.status === "stopped").length;
	const parts = omit([
		retried ? `${retried} retried` : null,
		never ? `${never} never ran` : null,
	]);
	return parts.length ? parts.join(" · ") : "where the time went";
}

/** What opened the run — the trace's own provenance, not a second record. */
function input(trace: TraceRead): PanelSpec<WithFlow> {
	return {
		kind: "properties",
		title: "Input · what opened this run",
		aside: "what the trace recorded",
		options: {
			rows: omit([
				trace.body ? { label: "asked", value: `"${trace.body}"` } : null,
				{
					label: "plan",
					value: trace.plan_origin ?? trace.workflow_key,
					mono: true,
				},
				trace.plan_revision
					? { label: "revision", value: `v${trace.plan_revision}` }
					: null,
				trace.agent_id
					? {
							label: "agent",
							value: trace.agent_version
								? `${trace.agent_id} · v${trace.agent_version}`
								: trace.agent_id,
							mono: true,
						}
					: null,
				{ label: "run", value: trace.run_id, mono: true },
				trace.error
					? {
							label: "error",
							value: String(trace.error.message ?? trace.error),
						}
					: null,
			]),
		},
	};
}

/**
 * `result.json`, when there is one.
 *
 * The column is declared and the runtime does not write it yet (SR17 · SR34),
 * so this returns nothing rather than an empty document — and the Input panel
 * takes the whole row, which is the honest drawing of a run with no result.
 */
function resultJson(trace: TraceRead): PanelSpec<WithFlow> | null {
	if (!trace.result) return null;
	return {
		kind: "json",
		title: isLive(trace.status) ? "result.json · so far" : "result.json",
		aside: "every task merges into it",
		flush: true,
		options: { maxHeight: 220, value: trace.result },
	};
}

/**
 * The log — one line per task, which is what a run records today (SR35).
 *
 * Picking a Gantt row filters it to that task (SR15); the lines a run wrote
 * about itself are not that task's lines, so they go with the filter.
 */
function log(
	trace: TraceRead,
	selected: TaskGroup | null,
): PanelSpec<WithFlow> {
	const steps = selected ? selected.steps : trace.steps;
	const lines: LogOptions["lines"] = omit(
		steps.map((step) =>
			step.detail
				? {
						time: offsetOf(trace, step.started_at),
						level: levelOf(step.status),
						source: step.task_key || step.step_key || undefined,
						message: step.detail,
					}
				: null,
		),
	);

	return {
		kind: "log",
		title: selected ? "Log · this task only" : "Log",
		aside: selected
			? `${lines.length} of ${trace.steps.length} lines`
			: `${lines.length} line${lines.length === 1 ? "" : "s"} · one per task`,
		flush: true,
		options: { lines },
	};
}

function levelOf(status: string): "info" | "warn" | "error" {
	if (status === "failed") return "error";
	if (status === "needs_input" || status === "stopped") return "warn";
	return "info";
}
