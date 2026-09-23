/**
 * What a run dashboard and a step dashboard agree on.
 *
 * Both are composed from one `GET …/runs/{id}/trace` ([SR30](../../../../../../docs/for-developers/modules/operate/features/see-what-ran.md)),
 * so the status vocabulary, the clock and the "is there a record for this?"
 * test are written once here rather than twice in two composers that would
 * drift.
 *
 * **A band with no record is absent, not zero** ([SR34](../../../../../../docs/for-developers/modules/operate/features/see-what-ran.md)).
 * `omit` is what that reads as in code: every optional tile and panel is built
 * through it, so "the runtime has not recorded this yet" never renders as
 * `$0.00` or `{}`.
 */

import type { TraceRead, TraceStepRead } from "@/services/api/runs";
import type { ChipSpec, Tone } from "@invana/dashboard";
import type { Bound, StatusDotProps, TaskGanttStatus } from "@invana/ui";

/** A run that has not settled — the Gantt grows a now line, Cancel is offered. */
export const LIVE_STATUSES: ReadonlySet<string> = new Set([
	"queued",
	"running",
	"run",
	"awaiting_input",
]);

export function isLive(status: string): boolean {
	return LIVE_STATUSES.has(status);
}

/**
 * The engine's status, as a dot tone.
 *
 * One mapping, because a Gantt row, a flow card, a header dot and a tile are
 * the same state seen four times and a second table is how they stop agreeing
 * ([SR21](../../../../../../docs/for-developers/modules/operate/features/see-what-ran.md)).
 */
const TONES: Record<string, StatusDotProps["tone"]> = {
	succeeded: "success",
	success: "success",
	running: "running",
	run: "running",
	queued: "queued",
	needs_input: "warning",
	awaiting_input: "warning",
	failed: "error",
	cancelled: "muted",
	stopped: "muted",
	skipped: "muted",
};

export function toneOf(status: string): StatusDotProps["tone"] {
	return TONES[status] ?? "muted";
}

/** The chip/panel tone vocabulary, which has no `queued`. */
export function chipToneOf(status: string): Tone | undefined {
	const tone = toneOf(status);
	return tone === "queued" || tone == null ? undefined : tone;
}

/** A tile's tone, which has no `muted` either — an unremarkable tile has none. */
export function tileToneOf(
	status: string,
): "running" | "success" | "warning" | "error" | "info" | undefined {
	const tone = chipToneOf(status);
	return tone === "muted" ? undefined : tone;
}

/** The Gantt's own vocabulary is the engine's, so this is a narrow, not a map. */
export function ganttStatusOf(status: string): TaskGanttStatus {
	return status as TaskGanttStatus;
}

/** A catalogue bound, when the trace named one the kit can draw. */
const BOUNDS: ReadonlySet<string> = new Set([
	"none",
	"network",
	"graph_read",
	"graph_write",
	"schema_write",
	"ingest",
	"llm",
	"plan_write",
	"work_write",
]);

export function boundOf(step: TraceStepRead): Bound | undefined {
	return step.bound && BOUNDS.has(step.bound)
		? (step.bound as Bound)
		: undefined;
}

/**
 * `omit` · `count` · the view switch · `specPanel` live in
 * `shared/dashboardSpec.ts`: Skills composes declared boards too, and a second
 * copy of `omit` is how two modules drift on what *absent* means
 * ([code-shape §4.1](../../../../../../docs/for-developers/building-studio/code-shape.md)).
 * They are re-exported here so this file stays the one import a run composer
 * needs.
 */
export {
	VIEW_ACTION,
	VIEW_DASHBOARD,
	VIEW_SPEC,
	count,
	omit,
	specPanel,
} from "@/pages/graphs-detail/shared/dashboardSpec";

/** `8.2k` — a token total, which is read as a magnitude rather than a number.
 *  It lives in `@/lib/format` now, because the journal row reads it too (SR45). */
export { formatCompact as compact } from "@/lib/format";

/**
 * `$0.04` · `$0.0013` · `<$0.0001` — money, never rounded to nothing.
 *
 * A haiku call on a few hundred tokens is fractions of a cent, and a tile
 * reading `$0.00` says *this was free* — the exact claim
 * [SR34](../../../../../../docs/for-developers/modules/operate/features/see-what-ran.md)
 * refuses to let an absent record make. `$0` is kept for a spend that genuinely
 * was zero, which is what a local model costs.
 */
export function usd(value: number): string {
	if (value === 0) return "$0";
	if (value < 0.0001) return "<$0.0001";
	if (value < 1)
		return `$${value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}`;
	return `$${value.toFixed(2)}`;
}

/**
 * `0`–`1` for a value that has a real ceiling, `undefined` for one that does not.
 *
 * [SR20](../../../../../../docs/for-developers/modules/operate/features/see-what-ran.md):
 * a spend without its ceiling is a number nobody can act on — so the meter is
 * drawn only when the trace carried a ceiling, and a run over its ceiling still
 * draws a full bar rather than one that overflows the tile.
 */
export function meterOf(
	value: number,
	ceiling: number | null | undefined,
): number | undefined {
	if (!ceiling || ceiling <= 0) return undefined;
	return Math.min(1, value / ceiling);
}

/** Milliseconds between two instants, `null` when either is missing. */
export function durationMs(
	from: string | null | undefined,
	to: string | null | undefined,
): number | null {
	if (!from) return null;
	const a = new Date(from).getTime();
	const b = to ? new Date(to).getTime() : Date.now();
	return Number.isFinite(a) && Number.isFinite(b) ? b - a : null;
}

/** The run's zero — the first step that started, or the run's own start. */
export function originOf(trace: TraceRead): string | null {
	return (
		trace.started_at ??
		trace.steps.find((s) => s.started_at)?.started_at ??
		null
	);
}

/**
 * `02.15` — a step's offset from the run's zero, as the log column reads it.
 *
 * Wall-clock time answers *when did this happen last Tuesday*; a run is read
 * for *how far in did it happen*, which is what the design's log column shows.
 */
export function offsetOf(
	trace: TraceRead,
	at: string | null,
): string | undefined {
	const origin = originOf(trace);
	if (!origin || !at) return undefined;
	const ms = durationMs(origin, at);
	if (ms == null || ms < 0) return undefined;
	const s = ms / 1000;
	return `${String(Math.floor(s / 60)).padStart(2, "0")}.${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

/** What a run is called: the words its opener wrote, else the plan that ran. */
export function runTitle(trace: TraceRead): string {
	return trace.body?.trim() || trace.workflow_key || "Run";
}

/** What a step is called: the plan's own id for the node, else the entry it names. */
export function stepTitle(step: TraceStepRead): string {
	return step.step_key || step.task_key || step.label || "step";
}

/** A status chip, in the words the engine uses for it. */
export function statusChip(status: string): ChipSpec {
	return { label: status, tone: chipToneOf(status) };
}

/**
 * One task, and every row the trace kept for it.
 *
 * A `TaskRun` row is one `(lane, iteration, attempt)` of a node, so a task that
 * retried or fanned out is several rows of one thing. Every surface here reads
 * the *task* — a flow card, a Gantt row, a `‹ ›` step — so the grouping is done
 * once and the three cannot disagree about how many tasks a run had.
 */
export interface TaskGroup {
	/** The plan's own id for the node, else the catalogue entry it names. */
	key: string;
	taskKey: string;
	label: string;
	/** The row that decides the group's state — the latest attempt. */
	head: TraceStepRead;
	/** Every row behind it, in `seq` order: earlier attempts, then lanes. */
	steps: TraceStepRead[];
	/** How many lanes it fanned out into. `1` when it did not. */
	lanes: number;
	/** The highest attempt number recorded. `1` when it never retried. */
	attempts: number;
}

export function groupSteps(steps: TraceStepRead[]): TaskGroup[] {
	const groups = new Map<string, TraceStepRead[]>();
	for (const step of steps) {
		const key = step.step_key || step.task_key || step.id;
		const rows = groups.get(key);
		if (rows) rows.push(step);
		else groups.set(key, [step]);
	}
	return [...groups.entries()].map(([key, rows]) => {
		const ordered = [...rows].sort(
			(a, b) => a.seq - b.seq || a.attempt - b.attempt,
		);
		const head = ordered[ordered.length - 1];
		return {
			key,
			taskKey: head.task_key || key,
			label: head.label || head.task_key || key,
			head,
			steps: ordered,
			lanes:
				new Set(ordered.map((s) => s.lane).filter((l) => l != null)).size || 1,
			attempts: Math.max(...ordered.map((s) => s.attempt)),
		};
	});
}

/** Find the group one of its rows belongs to — how `‹ ›` and a flow click land. */
export function groupOf(
	groups: TaskGroup[],
	stepId: string,
): TaskGroup | undefined {
	return groups.find((g) => g.steps.some((s) => s.id === stepId));
}
