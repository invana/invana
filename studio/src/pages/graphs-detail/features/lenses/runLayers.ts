/**
 * The run's ledger, as the **kit's** `gantt` block reads it — a row per layer,
 * opening into its participants, a bar per touch.
 *
 * *As someone reading an answer I am about to act on, I want to see which
 * participants each step engaged and which ones it was refused, in the order it
 * happened, so that "what grounded this" is a drawing rather than a log I
 * reconstruct.*
 *
 * **This file composes; it does not render.** `@invana/blocks` ships the
 * `gantt` block, so Studio's job is the one thing the kit cannot know: how a
 * `TouchesResponse` and a trace become rows and bars. A renderer here would be a second drawing of the same
 * data, which is what [design-system.md](../../../../../docs/for-developers/modules/platform/features/design-system.md)
 * exists to stop.
 *
 * Three things here are the design:
 *
 * - **A refusal is struck in place, never filtered out.** It keeps its position
 *   on the axis, so a gap still means *nothing reached for this layer here* and
 *   cannot be mistaken for a denial. That is the kit's own behaviour
 *   ([governance.md](../../../../../docs/for-developers/governance.md)); this file's part
 *   is to pass refusals through rather than dropping them on the way in.
 * - **A layer nothing touched is muted, never dropped**
 *   ([governance.md](../../../../../docs/for-developers/governance.md)). All six layer
 *   rows are always passed, because *the run never went near a third party* and
 *   *this surface does not show third parties* are different facts about a run.
 * - **The axis is the trace's clock, or it is the ledger's order — never a
 *   guess between them.** A touch has a `seq` and a duration but no start of
 *   its own, so its bar is the window of the **step** it belongs to, read off
 *   `GET …/runs/{id}/trace`. If any touch cannot be placed on that clock the
 *   whole gantt falls back to `seq`, because a drawing half on a wall clock and
 *   half on an ordinal is a drawing that lies about both
 *   ([design-system.md](../../../../../docs/for-developers/modules/platform/features/design-system.md)).
 *
 * The spine is a row like the rest: `agent` is the runtime doing the
 * participating rather than being a participant.
 */

import type { GanttOptions, GanttSpecBar, GanttSpecRow } from "@invana/blocks";
import type { Layer } from "@invana/ui";
import type {
	Touch,
	TouchesResponse,
} from "@/pages/graphs-detail/features/lenses/types";
import type { TraceStepRead } from "@/pages/graphs-detail/features/runs";
import { LAYER_SWATCHES } from "@/ui/layerPalette";

/** Every layer, spine last — the order the rows are read in. */
export const BANDS: Layer[] = [
	"graph_data",
	"llm",
	"third_party",
	"cache",
	"human",
	"agent",
];

/** How a touch's direction reads under its bar. */
const DIRECTION_LABEL: Record<Touch["direction"], string> = {
	in: "read",
	out: "sent",
	refused: "refused",
	skipped: "skipped",
};

/** `read` · `sent` · `refused` — a touch's direction, in the reader's words. */
export function directionLabel(direction: Touch["direction"]): string {
	return DIRECTION_LABEL[direction];
}

/** A bar's key: the step it belongs to, then the touch's `seq` — `fetch#12`. */
export function touchKey(touch: Pick<Touch, "step_key" | "seq">): string {
	return `${touch.step_key ?? ""}#${touch.seq}`;
}

/** The step a bar's key names, as {@link touchKey} wrote it. */
export function stepKeyOfTouch(key: string): string {
	return key.slice(0, key.lastIndexOf("#"));
}

/** Milliseconds from the run opening, or `null` when the step is untimed. */
function windowOf(
	step: TraceStepRead | undefined,
	t0: number | null,
): { start: number; end?: number } | null {
	if (!step || t0 === null || !step.started_at) return null;
	const start = Date.parse(step.started_at) - t0;
	if (Number.isNaN(start)) return null;
	const finished = step.finished_at ? Date.parse(step.finished_at) : Number.NaN;
	// A step still running has a start and no end: an instant is the honest
	// drawing, not a bar stretched to "now".
	return Number.isNaN(finished)
		? { start }
		: { start, end: Math.max(finished - t0, start) };
}

/**
 * The ledger, as the gantt reads it — one bar per touch, on the row of the
 * participant it spent.
 *
 * Bars are derived from the touches rather than from the trace's tasks: a touch
 * carries the `seq` it was projected from and the address it engaged,
 * and a step that engaged nothing has nothing to draw. The trace is read only
 * for *when* — which step ran between which two moments.
 */
export function layersOptions(
	touches: TouchesResponse | undefined,
	steps: TraceStepRead[] = [],
	opts: { selected?: string | null } = {},
): GanttOptions {
	const ledger = [...(touches?.items ?? [])].sort((a, b) => a.seq - b.seq);

	const byStepKey = new Map<string, TraceStepRead>();
	for (const step of steps) {
		if (step.step_key && !byStepKey.has(step.step_key))
			byStepKey.set(step.step_key, step);
	}
	const starts = steps
		.map((s) => (s.started_at ? Date.parse(s.started_at) : Number.NaN))
		.filter((n) => !Number.isNaN(n));
	const t0 = starts.length ? Math.min(...starts) : null;

	// Every touch must place on the clock, or none of them do.
	const windows = ledger.map((touch) =>
		windowOf(touch.step_key ? byStepKey.get(touch.step_key) : undefined, t0),
	);
	const elapsed = ledger.length > 0 && windows.every((w) => w !== null);

	const rows = new Map<Layer, Map<string, GanttSpecRow>>();
	ledger.forEach((touch, i) => {
		const window = windows[i];
		// A refusal happens **before dispatch** — it has no span, so it is an
		// instant at the leading edge of the step it was refused in.
		const refused = touch.direction === "refused";
		const span =
			elapsed && window
				? {
						startMs: window.start,
						durationMs: refused
							? 0
							: (window.end ?? window.start) - window.start,
					}
				: { startMs: touch.seq, durationMs: 1 };
		const bar: GanttSpecBar = {
			key: touchKey(touch),
			label: touch.step_key ?? `seq ${touch.seq}`,
			group: touch.layer,
			note: directionLabel(touch.direction),
			status: refused
				? "refused"
				: touch.direction === "skipped"
					? "skipped"
					: undefined,
			title: touch.rule_matched
				? `${touch.step_key ?? `seq ${touch.seq}`} · refused by ${touch.rule_matched}`
				: undefined,
			...span,
		};
		const layer = touch.layer as Layer;
		const parts = rows.get(layer) ?? new Map<string, GanttSpecRow>();
		const part = parts.get(touch.address) ?? {
			key: touch.address,
			summary:
				touch.participant === touch.address ? undefined : touch.participant,
			segments: [],
		};
		part.segments?.push(bar);
		parts.set(touch.address, part);
		rows.set(layer, parts);
	});

	return {
		// The note carries the count, so a muted row says *nothing touched*
		// rather than leaving the reader to infer it from an empty track.
		tasks: BANDS.map((layer) => {
			const parts = [...(rows.get(layer)?.values() ?? [])];
			const n = parts.reduce((sum, p) => sum + (p.segments?.length ?? 0), 0);
			return {
				key: layer,
				label: layer.replace(/_/g, " "),
				duration: `${n} touch${n === 1 ? "" : "es"}`,
				open: parts.length > 0,
				subtasks: parts,
			};
		}),
		scale: elapsed ? "elapsed" : "seq",
		palette: LAYER_SWATCHES,
		selected: opts.selected ?? undefined,
	};
}
