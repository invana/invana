/**
 * The one style the board cannot say: a stitch's dash. A dash cannot be bound
 * to a field, and "no dash" is not a value a resolver can return, so a stitch
 * carries its own dashed style and a model's own edge type keeps the board's
 * solid line. A staged stitch — what is about to land — is drawn in the
 * theme's success colour.
 */

import type { EdgeStyle, GraphData } from "@invana/graph";
import { readCssColor } from "@invana/graph";
import { useTheme } from "@invana/themes";
import { useEffect, useState } from "react";
import type { ModelEdgeData, ModelGraphData } from "./types";

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

function stitchStyle(d: ModelEdgeData, success: number): EdgeStyle | undefined {
	if (d.kind === "edge") return undefined;
	return d.staged
		? { strokeDashArray: STITCH_DASH, strokeColor: success, strokeWidth: 2 }
		: { strokeDashArray: STITCH_DASH };
}

/** The data as the board draws it — stitches dashed. */
export function decorate(data: ModelGraphData, success: number): GraphData {
	const edges = data.edges.map((e) => {
		const style = stitchStyle(e.data, success);
		return style ? { ...e, style } : e;
	});
	return { nodes: data.nodes, edges } as unknown as GraphData;
}
