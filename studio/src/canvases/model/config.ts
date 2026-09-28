/**
 * From the generic JSON to the config one graph needs (GM5–GM7).
 *
 * `settings.json` and `templates.json` name no model and no type — Studio's are
 * the user's own. Three things are filled in against the data and the live
 * theme: one node-type binding per member type (from the `model.type`
 * placeholder), one schema card per type when the template asks for
 * `schema:*`, and the eight model hues read off `--color-data-N`.
 */

import type { CanvasConfig } from "@invana/canvas";
import { cssColorToNumber } from "@invana/graph";
import { colorSlotByString } from "@invana/styling/color";
import {
	type Detail,
	type GraphModelTemplates,
	MEMBER_BINDING,
	MODEL_EMPTY_TYPE,
	MODEL_FRAME_TYPE,
	type ModelGraphData,
	type ModelTypeData,
	type ModelTypeNode,
	SCHEMA_CARD,
} from "@/canvases/model/types";

/** `@invana/styling`'s `--color-data-1…8`, used only when a token cannot be read. */
const FALLBACK_HUES = [
	0x2a78d6, 0xeb6834, 0x1baf7a, 0xeda100, 0xe87ba4, 0x008300, 0x4a3aa7,
	0xe34948,
] as const;

/**
 * A model's slot in the palette, `1`–`8`, by its name — so a model keeps its
 * hue when another is added, deleted or the list is re-sorted (GM7).
 */
export const hueSlotForName = (name: string): number => colorSlotByString(name);

function readToken(name: string): number | undefined {
	if (typeof document === "undefined") return undefined;
	const probe = document.createElement("span");
	probe.style.color = `var(${name})`;
	probe.style.display = "none";
	document.documentElement.appendChild(probe);
	const rgb = getComputedStyle(probe).color;
	probe.remove();
	return cssColorToNumber(rgb) ?? undefined;
}

/** What the live theme resolves for the colours the canvas paints per node. */
export interface LiveColors {
	hues: number[];
	/** A staged stitch — what is about to land (ST21). */
	success: number;
}

export function readLiveColors(): LiveColors {
	return {
		hues: FALLBACK_HUES.map((h, i) => readToken(`--color-data-${i + 1}`) ?? h),
		success: readToken("--color-success") ?? 0x2bab5a,
	};
}

type Json = unknown;

/** Every `{ bind: "data.hue", map }` lookup, re-pointed at the live hues. */
function withHues(value: Json, hues: readonly number[]): Json {
	if (Array.isArray(value)) return value.map((v) => withHues(v, hues));
	if (value && typeof value === "object") {
		const o = value as Record<string, Json>;
		if (o.bind === "data.hue" && o.map) {
			return {
				...o,
				map: Object.fromEntries(hues.map((h, i) => [String(i + 1), h])),
			};
		}
		return Object.fromEntries(
			Object.entries(o).map(([k, v]) => [k, withHues(v, hues)]),
		);
	}
	return value;
}

function deepMerge(base: Json, patch: Json): Json {
	if (
		!base ||
		!patch ||
		typeof base !== "object" ||
		typeof patch !== "object" ||
		Array.isArray(base) ||
		Array.isArray(patch)
	)
		return patch === undefined ? base : patch;
	const out: Record<string, Json> = { ...(base as Record<string, Json>) };
	for (const [k, v] of Object.entries(patch as Record<string, Json>))
		out[k] = deepMerge(out[k], v);
	return out;
}

/** The chip a schema card's row wears for a property type — the story's set. */
const TYPE_CHIPS: Record<string, { text: string; fill: number }> = {
	string: { text: "Abc", fill: 0x3b82f6 },
	uuid: { text: "Abc", fill: 0x3b82f6 },
	integer: { text: "123", fill: 0x22c55e },
	float: { text: "#", fill: 0x22c55e },
	boolean: { text: "01", fill: 0xa855f7 },
	enum: { text: "≔", fill: 0xec4899 },
	date: { text: "◷", fill: 0xf59e0b },
	datetime: { text: "◷", fill: 0xf59e0b },
};
const OTHER_CHIP = { text: "{}", fill: 0x64748b };

const CARD_WIDTH = 300;
const ROWS_TOP = 90;
const ROW_HEIGHT = 22;

/**
 * One type's schema card: a header, then one row per property — type chip,
 * name, `key` when a stitch keys on it, type. The story writes these out per
 * type; here the rows come from the type's own properties (GM6).
 */
function schemaCard(name: string, d: ModelTypeData) {
	const hueLookup = { bind: "data.hue", map: {} };
	const rows = d.properties.flatMap((p, i) => {
		const y = ROWS_TOP + i * ROW_HEIGHT;
		const chip = TYPE_CHIPS[p.type] ?? OTHER_CHIP;
		return [
			{
				id: `row${i}-chip`,
				type: "rect",
				x: 14,
				y: y + 9,
				width: 22,
				height: 16,
				cornerRadius: 3,
				fill: chip.fill,
			},
			{
				id: `row${i}-chip-text`,
				type: "text",
				x: 25,
				y: y + 5,
				text: chip.text,
				anchor: "center",
				fontSize: 8,
				fontWeight: 700,
				color: 0xffffff,
			},
			{
				id: `row${i}-name`,
				type: "text",
				x: 44,
				y: y - 1,
				text: p.name,
				fontSize: 12,
				fontWeight: p.identity ? 700 : 400,
				colorRole: p.identity ? "heading" : "foreground",
				maxWidth: 150,
			},
			...(p.identity
				? [
						{
							id: `row${i}-tags`,
							type: "text",
							x: 196,
							y: y + 4,
							text: "key",
							fontSize: 9,
							fontWeight: 700,
							colorRole: "accent",
							maxWidth: 50,
						},
					]
				: []),
			{
				id: `row${i}-type`,
				type: "text",
				x: 286,
				y: y + 2,
				text: p.type,
				anchor: "right",
				fontSize: 10,
				colorRole: "muted",
				maxWidth: 56,
			},
		];
	});
	return {
		name,
		kind: "freeform",
		width: CARD_WIDTH,
		height: ROWS_TOP + 16 + d.properties.length * ROW_HEIGHT,
		cornerRadius: 10,
		bgRole: "cardBg",
		strokeLookup: hueLookup,
		strokeWidth: 1.5,
		elements: [
			{
				id: "header",
				type: "rect",
				x: 4,
				y: 4,
				width: CARD_WIDTH - 8,
				height: 42,
				cornerRadius: 7,
				fillLookup: hueLookup,
				fillAlpha: 0.18,
			},
			{
				id: "icon",
				type: "icon",
				x: 14,
				y: 12,
				size: 24,
				bind: "data.icon",
				colorLookup: hueLookup,
				strokeWidth: 2,
			},
			{
				id: "name",
				type: "text",
				x: 48,
				y: -5,
				bind: "data.label",
				fontSize: 14,
				fontWeight: 700,
				colorRole: "heading",
				maxWidth: 238,
			},
			{
				id: "model",
				type: "text",
				x: 48,
				y: 17,
				text: d.frame
					? "{data.frame} · {data.stitchCount} stitches"
					: "{data.stitchCount} stitches",
				fontSize: 10,
				fontWeight: 600,
				uppercase: true,
				colorRole: "muted",
				maxWidth: 238,
			},
			{
				id: "description",
				type: "text",
				x: 14,
				y: 45,
				bind: "data.description",
				fontSize: 11,
				colorRole: "foreground",
				maxWidth: 272,
				maxLines: 2,
				lineHeight: 14,
			},
			{
				id: "divider",
				type: "line",
				x: 0,
				y: ROWS_TOP,
				x2: CARD_WIDTH,
				y2: ROWS_TOP,
				colorRole: "divider",
			},
			...rows,
		],
	};
}

const members = (data: ModelGraphData): ModelTypeNode[] =>
	data.nodes.filter(
		(n): n is ModelTypeNode =>
			n.type !== MODEL_FRAME_TYPE && n.type !== MODEL_EMPTY_TYPE,
	);

interface GraphLayerJson {
	nodeStructureTemplates?: Record<string, Json>;
	nodeTypes?: Record<string, { structure: string } & Record<string, Json>>;
}

const graphOf = (c: Partial<CanvasConfig>): GraphLayerJson =>
	((c.layers as Record<string, Json> | undefined)?.graph ??
		{}) as GraphLayerJson;

/**
 * The patch one Detail level applies to one graph: the level's frame padding
 * and layout spacing as the story ships them, every member type bound to the
 * level's structure, the structures re-hued, and a schema card per type when
 * the level asks for them.
 */
export function detailPatch(
	settings: CanvasConfig,
	templates: GraphModelTemplates,
	detail: Detail,
	data: ModelGraphData,
	hues: readonly number[],
): Partial<CanvasConfig> {
	const template = templates[detail];
	const binding =
		graphOf(template).nodeTypes?.[MEMBER_BINDING] ??
		graphOf(settings).nodeTypes?.[MEMBER_BINDING];
	const structures: Record<string, Json> = {
		...(withHues(
			graphOf(settings).nodeStructureTemplates ?? {},
			hues,
		) as Record<string, Json>),
	};
	const nodeTypes: Record<string, Json> = {};
	for (const n of members(data)) {
		if (!binding) break;
		const perType = binding.structure === SCHEMA_CARD;
		const structure = perType ? `schema:${n.type}` : binding.structure;
		if (perType && !structures[structure])
			structures[structure] = withHues(schemaCard(structure, n.data), hues);
		nodeTypes[n.type] = { ...binding, structure };
	}
	return deepMerge(template, {
		layers: { graph: { nodeStructureTemplates: structures, nodeTypes } },
	}) as Partial<CanvasConfig>;
}

/** `settings` with {@link detailPatch} merged in — what the canvas mounts on. */
export function initialConfig(
	settings: CanvasConfig,
	patch: Partial<CanvasConfig>,
): CanvasConfig {
	return deepMerge(settings, patch) as CanvasConfig;
}
