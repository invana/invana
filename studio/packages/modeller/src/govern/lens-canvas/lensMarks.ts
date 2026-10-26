/**
 * The lens view laid over the global model's drawing.
 *
 * The canvas data is the global model's (`buildAllModelsData`); this pure step
 * puts the engine's compile of a world — or of the guardrails alone — on it:
 *
 * | The view says | The type wears |
 * |---|---|
 * | `hidden` | a `− hidden` chip, in the destructive tone |
 * | `sliced` | a `~ sliced` chip |
 * | a guarded property | a `~ <property> · <what it may do>` chip (none for `*.*`, which the strip names), and the property's hover tag names the guardrail |
 * | an excluded property | the property's hover tag says the world leaves it out |
 *
 * Nothing here re-reads a rule: *hidden*, *sliced* and *guarded* are the
 * engine's, so the canvas and the inspector cannot disagree.
 */

import type {
	ModelGraphData,
	ModelProperty,
	ModelTypeNode,
} from "@invana-studio/canvases";
import { MODEL_EMPTY_TYPE, MODEL_FRAME_TYPE } from "@invana-studio/canvases";
import { guardWord } from "../guardrails/ruleText";
import type { LensView, LensViewType } from "../types";

type Mark = NonNullable<ModelGraphData["marks"]>[number];
type MarkLine = Mark["lines"][number];

const keyOf = (model: string, type: string) => `${model}\u0000${type}`;

/** The chip lines one type wears under the lens. */
function linesOf(t: LensViewType): MarkLine[] {
	const lines: MarkLine[] = [];
	if (t.hidden) lines.push({ sign: "-", text: "hidden" });
	else if (t.sliced) lines.push({ sign: "~", text: "sliced" });
	// A `*.*` rule holds every type alike; the strip names it once rather than
	// every type wearing the same chip.
	for (const g of t.guarded)
		if (g.property !== "*")
			lines.push({ sign: "~", text: `${g.property} · ${guardWord(g)}` });
	return lines;
}

/** The property's hover tags, with the lens's say added. */
function tagged(p: ModelProperty, t: LensViewType): ModelProperty {
	const tags = [...(p.tags ?? [])];
	for (const g of t.guarded)
		if (g.property === p.name) tags.push(`guarded · ${g.guardrail}`);
	if (t.excluded.includes(p.name)) tags.push("left out by this world");
	return tags.length === (p.tags ?? []).length ? p : { ...p, tags };
}

/** `data` with the lens view's marks and tags; `data` itself when there is no view. */
export function applyLens(
	data: ModelGraphData,
	view: LensView | undefined,
): ModelGraphData {
	if (!view) return data;
	const byType = new Map<string, LensViewType>();
	for (const t of view.types) byType.set(keyOf(t.model, t.type), t);

	const marks: Mark[] = [];
	const nodes = data.nodes.map((n) => {
		if (n.type === MODEL_FRAME_TYPE || n.type === MODEL_EMPTY_TYPE) return n;
		const node = n as ModelTypeNode;
		const t = byType.get(keyOf(node.data.model, node.data.label));
		if (!t) return n;
		const lines = linesOf(t);
		if (lines.length)
			marks.push({
				type: node.data.label,
				target_kind: "node_type",
				mark: t.hidden ? "removed" : "changed",
				lines,
			});
		return {
			...node,
			data: {
				...node.data,
				properties: node.data.properties.map((p) => tagged(p, t)),
			},
		};
	});
	return { ...data, nodes, marks };
}
