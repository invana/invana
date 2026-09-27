import type { CanvasConfig } from "@invana/canvas";

/** The three templates the Detail switcher picks between (GM4). */
export type Detail = "high" | "medium" | "low";

/** The two layouts the Layout switcher picks between (GM3). */
export type LayoutId = "elk" | "force";

/** `node.type` of a model's frame. A member's `type` is its qualified name. */
export const MODEL_FRAME_TYPE = "model";

/**
 * `node.type` of a model with no types drawn — a sized frame, not a group,
 * because ELK sizes a group from its members and reserves nothing for one
 * with none (ST29).
 */
export const MODEL_EMPTY_TYPE = "model.empty";

/**
 * The placeholder binding in `settings.json` and `templates.json`. It is
 * expanded into one binding per member type the data carries (GM5).
 */
export const MEMBER_BINDING = "model.type";

/** The structure name a template uses for "each type's own schema card" (GM6). */
export const SCHEMA_CARD = "schema:*";

export interface ModelFrameData {
	name: string;
	description: string;
	/** The version drawn. */
	version: string | null;
	/** `1`–`8`, the `--color-data-N` slot (GM7). */
	hue: number;
}

export interface ModelProperty {
	name: string;
	type: string;
	/** A stitch keys on it. */
	identity?: boolean;
	/** The stitches that key on it. */
	stitches?: string[];
}

export interface ModelTypeData {
	label: string;
	/** The model's name. */
	model: string;
	/** `1`–`8`, the slot the type's own name hashes to (ST17). */
	hue: number;
	description: string;
	/** `lucide/<name>`. */
	icon: string;
	propertyCount: number;
	stitchCount: number;
	/** The first property a stitch keys on — the card's `key …` footer. */
	identity?: string;
	/** An anchor names this type — the card's *anchored* chip. */
	anchored?: boolean;
	properties: ModelProperty[];
}

export interface ModelEdgeData {
	/** A model's own edge type, or one of the two stitch kinds (GM9). */
	kind: "edge" | "anchor" | "relationship";
	/** The hover card's title — `Model.Type ≡ Model.Type` for a stitch. */
	title: string;
	/** The model an edge type belongs to. */
	model?: string;
	/** Declared, not committed (ST21). */
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
	/** `Model.Type` — the key the expanded bindings are written under. */
	type: string;
	parentId: string;
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
export type ModelCanvasSelection = { kind: "node" | "edge"; id: string } | null;

export type GraphModelTemplates = Record<Detail, Partial<CanvasConfig>>;
