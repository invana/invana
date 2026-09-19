/**
 * A step dashboard, composed — artboards **D2 · D3 · D4** ([34l–34n](../../../../../../docs/for-developers/the-screens.md)).
 *
 * **One shell for every task kind, and Output is the only branch**
 * ([SR18](../../../../../../docs/for-developers/modules/operate/features/see-what-ran.md) ·
 * [SR31](../../../../../../docs/for-developers/modules/operate/features/see-what-ran.md)):
 * breadcrumb · tiles · Input · `result.json` · Output · Artifacts · Log · where
 * it sits, identical for `import_dataset`, `execute_graph_query` and
 * `understand_intent`. The Output panel is picked from **the shape the step
 * recorded**, never from its `task_key` — rows are a table, a prompt and a
 * completion are an exchange, records written are properties — so a new
 * catalogue entry ships a surface by recording one of those shapes.
 */

import { formatDuration } from "@/lib/time";
import {
	type TaskGroup,
	VIEW_ACTION,
	VIEW_DASHBOARD,
	VIEW_SPEC,
	boundOf,
	compact,
	count,
	durationMs,
	groupSteps,
	isLive,
	offsetOf,
	omit,
	runTitle,
	specPanel,
	statusChip,
	stepTitle,
	tileToneOf,
	toneOf,
	usd,
} from "@/pages/graphs-detail/features/operate/dashboards/shared";
import type { TraceRead, TraceStepRead } from "@/services/api/runs";
import type { DashboardSpec, PanelSpec, TableOptions } from "@invana/dashboard";

export const STEP_ACTIONS = {
	view: VIEW_ACTION,
	prev: "prev",
	next: "next",
	/** The run this step sits in — the first crumb. */
	openRun: "open-run",
	openArtifact: "open-artifact",
} as const;

export interface StepDashboardView {
	view: string;
}

/** Everything the page resolved before composing: which step, and its neighbours. */
export interface StepContext {
	group: TaskGroup;
	prev: TaskGroup | null;
	next: TaskGroup | null;
}

/** Locate a step run in its trace, with the task before and after it. */
export function stepContext(
	trace: TraceRead,
	stepId: string,
): StepContext | null {
	const groups = groupSteps(trace.steps);
	const index = groups.findIndex((g) => g.steps.some((s) => s.id === stepId));
	if (index < 0) return null;
	return {
		group: groups[index],
		prev: groups[index - 1] ?? null,
		next: groups[index + 1] ?? null,
	};
}

export function stepDashboardSpec(
	trace: TraceRead,
	{ group, prev, next }: StepContext,
	{ view }: StepDashboardView,
): DashboardSpec {
	const step = group.head;
	const bound = boundOf(step);

	const header: DashboardSpec["header"] = {
		tone: toneOf(step.status),
		// Two crumbs: a run, then the task inside it — which is what a child
		// record is, and why `RecordHeader` takes a list.
		crumbs: [runTitle(trace), stepTitle(step)],
		chips: omit([
			bound ? { bound, label: bound } : null,
			statusChip(step.status),
			{ label: "step dashboard" },
		]),
		actions: omit([
			{
				id: STEP_ACTIONS.prev,
				icon: "prev",
				variant: "ghost" as const,
				disabled: !prev,
			},
			{
				id: STEP_ACTIONS.next,
				icon: "next",
				variant: "ghost" as const,
				disabled: !next,
			},
			{
				id: STEP_ACTIONS.view,
				options: [VIEW_DASHBOARD, VIEW_SPEC],
				value: view,
			},
		]),
	};

	const rows = bands(trace, group);
	const spec: DashboardSpec = { title: stepTitle(step), header, rows };
	return view === VIEW_SPEC
		? { ...spec, rows: [{ panels: [specPanel(spec)] }] }
		: spec;
}

/** The bands, top to bottom — the same seven for every kind. */
function bands(trace: TraceRead, group: TaskGroup): DashboardSpec["rows"] {
	const step = group.head;
	return omit([
		{ panels: [tiles(trace, group)] },
		{ panels: omit([input(step), resultJson(step)]) },
		output(step) ? { panels: [output(step) as PanelSpec] } : null,
		{ panels: omit([log(trace, group), artifacts(step)]) },
		{ panels: [whereItSits(trace, group)] },
	]);
}

// ── tiles ───────────────────────────────────────────────────────────────────

/**
 * Status and Duration for every kind; then whatever this one actually recorded.
 *
 * The kind-specific tiles read the step's **outputs**, which is the same
 * contract the Output panel reads — `written`, `rows`, tokens — so a tile
 * cannot claim something the panel below it does not show.
 */
function tiles(trace: TraceRead, group: TaskGroup): PanelSpec {
	const step = group.head;
	const out = outputs(step);
	const ms = step.duration_ms ?? durationMs(step.started_at, step.finished_at);
	const runMs =
		trace.duration_ms ?? durationMs(trace.started_at, trace.finished_at);
	const tokens = (step.tokens_in ?? 0) + (step.tokens_out ?? 0);
	const written = numberAt(out, "written");
	const rows =
		numberAt(out, "rows") ??
		numberAt(out, "count") ??
		numberAt(out, "row_count");

	return {
		kind: "metrics",
		options: {
			tiles: omit([
				{
					label: "Status",
					value: step.status,
					caption:
						group.attempts > 1 ? `attempt ${group.attempts}` : "first attempt",
					tone: tileToneOf(step.status),
				},
				ms == null
					? null
					: {
							label: isLive(step.status) ? "Elapsed" : "Duration",
							value: formatDuration(ms),
							caption: shareOfRun(ms, runMs),
						},
				written != null
					? {
							label: "Written",
							value: count(written),
							caption: readCaption(out),
						}
					: null,
				rows != null
					? { label: "Rows", value: count(rows), caption: "recorded" }
					: null,
				tokens
					? {
							label: "Tokens",
							value: compact(tokens),
							caption: `in ${count(step.tokens_in ?? 0)} · out ${count(step.tokens_out ?? 0)}`,
						}
					: null,
				// The ceiling belongs to the run, not to one of its tasks — so a
				// step's spend is drawn as its share of the run's (SR41), and is
				// absent entirely when the model had no published rate (SR40).
				step.cost_usd != null
					? {
							label: "Cost",
							value: usd(step.cost_usd),
							caption: shareOfSpend(step.cost_usd, trace.cost_usd),
						}
					: null,
				group.lanes > 1
					? {
							label: "Lanes",
							value: String(group.lanes),
							caption: "fanned out",
						}
					: null,
			]),
		},
	};
}

/**
 * `72% of the run` — and `<1%` rather than `0%`.
 *
 * A step that took 14ms of a 9s run did not take none of it, and a tile that
 * says `0%` reads as *this did not happen*.
 */
function shareOfRun(ms: number, runMs: number | null): string | undefined {
	if (!runMs || runMs <= 0) return undefined;
	const share = (ms / runMs) * 100;
	return share < 1 ? "<1% of the run" : `${Math.round(share)}% of the run`;
}

/** `31% of the run's spend` — the same reading the duration tile gives time. */
function shareOfSpend(
	usdSpent: number,
	runUsd: number | null,
): string | undefined {
	if (!runUsd || runUsd <= 0) return undefined;
	const share = (usdSpent / runUsd) * 100;
	return share < 1
		? "<1% of the run's spend"
		: `${Math.round(share)}% of the run's spend`;
}

function readCaption(out: Record<string, unknown>): string | undefined {
	const read = numberAt(out, "read") ?? numberAt(out, "total");
	const reported = numberAt(out, "reported") ?? numberAt(out, "rejected");
	if (read != null) return `of ${count(read)} read`;
	if (reported != null) return `${count(reported)} reported`;
	return undefined;
}

// ── Input · result.json ─────────────────────────────────────────────────────

/**
 * The request as it actually ran — `args`, after `${…}` binding (SR33).
 *
 * `input` is the digest a step chose to record about itself; `args` is what it
 * was asked to do. The design's band is the second, and it falls back to the
 * first only when a step recorded no args at all.
 */
function input(step: TraceStepRead): PanelSpec | null {
	const args = step.args ?? step.input;
	if (!args || !Object.keys(args).length) return null;
	return {
		kind: "properties",
		title: "Input · the request, resolved",
		aside: step.args ? "args after ${…} binding" : "what the step recorded",
		options: {
			rows: Object.entries(args).map(([label, value]) => ({
				label,
				value: scalar(value),
				mono: true,
			})),
		},
	};
}

function resultJson(step: TraceStepRead): PanelSpec | null {
	if (!step.result) return null;
	return {
		kind: "json",
		title: "result.json",
		aside: "what this task recorded",
		width: 340,
		flush: true,
		options: { maxHeight: 232, value: step.result },
	};
}

// ── Output — the one band that differs (SR31) ───────────────────────────────

function output(step: TraceStepRead): PanelSpec | null {
	const out = outputs(step);
	if (!Object.keys(out).length) return null;

	const rows = tableRows(out);
	if (rows) return rows;

	const exchange = exchangeBlocks(out);
	if (exchange) return exchange;

	const written = graphWritten(out);
	if (written) return written;

	// Recorded, but in a shape with no panel of its own: show the document
	// rather than nothing, which is what `result.json` does one row up.
	return {
		kind: "json",
		title: "Output",
		aside: "what this task recorded",
		flush: true,
		options: { maxHeight: 240, value: out },
	};
}

/** Rows → a table. The first few, with the count in the aside. */
function tableRows(out: Record<string, unknown>): PanelSpec | null {
	const value = out.rows ?? out.records ?? out.results;
	if (!Array.isArray(value) || !value.length) return null;
	const sample = value.slice(0, 20).filter(isRecord);
	if (!sample.length) return null;

	const keys = [...new Set(sample.flatMap((row) => Object.keys(row)))].slice(
		0,
		8,
	);
	const columns: TableOptions["columns"] = keys.map((key) => ({
		key,
		label: key,
		align: sample.every((row) => typeof row[key] === "number")
			? "right"
			: "left",
	}));

	return {
		kind: "table",
		title: "Output · rows",
		aside: `${count(value.length)} rows · first ${sample.length}`,
		flush: true,
		options: {
			columns,
			rows: sample.map((row) => {
				const out: Record<string, string | number | null> = {};
				for (const key of keys) {
					const cell = row[key];
					out[key] =
						cell == null
							? null
							: typeof cell === "number"
								? cell
								: scalar(cell);
				}
				return out;
			}),
		},
	};
}

/** A prompt and a completion → the exchange, as it was recorded. */
function exchangeBlocks(out: Record<string, unknown>): PanelSpec | null {
	const prompt = stringAt(out, "prompt");
	const completion =
		stringAt(out, "completion") ??
		stringAt(out, "response") ??
		stringAt(out, "answer");
	if (!prompt && !completion) return null;

	return {
		kind: "exchange",
		title: "Output · the exchange",
		aside: "prompt and completion, as recorded",
		options: {
			blocks: omit([
				prompt
					? {
							label: labelled("Prompt", numberAt(out, "tokens_in")),
							value: prompt,
						}
					: null,
				completion
					? {
							label: labelled("Completion", numberAt(out, "tokens_out")),
							value: completion,
							language: completion.trimStart().startsWith("{")
								? ("json" as const)
								: undefined,
						}
					: null,
			]),
		},
	};
}

function labelled(word: string, tokens: number | null): string {
	return tokens == null ? word : `${word} · ${count(tokens)} tokens`;
}

/** Records written → what landed in the graph, as properties. */
function graphWritten(out: Record<string, unknown>): PanelSpec | null {
	const graph = isRecord(out.graph) ? out.graph : null;
	const written = numberAt(out, "written");
	if (!graph && written == null) return null;

	const nodes = graph && isRecord(graph.nodes) ? graph.nodes : null;
	const edges = graph && isRecord(graph.edges) ? graph.edges : null;

	return {
		kind: "properties",
		title: "Output · graph data",
		aside: "what this task wrote",
		options: {
			rows: omit([
				written == null ? null : { label: "written", value: count(written) },
				...Object.entries(nodes ?? {}).map(([label, value]) => ({
					label,
					value: `${scalar(value)} nodes`,
				})),
				...Object.entries(edges ?? {}).map(([label, value]) => ({
					label,
					value: `${scalar(value)} edges`,
				})),
				stringAt(out, "model")
					? { label: "model", value: stringAt(out, "model") as string }
					: null,
				stringAt(out, "mode")
					? { label: "mode", value: stringAt(out, "mode") as string }
					: null,
			]),
		},
	};
}

// ── Log · Artifacts · where it sits ─────────────────────────────────────────

function log(trace: TraceRead, group: TaskGroup): PanelSpec {
	const lines = omit(
		group.steps.map((step) =>
			step.detail
				? {
						time: offsetOf(trace, step.started_at),
						level:
							step.status === "failed"
								? ("error" as const)
								: step.status === "needs_input" || step.status === "stopped"
									? ("warn" as const)
									: ("info" as const),
						source: step.task_key || undefined,
						message: step.detail,
					}
				: null,
		),
	);
	return {
		kind: "log",
		title: "Log · this task only",
		aside: `${lines.length} line${lines.length === 1 ? "" : "s"}`,
		flush: true,
		options: { lines },
	};
}

/** The files it read and wrote — from `result.artifacts`, or absent (SR34). */
function artifacts(step: TraceStepRead): PanelSpec | null {
	const listed = step.result?.artifacts;
	if (!Array.isArray(listed) || !listed.length) return null;

	return {
		kind: "list",
		title: "Artifacts",
		aside: String(listed.length),
		width: 340,
		options: {
			items: listed.map((entry, i) => {
				const row = isRecord(entry) ? entry : { name: scalar(entry) };
				const name =
					stringAt(row, "name") ?? stringAt(row, "path") ?? `artifact ${i + 1}`;
				const direction = stringAt(row, "direction") ?? stringAt(row, "kind");
				return {
					id: name,
					icon: "file",
					title: name,
					mono: true,
					meta: stringAt(row, "size") ?? stringAt(row, "summary") ?? undefined,
					chip: direction ? { label: direction } : undefined,
					action: STEP_ACTIONS.openArtifact,
				};
			}),
		},
	};
}

function whereItSits(trace: TraceRead, group: TaskGroup): PanelSpec {
	const step = group.head;
	return {
		kind: "properties",
		title: "Where it sits",
		width: 340,
		options: {
			rows: omit([
				{ label: "run", value: runTitle(trace) },
				{
					label: "plan task",
					value: step.step_key ?? step.task_key,
					mono: true,
				},
				{ label: "catalogue", value: step.task_key || "—", mono: true },
				{
					label: "lane",
					value: group.lanes > 1 ? `${group.lanes} lanes` : (step.lane ?? "—"),
				},
				{ label: "attempt", value: `${step.attempt} of ${group.attempts}` },
				{
					label: "parent",
					value: trace.workflow_key || "root run",
					mono: true,
				},
			]),
		},
	};
}

// ── reading a recorded document ─────────────────────────────────────────────

/** What a step declared it produced — `result.outputs` first, then `output`. */
function outputs(step: TraceStepRead): Record<string, unknown> {
	const declared = step.result?.outputs;
	if (isRecord(declared)) return { ...step.output, ...declared };
	return step.output ?? {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberAt(source: Record<string, unknown>, key: string): number | null {
	const value = source[key];
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringAt(source: Record<string, unknown>, key: string): string | null {
	const value = source[key];
	return typeof value === "string" && value.length ? value : null;
}

/** One cell of a properties row: a scalar as written, anything else as JSON. */
function scalar(value: unknown): string {
	if (value == null) return "—";
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean")
		return String(value);
	return JSON.stringify(value);
}
