/**
 * The all models data build — every published model on one canvas.
 *
 * A model is a **group frame** (stitch-models.md ST14): a node carrying
 * `style.group`, with its node types pointing at it through `parentId`. That is
 * `@invana/graph`'s own group concept, not a drawing convention, which is what
 * buys the rest of it — ELK packs members inside the frame (ST20), and a
 * collapsed frame renders as one node with every stitch re-routed onto it, so
 * the constellation and the detail are the same data at two altitudes (ST15).
 *
 * A **stitch is the only edge allowed to cross a frame**. Nothing marks one as
 * such: an edge whose endpoints sit in two different groups is a stitch by
 * construction, and one inside a frame is that model's own edge type.
 *
 * This module is pure — queries live in `useAllModels`, the canvas in
 * `AllModelsCanvas`. It reads versions and links, never `…/global-model`
 * (ST16), so the global-model page stays stated rather than drawn (ST6).
 */

import type { ModelLink } from "@/types/models";
import type { EdgeTypeResponse, NodeTypeResponse } from "@/types/schemas";
import type { GraphData, GraphEdge, GraphNode } from "@invana/graph";

/** One model, with the published version that is drawn. */
export interface ModelFrame {
	modelId: string;
	name: string;
	description: string;
	/** The published version drawn. `null` ⇒ nothing published yet (ST18). */
	versionId: string | null;
	versionLabel: string | null;
	/** `--color-data-N`, as the renderer wants it (ST17). */
	hue: number;
	nodeTypes: NodeTypeResponse[];
	edgeTypes: EdgeTypeResponse[];
}

/** `node.type` tags — the canvas branches its template on these, nothing else. */
export const FRAME_TYPE = "model-frame";
export const MEMBER_TYPE = "node-type";

/** `edge.type` tags. A stitch is not a kind of edge type; it is a crossing. */
export const STITCH_ANCHOR = "stitch-anchor";
export const STITCH_RELATIONSHIP = "stitch-relationship";

/** What each canvas node carries for the layer template to read. */
export interface FrameNodeData {
	kind: "frame" | "member";
	modelId: string;
	modelName: string;
	hue: number;
	/** Member only — the node type's own id, so selection maps back. */
	typeId?: string;
	typeName?: string;
	/** Member only — how many properties the type carries. */
	props?: number;
	/** Frame only — what the tab says under the name. */
	caption?: string;
	/**
	 * Frame only — the model has no drawn types, so the frame is a plain sized
	 * box rather than a group. ELK sizes a group from its members and reserves
	 * nothing for one that has none, which is how empty frames ended up lying on
	 * top of their neighbours (ST29).
	 */
	empty?: boolean;
}

/**
 * What a stitch *says*, in one line — the pair, as the design writes it.
 *
 * `NewsArticles.Company ≡ MarketData.Stock` for an anchor, and
 * `Brokerage.Order -[FOR]-> MarketData.Stock` for a relationship. One helper,
 * because the same line is the list row's title, the remove dialog's subject and
 * the refusal's — three places that must never word it differently.
 */
export const stitchPair = (link: ModelLink, qualified = true): string => {
	const left = qualified
		? `${link.source_model ?? "?"}.${link.source_type}`
		: link.source_type;
	const right = qualified
		? `${link.target_model ?? "?"}.${link.target_type}`
		: link.target_type;
	const middle = link.kind === "anchor" ? "≡" : `-[${link.edge_type ?? "?"}]->`;
	return `${left} ${middle} ${right}`;
};

/**
 * Where its endpoints come from, in one line.
 *
 * A key on each side reads as the rule itself (ST26); rows that are their own
 * fact read as the model that ships them (ST27). An anchor adds how the two
 * compare, because *exact* and *case insensitive* are different claims about
 * the same pair of columns.
 */
export const stitchRule = (link: ModelLink, sourceModel?: string): string => {
	if (link.source_property && link.target_property) {
		const rule = `${link.source_type}.${link.source_property} = ${link.target_type}.${link.target_property}`;
		return link.kind === "anchor" ? `${rule} · ${link.identity_match}` : rule;
	}
	return sourceModel
		? `rows from ${sourceModel}'s records`
		: "rows that ship with its records";
};

/**
 * The label the crossing carries on the canvas — two of them, one per altitude.
 *
 * **Types** (frames open) gets the rule: `Company.ticker ≡ Stock.nse_symbol`,
 * `FOR · Order.instrument_isin = Stock.isin`. It says what a reader would
 * otherwise have to open the stitch to learn, and the point of drawing the
 * crossing is that they do not have to.
 *
 * **Models** (frames closed) gets the mark: `≡`, or the bare edge type. Up there
 * a frame is a tab a few characters wide, and a rule printed across five of them
 * is a rule nobody reads and four names nobody can (ST15, ST32).
 */
const stitchLabels = (link: ModelLink): { label: string; short: string } => {
	const keyed = link.source_property && link.target_property;
	if (link.kind === "anchor") {
		return {
			label: keyed
				? `${link.source_type}.${link.source_property} ≡ ${link.target_type}.${link.target_property}`
				: "≡",
			short: "≡",
		};
	}
	const edge = link.edge_type ?? "relationship";
	return {
		label: keyed
			? `${edge} · ${link.source_type}.${link.source_property} = ${link.target_type}.${link.target_property}`
			: edge,
		short: edge,
	};
};

export interface FrameEdgeData {
	kind: "edge-type" | "stitch";
	/** Stitch only. */
	linkId?: string;
	/** Stitch only — declared but not committed, so the union does not span it yet (ST21). */
	staged?: boolean;
	/** What it says at the types altitude — the rule. */
	label: string;
	/** What it says at the models altitude — the mark. */
	short: string;
}

/**
 * The categorical data palette, as numbers. Same eight hues, same order, as
 * `@invana/styling`'s `--color-data-1…8` — a model keeps its slot so the
 * legend, the frame and every type inside it agree (ST17).
 */
export const MODEL_HUES = [
	0x2a78d6, 0xeb6834, 0x1baf7a, 0xeda100, 0xe87ba4, 0x008300, 0x4a3aa7,
	0xe34948,
] as const;

export const hueForIndex = (i: number): number =>
	MODEL_HUES[i % MODEL_HUES.length] as number;

/**
 * The same slot, as the CSS token the kit's `Legend` wants. The canvas needs a
 * number and the legend needs a token; they must never drift, so both come from
 * the index rather than from each other.
 */
export const hueTokenForIndex = (i: number): string =>
	`var(--color-data-${(i % MODEL_HUES.length) + 1})`;

export const frameIdOf = (modelId: string): string => `model:${modelId}`;
export const memberIdOf = (modelId: string, typeName: string): string =>
	`${modelId}::${typeName}`;

/** Recover the model and type from a member id — the inverse of {@link memberIdOf}. */
export const parseMemberId = (
	nodeId: string,
): { modelId: string; typeName: string } | null => {
	const at = nodeId.indexOf("::");
	if (at < 0) return null;
	return { modelId: nodeId.slice(0, at), typeName: nodeId.slice(at + 2) };
};

/** Recover the model from a frame id — the inverse of {@link frameIdOf}. */
export const modelIdOfFrame = (nodeId: string): string | null =>
	nodeId.startsWith("model:") ? nodeId.slice("model:".length) : null;

export interface AllModelsBuild {
	data: GraphData;
	/** Declared but not committed — drawn, and counted beside the union (ST21). */
	stagedCount: number;
	/** Stitches whose endpoint version is not the one drawn — stated, not dropped silently. */
	unresolvedStitches: number;
	stitchCount: number;
	memberCount: number;
}

/**
 * Build the canvas payload.
 *
 * Ids are namespaced by model because two domains may both own a `Company` and
 * they are different types until an anchor says otherwise (domain-models.md
 * DM4) — collapsing them onto one node here would draw the merge the product
 * refuses to perform (ST2).
 */
export function buildAllModelsData(
	frames: readonly ModelFrame[],
	links: readonly ModelLink[],
): AllModelsBuild {
	const nodes: GraphNode<FrameNodeData>[] = [];
	const edges: GraphEdge<FrameEdgeData>[] = [];

	// versionId → model, and name → model. A link binds a *version*; the canvas
	// draws the *active* one, and those are the same row almost always and not
	// always, so both doors are open before a stitch is given up on.
	const byVersion = new Map<string, ModelFrame>();
	const byName = new Map<string, ModelFrame>();
	for (const t of frames) {
		if (t.versionId) byVersion.set(t.versionId, t);
		byName.set(t.name, t);
	}

	for (const t of frames) {
		// What the tab says under the name. The version matters most: the canvas
		// draws published versions, and which one is not guessable (ST16, ST18).
		const caption = t.versionId
			? (t.versionLabel ?? "published")
			: "nothing published yet";
		nodes.push({
			id: frameIdOf(t.modelId),
			type: FRAME_TYPE,
			data: {
				kind: "frame",
				modelId: t.modelId,
				modelName: t.name,
				hue: t.hue,
				caption,
				empty: t.nodeTypes.length === 0,
			},
		});

		const own = new Set(t.nodeTypes.map((n) => n.name));
		for (const n of t.nodeTypes) {
			nodes.push({
				id: memberIdOf(t.modelId, n.name),
				type: MEMBER_TYPE,
				parentId: frameIdOf(t.modelId),
				data: {
					kind: "member",
					modelId: t.modelId,
					modelName: t.name,
					hue: t.hue,
					typeId: n.id,
					typeName: n.name,
					props: (n.property_mappings ?? []).length,
				},
			});
		}

		// A model's own edge types stay inside its frame. One canvas edge per
		// (source, target) pair, as the model canvas already fans them out.
		for (const e of t.edgeTypes) {
			for (const src of e.source_node_types) {
				for (const tgt of e.target_node_types) {
					if (!own.has(src) || !own.has(tgt)) continue;
					edges.push({
						id: `${t.modelId}::${e.id}:${src}->${tgt}`,
						source: memberIdOf(t.modelId, src),
						target: memberIdOf(t.modelId, tgt),
						type: e.name,
						data: { kind: "edge-type", label: e.name, short: e.name },
					});
				}
			}
		}
	}

	const present = new Set(nodes.map((n) => n.id));
	let unresolved = 0;
	let stitches = 0;
	let staged = 0;

	for (const l of links) {
		const src =
			byVersion.get(l.source_version_id) ??
			(l.source_model ? byName.get(l.source_model) : undefined);
		const tgt =
			byVersion.get(l.target_version_id) ??
			(l.target_model ? byName.get(l.target_model) : undefined);
		if (!src || !tgt) {
			unresolved += 1;
			continue;
		}
		const from = memberIdOf(src.modelId, l.source_type);
		const to = memberIdOf(tgt.modelId, l.target_type);
		// The link names a type the drawn version no longer carries. Saying so is
		// the point of the count — a stitch nobody can see is a stitch nobody
		// reviews when the version it binds is republished.
		if (!present.has(from) || !present.has(to)) {
			unresolved += 1;
			continue;
		}
		stitches += 1;
		const isStaged = l.status === "staged";
		if (isStaged) staged += 1;
		edges.push({
			id: `stitch:${l.id}`,
			source: from,
			target: to,
			type: l.kind === "anchor" ? STITCH_ANCHOR : STITCH_RELATIONSHIP,
			data: {
				kind: "stitch",
				linkId: l.id,
				staged: isStaged,
				...stitchLabels(l),
			},
		});
	}

	return {
		data: { nodes, edges } as GraphData,
		unresolvedStitches: unresolved,
		stitchCount: stitches,
		stagedCount: staged,
		memberCount: nodes.length - frames.length,
	};
}
