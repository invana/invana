/**
 * A plan's `LayerStrip`, in the plan tense ([LB31](docs/for-developers/modules/workflows/features/the-library.md)).
 *
 * The same component a run draws on `scale="elapsed"`, here on `scale="seq"`:
 * a plan has no clock, so its axis is its own order and a node's `depth` is
 * that order — two steps at the same depth wait on the same thing, not on each
 * other. Every governed band is passed, declared or not, because *this plan
 * leaves the graph alone* is the fact a reader is checking for (D22).
 */

import type { TaskPlanDetail } from "@/pages/graphs-detail/features/plans/types";
import { layerSlug } from "@/ui/layerPalette";
import type { LayerBand, LayerItem } from "@invana/ui";

export function planLayerStrip(
	plan: TaskPlanDetail,
	/** Each step's p50 over the page's window, as the bar carries it. */
	p50?: Map<string, string>,
): { bands: LayerBand[]; items: LayerItem[] } {
	// A band's participants are the catalogue entries the plan's own steps name
	// — derived from the nodes rather than sent beside them, because the nodes
	// are what the canvas draws and a second list would be a second truth.
	const partsOf = (layer: string) => [
		...new Set(
			plan.nodes.filter((n) => n.layer === layer && n.task).map((n) => n.task),
		),
	];

	const bands: LayerBand[] = plan.declared_layers.map((band) => ({
		layer: layerSlug(band.layer),
		// The engine phrases the summary — `2 steps` · `—` — so the band says
		// what it declares in the same words the list row does.
		note: band.summary,
		parts: band.declared
			? partsOf(band.layer).map((task) => ({ id: task, label: task }))
			: [],
	}));

	const items: LayerItem[] = plan.nodes.map((node) => ({
		id: node.id,
		label: p50?.get(node.id)
			? `${node.label} · ${p50.get(node.id)}`
			: node.label,
		layer: layerSlug(node.layer),
		// A human step has no catalogue entry, so it sits on the band itself.
		part: node.task || undefined,
		start: node.depth,
		end: node.depth + 1,
		// What the plan **will** engage. What a run did engage is the run's
		// strip, and the two states are deliberately not the same word.
		state: "declared",
		note: node.form === "human" ? "form: human" : undefined,
	}));

	return { bands, items };
}
