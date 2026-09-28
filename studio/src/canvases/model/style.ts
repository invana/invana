/**
 * The two styles config cannot say (GM8, GM9).
 *
 * A styling template cannot bind a colour to a field, so a frame carries its
 * model's hue as its own style — only the wash and the border; the tab, the
 * group and the label stay `settings.json`'s, because a per-node style
 * overrides the template field by field. A dash cannot be bound to a field
 * either, and "no dash" is not a value a resolver can return, so a stitch
 * carries its own dashed style and a model's own edge type keeps the
 * template's solid line.
 */

import type { EdgeStyle, GraphData, NodeStyle } from "@invana/graph";
import type { LiveColors } from "@/canvases/model/config";
import {
	MODEL_EMPTY_TYPE,
	MODEL_FRAME_TYPE,
	type ModelEdgeData,
	type ModelFrameData,
	type ModelGraphData,
} from "@/canvases/model/types";

const STITCH_DASH: [number, number] = [6, 4];

/** A wash light enough for the types to sit on, a border strong enough to read. */
const frameStyle = (hue: number): NodeStyle => ({
	bgFill: { kind: "solid", color: hue, alpha: 0.1 },
	bgStrokeColor: hue,
	bgStrokeAlpha: 0.6,
	bgStrokeWidth: 1.5,
});

function stitchStyle(d: ModelEdgeData, success: number): EdgeStyle | undefined {
	if (d.kind === "edge") return undefined;
	// Staged reads differently from committed: what is about to land (ST21).
	return d.staged
		? { strokeDashArray: STITCH_DASH, strokeColor: success, strokeWidth: 2 }
		: { strokeDashArray: STITCH_DASH };
}

const hueOf = (hues: readonly number[], slot: number): number =>
	hues[(slot - 1) % hues.length] as number;

/** The data as `<GraphLayer>` draws it — frames carry their hue, stitches their dash. */
export function decorate(data: ModelGraphData, colors: LiveColors): GraphData {
	const nodes = data.nodes.map((n) =>
		n.type === MODEL_FRAME_TYPE || n.type === MODEL_EMPTY_TYPE
			? {
					...n,
					style: frameStyle(hueOf(colors.hues, (n.data as ModelFrameData).hue)),
				}
			: n,
	);
	const edges = data.edges.map((e) => {
		const style = stitchStyle(e.data, colors.success);
		return style ? { ...e, style } : e;
	});
	return { nodes, edges } as unknown as GraphData;
}
