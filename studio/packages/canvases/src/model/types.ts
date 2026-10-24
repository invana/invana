import {
	SCHEMA_FRAME_EMPTY_TYPE,
	SCHEMA_FRAME_TYPE,
	type SchemaBoardSelection,
} from "@invana/canvas-ui";
import type { SchemaCardProperty, SchemaTypeData } from "@invana/graph";
import { colorSlotByString } from "@invana/styling/color";

/** The three Detail levels the board switches between. */
export type Detail = "high" | "medium" | "low";

/** `node.type` of a model's frame. A member's `type` is its qualified name. */
export const MODEL_FRAME_TYPE = SCHEMA_FRAME_TYPE;

/**
 * `node.type` of a model with no types drawn — a sized frame, not a group,
 * because ELK sizes a group from its members and reserves nothing for one
 * with none.
 */
export const MODEL_EMPTY_TYPE = SCHEMA_FRAME_EMPTY_TYPE;

/**
 * A model's slot in the palette, `1`–`8`, by its name — so a model keeps its
 * hue when another is added, deleted or the list is re-sorted.
 */
export const hueSlotForName = (name: string): number => colorSlotByString(name);

interface ModelFrameData {
	name: string;
	description: string;
	/** The version drawn. */
	version: string | null;
	/** `1`–`8`, the theme's categorical slot. */
	hue: number;
}

/** A property; `tags` are the stitches that key on it. */
export type ModelProperty = SchemaCardProperty;

interface ModelTypeData extends SchemaTypeData {
	/** The model's name. */
	model: string;
	/** `1`–`8`, the slot the type's own name hashes to. */
	hue: number;
	description: string;
	/** `lucide/<name>`. */
	icon: string;
	propertyCount: number;
	stitchCount: number;
	/** The first property a stitch keys on — the card's `key …` footer. */
	identity?: string;
	/** `anchored` when an anchor names this type — the card's chip. */
	badge?: string;
}

export interface ModelEdgeData {
	/** A model's own edge type, or one of the two stitch kinds. */
	kind: "edge" | "anchor" | "relationship";
	/** The hover card's title — `Model.Type ≡ Model.Type` for a stitch. */
	title: string;
	/** The model an edge type belongs to. Absent on the unframed one-model canvas. */
	model?: string;
	/** Declared, not committed. */
	staged?: boolean;
	description?: string;
	/** Stitch only — the rule, for the hover card. */
	rule?: string;
	/** Stitch only — how the two keys compare (`exact`, `case_insensitive`). */
	match?: string;
}

export interface ModelFrameNode {
	id: string;
	type: typeof MODEL_FRAME_TYPE | typeof MODEL_EMPTY_TYPE;
	data: ModelFrameData;
}

export interface ModelTypeNode {
	id: string;
	/** `Model.Type` — one binding per type, expanded by the board. */
	type: string;
	/** The model's frame. Absent on the model canvas, which draws one model unframed. */
	parentId?: string;
	data: ModelTypeData;
}

export interface ModelGraphEdge {
	id: string;
	source: string;
	target: string;
	type: string;
	data: ModelEdgeData;
}

export interface ModelGraphData {
	nodes: (ModelFrameNode | ModelTypeNode)[];
	edges: ModelGraphEdge[];
}

/** What a click selected — a node or an edge, by its canvas id. */
export type ModelCanvasSelection = SchemaBoardSelection;
