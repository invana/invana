/**
 * The run's ledger, as the **kit's** layer strip reads it.
 *
 * *As someone reading an answer I am about to act on, I want to see which
 * participants each step engaged and which ones it was refused, in the order it
 * happened, so that "what grounded this" is a drawing rather than a log I
 * reconstruct.*
 *
 * **This file composes; it does not render.** `@invana/dashboard` ships the
 * `layers` panel and `@invana/ui` ships `LayerStrip`, so Studio's job is the
 * one thing neither of them can know: how a `TouchesResponse` and a trace
 * become bands and bars. A renderer here would be a second drawing of the same
 * data, which is what [DS17](../../../../../docs/for-developers/modules/platform/features/design-system.md)
 * exists to stop.
 *
 * Three things here are the design:
 *
 * - **A refusal is struck in place, never filtered out.** It keeps its position
 *   on the axis, so a gap still means *nothing reached for this layer here* and
 *   cannot be mistaken for a denial. That is the kit's own behaviour
 *   ([D20](../../../../../docs/for-developers/governance.md)); this file's part
 *   is to pass refusals through rather than dropping them on the way in.
 * - **A layer nothing touched is muted, never dropped**
 *   ([D22](../../../../../docs/for-developers/governance.md)). All six bands
 *   are always passed, because *the run never went near a third party* and
 *   *this surface does not show third parties* are different facts about a run.
 * - **The axis is the trace's clock, or it is the ledger's order — never a
 *   guess between them.** A touch has a `seq` and a duration but no start of
 *   its own, so its bar is the window of the **step** it belongs to, read off
 *   `GET …/runs/{id}/trace`. If any touch cannot be placed on that clock the
 *   whole strip falls back to `seq`, because a drawing half on a wall clock and
 *   half on an ordinal is a drawing that lies about both
 *   ([DS15](../../../../../docs/for-developers/modules/platform/features/design-system.md)).
 *
 * The spine is a band like the rest and says so: `agent` is the runtime doing
 * the participating rather than being a participant, so its wire runs the whole
 * axis and it is never drawn as unspent.
 */

import type { TraceStepRead } from "@/services/api/runs";
import type { Touch, TouchesResponse } from "@/types/govern";
import { LAYER_PALETTE } from "@/ui/layerPalette";
import type { LayersOptions } from "@invana/dashboard";
import type { Layer, LayerItem } from "@invana/ui";

/** Every layer, spine last — the order the bands are read in. */
export const BANDS: Layer[] = [
	"graph_data",
	"llm",
	"third_party",
	"cache",
	"human",
	"agent",
];

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
 * The ledger, as the strip reads it — one bar per touch, on the row of the
 * participant it spent.
 *
 * Bars are derived from the touches rather than from the trace's tasks: a touch
 * carries the `seq` it was projected from (GV20) and the address it engaged,
 * and a step that engaged nothing has nothing to draw. The trace is read only
 * for *when* — which step ran between which two moments.
 */
export function layersOptions(
	touches: TouchesResponse | undefined,
	steps: TraceStepRead[] = [],
	opts: { selectedItem?: string | null; selectAction?: string } = {},
): LayersOptions {
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

	const items: LayerItem[] = ledger.map((touch, i) => {
		const window = windows[i];
		// A refusal happens **before dispatch** — it has no span, so it is an
		// instant at the leading edge of the step it was refused in.
		const refused = touch.direction === "refused";
		const span =
			elapsed && window
				? refused
					? { start: window.start }
					: window
				: { start: touch.seq, end: touch.seq + 1 };
		return {
			id: `${touch.seq}-${touch.address}`,
			label: touch.step_key ?? `seq ${touch.seq}`,
			layer: touch.layer as Layer,
			part: touch.address,
			state: touch.direction,
			note: touch.participant,
			ruleMatched: touch.rule_matched ?? undefined,
			...span,
		};
	});

	const counts = new Map<Layer, number>();
	const parts = new Map<Layer, Map<string, Touch>>();
	for (const touch of ledger) {
		const layer = touch.layer as Layer;
		counts.set(layer, (counts.get(layer) ?? 0) + 1);
		const seen = parts.get(layer) ?? new Map<string, Touch>();
		if (!seen.has(touch.address)) seen.set(touch.address, touch);
		parts.set(layer, seen);
	}

	return {
		bands: BANDS.map((layer) => ({
			layer,
			// The note carries the count, so a muted band says *nothing touched*
			// rather than leaving the reader to infer it from an empty row.
			note: `${counts.get(layer) ?? 0} touch${counts.get(layer) === 1 ? "" : "es"}`,
			parts: [...(parts.get(layer)?.values() ?? [])].map((touch) => ({
				id: touch.address,
				label: touch.address,
				note:
					touch.participant === touch.address ? undefined : touch.participant,
			})),
			// The runtime's own dispatches — what the other bands are timed
			// against, and the one band that is never governed.
			spine: layer === "agent",
		})),
		items,
		scale: elapsed ? "elapsed" : "seq",
		palette: LAYER_PALETTE,
		selectedItem: opts.selectedItem,
		selectAction: opts.selectAction,
	};
}
