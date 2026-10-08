/**
 * A plan's layers, in the plan tense ([the-library.md](docs/for-developers/modules/workflows/features/the-library.md)).
 *
 * The same `gantt` block a run draws on `scale: "elapsed"`, here on
 * `scale: "seq"`: a plan has no clock, so its axis is its own order and a
 * node's `depth` is that order — two steps at the same depth wait on the same
 * thing, not on each other. A row per layer opens into the catalogue entries
 * the plan names, and each step is a dashed bar — declared, not yet spent.
 * Every governed layer is passed, declared or not, because *this plan leaves
 * the graph alone* is the fact a reader is checking for.
 */

import type { GanttOptions, GanttSpecRow } from "@invana/blocks";
import type { TaskPlanDetail } from "@/pages/graphs-detail/features/plans/types";
import { LAYER_SWATCHES, layerSlug } from "@/ui/layerPalette";

export function planLayersGantt(
	plan: TaskPlanDetail,
	/** Each step's p50 over the page's window, as the bar carries it. */
	p50?: Map<string, string>,
): GanttOptions {
	const tasks: GanttSpecRow[] = plan.declared_layers.map((band) => {
		const layer = layerSlug(band.layer);
		const nodes = plan.nodes.filter((n) => layerSlug(n.layer) === layer);
		// A row's participants are the catalogue entries the plan's own steps
		// name — derived from the nodes rather than sent beside them, because
		// the nodes are what the canvas draws and a second list would be a
		// second truth. A human step has no entry, so it sits on the layer row.
		const parts = new Map<string, GanttSpecRow>();
		const own: GanttSpecRow["segments"] = [];
		for (const node of nodes) {
			const bar = {
				key: node.id,
				label: node.label,
				startMs: node.depth,
				durationMs: 1,
				group: layer,
				variant: "dashed" as const,
				note:
					node.form === "human"
						? "form: human"
						: (p50?.get(node.id) ?? undefined),
			};
			if (!band.declared || !node.task) {
				own.push(bar);
				continue;
			}
			const part = parts.get(node.task) ?? { key: node.task, segments: [] };
			part.segments?.push(bar);
			parts.set(node.task, part);
		}
		return {
			key: layer,
			label: band.layer,
			// The engine phrases the summary — `2 steps` · `—` — so the row says
			// what it declares in the same words the list row does.
			duration: band.summary,
			open: parts.size > 0,
			segments: own.length ? own : undefined,
			subtasks: [...parts.values()],
		};
	});

	// One tick per step, so the axis reads `step 0 … step n` and never repeats one.
	const steps = Math.max(1, ...plan.nodes.map((n) => n.depth + 1));
	return {
		tasks,
		scale: "seq",
		spanMs: steps,
		ticks: steps,
		palette: LAYER_SWATCHES,
	};
}
