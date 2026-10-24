/**
 * The skill's Flow as `TaskFlowCanvas` draws it: the task-flow settings laid
 * out **top-down**, with one card for every node — a step, a handler or a gap.
 *
 * Text sits about one line-height lower than a rect at the same `y`, so the
 * text rows are placed above the shapes they line up with.
 *
 * A card reads its function (or the handler's line), a caption (`step 2 ·
 * from line 13`, `handler · from line 17`, `line 15 · "…"`) and, on a step,
 * its bound beside a swatch in the bound's colour. A handler's and a gap's
 * outline is the warning colour the task-flow settings already ring a wide
 * step with; every colour here is read from those settings, so the card and
 * the Circles level can never disagree about what a bound looks like.
 *
 * Circles stays one Detail level away, laid out top-down as well.
 */

import {
	type TaskFlowCanvas,
	taskFlowSettings,
	taskFlowTemplates,
} from "@invana-studio/canvases";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof TaskFlowCanvas>;
type Lookup = { bind: string; map: Record<string, number> };

/** The pieces of the task-flow settings this config reads and patches. */
interface TaskFlowShape {
	layers: {
		graph: {
			nodeStructureTemplates: Record<string, unknown> & {
				taskDot: { strokeLookup: Lookup };
			};
			nodeTypes: Record<string, unknown>;
			node: { state: { wide: { decorations: { color: number }[] } } };
		};
	} & Record<string, unknown>;
	layouts: { elk: Record<string, unknown> & { layoutOptions?: object } };
}

const base = taskFlowSettings as unknown as TaskFlowShape;
const graph = base.layers.graph;
const toneLookup = graph.nodeStructureTemplates.taskDot.strokeLookup;
const warning = graph.node.state.wide.decorations[0]?.color;

const CARD = { width: 248, height: 68 };
const STRUCTURE = "skillFlowCard";

const flowCard = {
	name: STRUCTURE,
	kind: "freeform",
	...CARD,
	cornerRadius: 6,
	bgRole: "cardBg",
	strokeRole: "stroke",
	strokeWidth: 1,
	...(warning !== undefined
		? {
				strokeLookup: {
					bind: "data.kind",
					map: { handler: warning, gap: warning },
					fallback: "stroke",
				},
			}
		: {}),
	elements: [
		{
			id: "tile",
			type: "rect",
			x: 12,
			y: 12,
			width: 26,
			height: 26,
			cornerRadius: 6,
			fillLookup: toneLookup,
			fillAlpha: 0.16,
		},
		{
			id: "icon",
			type: "icon",
			x: 17,
			y: 17,
			size: 16,
			bind: "data.icon",
			colorLookup: toneLookup,
			strokeWidth: 2,
		},
		{
			id: "title",
			type: "text",
			x: 48,
			y: -3,
			bind: "data.title",
			fontSize: 13,
			fontWeight: 600,
			colorRole: "heading",
			maxWidth: 188,
		},
		{
			id: "caption",
			type: "text",
			x: 48,
			y: 15,
			bind: "data.caption",
			fontSize: 11,
			colorRole: "muted",
			maxWidth: 188,
		},
		{
			id: "swatch",
			type: "rect",
			x: 48,
			y: 47,
			width: 7,
			height: 7,
			cornerRadius: 1,
			fillLookup: toneLookup,
			requires: "data.swatch",
		},
		{
			id: "bound",
			type: "text",
			x: 60,
			y: 35,
			bind: "data.bound",
			fontSize: 11,
			colorLookup: toneLookup,
			maxWidth: 176,
			requires: "data.swatch",
		},
	],
};

const cardTypes = Object.fromEntries(
	Object.keys(graph.nodeTypes).map((type) => [
		type,
		{ structure: STRUCTURE, styling: "label", bindings: {} },
	]),
);

const cardLayout = {
	defaultNodeSize: CARD,
	nodeSpacing: 60,
	layerSpacing: 44,
};

/**
 * The steps as one straight column, every side card in a column to their
 * right. A side card is one layer below the step it hangs off, since ELK lays
 * an edge's target a layer after its source; a card off the last step sits
 * under it.
 *
 * - **Model order** keeps the steps first in every layer — they come first in
 *   the data — so a side card never lands left of the column.
 * - **Network-simplex placement** straightens the chain. The task flow's
 *   `BALANCED` alignment averages four placements, which zigzags the steps as
 *   soon as one layer holds a side card.
 */
const columnOptions = {
	"elk.spacing.edgeNode": "40",
	"elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
	"elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
	"elk.layered.crossingMinimization.forceNodeModelOrder": "true",
};

export const skillFlowSettings = {
	...base,
	layers: {
		...base.layers,
		graph: {
			...graph,
			nodeStructureTemplates: {
				...graph.nodeStructureTemplates,
				[STRUCTURE]: flowCard,
			},
			nodeTypes: cardTypes,
		},
	},
	layouts: {
		...base.layouts,
		elk: {
			...base.layouts.elk,
			...cardLayout,
			direction: "DOWN",
			layoutOptions: { ...base.layouts.elk.layoutOptions, ...columnOptions },
		},
	},
} as unknown as Props["settings"];

export const skillFlowTemplates: Props["templates"] = {
	circles: taskFlowTemplates.circles,
	cards: {
		layers: { graph: { nodeTypes: cardTypes } },
		layouts: { elk: cardLayout },
	} as unknown as Props["templates"]["cards"],
};
