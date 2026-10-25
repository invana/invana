/**
 * The layered canvas drawn as **cards** — a board config over canvas-ui's
 * `DAG_BOARD_CONFIG`, with one freeform card for every node.
 *
 * A card reads three lines and a status dot:
 *
 * | Row | Bound to | Reads |
 * |---|---|---|
 * | title | `data.title` | the node's name — a function, an agent |
 * | dot | `data.tone` | its status, in the board's own tone colours |
 * | sub | `data.sub` | what it did — `1.9 s · 2.8k tokens`, `no progress · loop` |
 * | line | `data.line` | one more fact when there is one — `1 → 191 rows`, `14k / 30k tokens` |
 *
 * Every colour is a theme role, except the dot, which reads the board's tones
 * so a card and the default dot agree about what a status looks like. An edge's
 * label and dash are its own `style`, so the layout reserves the gap between
 * cards for it and no label is drawn over a card.
 */

import type { CanvasConfig } from "@invana/canvas";
import { DAG_BOARD_CONFIG, DAG_TONES } from "@invana/canvas-ui";

/** The node type every card is drawn as. */
export const CARD_TYPE = "layered.card";

const CARD = { width: 220, height: 72 };

/** Which way the cards read: left to right (a chain), or top down (a tree). */
export type CardDirection = "RIGHT" | "DOWN";

const tone = {
	bind: "data.tone",
	map: { ...DAG_TONES },
	fallback: DAG_TONES.muted,
};

const card = {
	name: "layeredCard",
	kind: "freeform",
	...CARD,
	cornerRadius: 6,
	bgRole: "cardBg",
	strokeRole: "stroke",
	strokeWidth: 1,
	elements: [
		{
			id: "title",
			type: "text",
			x: 12,
			y: -2,
			bind: "data.title",
			fontSize: 13,
			fontWeight: 600,
			colorRole: "heading",
			maxWidth: CARD.width - 44,
		},
		{
			id: "dot",
			type: "rect",
			x: CARD.width - 20,
			y: 12,
			width: 8,
			height: 8,
			cornerRadius: 4,
			fillLookup: tone,
		},
		{
			id: "sub",
			type: "text",
			x: 12,
			y: 18,
			bind: "data.sub",
			requires: "data.sub",
			fontSize: 11,
			colorRole: "muted",
			maxWidth: CARD.width - 24,
		},
		{
			id: "line",
			type: "text",
			x: 12,
			y: 37,
			bind: "data.line",
			requires: "data.line",
			fontSize: 11,
			colorRole: "foreground",
			maxWidth: CARD.width - 24,
		},
	],
};

/** The board config for cards read in `direction`. */
export function cardsConfig(direction: CardDirection): CanvasConfig {
	const base = DAG_BOARD_CONFIG as unknown as {
		layers: Record<string, unknown>;
		layouts: Record<string, Record<string, unknown>>;
	} & Record<string, unknown>;
	return {
		...base,
		layers: {
			...base.layers,
			graph: {
				nodeStructureTemplates: { [card.name]: card },
				nodeStylingTemplates: { label: { name: "label" } },
				nodeTypes: {
					[CARD_TYPE]: { structure: card.name, styling: "label", bindings: {} },
				},
				edge: {
					style: {
						strokeWidth: 1.5,
						strokeAlpha: 0.85,
						arrowTargetShape: "triangle",
						arrowTargetSize: 6,
						labelFontSize: 10,
						labelOffsetY: -9,
					},
				},
			},
		},
		layouts: {
			...base.layouts,
			elk: {
				...base.layouts.elk,
				direction,
				defaultNodeSize: CARD,
				// Across the flow: cards side by side. Along it: room for an
				// edge's label between two cards.
				nodeSpacing: direction === "DOWN" ? 32 : 40,
				layerSpacing: direction === "DOWN" ? 56 : 72,
				// A chain read left to right stays one row in its order; a long one
				// pans rather than snaking back across the canvas.
			},
		},
	} as unknown as CanvasConfig;
}
