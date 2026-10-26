/**
 * The one style the board cannot say: a stitch's dash. A dash cannot be bound
 * to a field, and "no dash" is not a value a resolver can return, so a stitch
 * carries its own dashed style and a model's own edge type keeps the board's
 * solid line. A staged stitch — what is about to land — is drawn in the
 * theme's success colour.
 */

import type { EdgeStyle, GraphData, NodeBadge, NodeStyle } from "@invana/graph";
import { readCssColor } from "@invana/graph";
import { useTheme } from "@invana/themes";
import { useEffect, useState } from "react";
import {
	MODEL_EMPTY_TYPE,
	MODEL_FRAME_TYPE,
	type ModelEdgeData,
	type ModelGraphData,
	type ModelMarkLine,
	type ModelTypeMark,
} from "./types";

const STITCH_DASH: [number, number] = [6, 4];
const SUCCESS_FALLBACK = 0x2bab5a;

const readSuccess = () =>
	readCssColor("var(--color-success)") ?? SUCCESS_FALLBACK;

/** `--color-success`, re-read one frame after a theme class lands. */
export function useSuccessColor(): number {
	const { variantId, isDark } = useTheme();
	const [color, setColor] = useState(readSuccess);
	// biome-ignore lint/correctness/useExhaustiveDependencies: variantId/isDark are trigger-only — the read is of the live DOM token
	useEffect(() => {
		const id = requestAnimationFrame(() => setColor(readSuccess()));
		return () => cancelAnimationFrame(id);
	}, [variantId, isDark]);
	return color;
}

const TONE_FALLBACK = { added: 0x2bab5a, changed: 0xd9a21b, removed: 0xd64545 };
const CHIP_HEIGHT = 16;
const CHIP_GAP = 2;
const CHIP_CHAR = 6.2;
const CHIP_LINES = 5;

/** The tone's colour, read live so a theme change lands on the next decorate. */
function toneColor(mark: ModelTypeMark["mark"]): number {
	const token =
		mark === "added"
			? "success"
			: mark === "removed"
				? "destructive"
				: "warning";
	return readCssColor(`var(--color-${token})`) ?? TONE_FALLBACK[mark];
}

/** One chip per line, stacked beside the type; a long list ends in `+ n more`. */
function chips(mark: ModelTypeMark) {
	const fill = toneColor(mark.mark);
	const labelColor = readCssColor("var(--color-background)") ?? 0xffffff;
	const shown: ModelMarkLine[] = mark.lines.slice(0, CHIP_LINES);
	if (mark.lines.length > CHIP_LINES)
		shown.push({ sign: "+", text: `${mark.lines.length - CHIP_LINES} more` });
	return shown.map((line, i) => {
		const text = `${line.sign === "-" ? "−" : line.sign} ${line.text}`;
		return {
			id: `mark-${i}`,
			placement: "top-right" as const,
			origin: "top-left" as const,
			shape: {
				kind: "rect" as const,
				width: Math.ceil(text.length * CHIP_CHAR) + 12,
				height: CHIP_HEIGHT,
				cornerRadius: 4,
			},
			fill,
			labelText: text,
			labelColor,
			labelFontSize: 10,
			offsetX: 6,
			offsetY: i * (CHIP_HEIGHT + CHIP_GAP),
		};
	});
}

/** A marked type wears its chips; an added one is also drawn dashed. */
function nodeMarkStyle(mark: ModelTypeMark): NodeStyle {
	const base: NodeStyle = { badges: chips(mark) as readonly NodeBadge[] };
	return mark.mark === "added"
		? {
				...base,
				bgStrokeColor: toneColor("added"),
				bgStrokeWidth: 2,
				bgStrokeDashArray: STITCH_DASH,
			}
		: base;
}

function stitchStyle(d: ModelEdgeData, success: number): EdgeStyle | undefined {
	if (d.kind === "edge") return undefined;
	return d.staged
		? { strokeDashArray: STITCH_DASH, strokeColor: success, strokeWidth: 2 }
		: { strokeDashArray: STITCH_DASH };
}

/** The data as the board draws it — stitches dashed, marked types chipped. */
export function decorate(data: ModelGraphData, success: number): GraphData {
	const nodeMarks = new Map<string, ModelTypeMark>();
	const edgeMarks = new Map<string, ModelTypeMark>();
	for (const m of data.marks ?? [])
		(m.target_kind === "node_type" ? nodeMarks : edgeMarks).set(m.type, m);

	const nodes =
		nodeMarks.size === 0
			? data.nodes
			: data.nodes.map((n) => {
					if (n.type === MODEL_FRAME_TYPE || n.type === MODEL_EMPTY_TYPE)
						return n;
					const mark = nodeMarks.get(
						(n.data as { label?: string }).label ?? "",
					);
					return mark ? { ...n, style: nodeMarkStyle(mark) } : n;
				});
	const edges = data.edges.map((e) => {
		const mark = e.data.kind === "edge" ? edgeMarks.get(e.type) : undefined;
		const style = mark
			? ({
					badges: chips(mark).map((c) => ({ ...c, placement: "middle" })),
				} as unknown as EdgeStyle)
			: stitchStyle(e.data, success);
		return style ? { ...e, style } : e;
	});
	return { nodes, edges } as unknown as GraphData;
}
