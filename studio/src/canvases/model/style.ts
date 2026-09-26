/**
 * The one style config cannot say: a stitch is dashed (GM9).
 *
 * A dash cannot be bound to a field, and "no dash" is not a value a resolver
 * can return — so a stitch carries its own dashed style, and a model's own
 * edge type keeps the template's solid line. Everything else, frames included,
 * is `settings.json`.
 */

import type { LiveColors } from "@/canvases/model/config";
import type { ModelEdgeData, ModelGraphData } from "@/canvases/model/types";
import type { EdgeStyle, GraphData } from "@invana/graph";

const STITCH_DASH: [number, number] = [6, 4];

function stitchStyle(d: ModelEdgeData, success: number): EdgeStyle | undefined {
	if (d.kind === "edge") return undefined;
	// Staged reads differently from committed: what is about to land (ST21).
	return d.staged
		? { strokeDashArray: STITCH_DASH, strokeColor: success, strokeWidth: 2 }
		: { strokeDashArray: STITCH_DASH };
}

/** The data as `<GraphLayer>` draws it — stitches carry their dash. */
export function decorate(data: ModelGraphData, colors: LiveColors): GraphData {
	const edges = data.edges.map((e) => {
		const style = stitchStyle(e.data, colors.success);
		return style ? { ...e, style } : e;
	});
	return { nodes: data.nodes, edges } as unknown as GraphData;
}
