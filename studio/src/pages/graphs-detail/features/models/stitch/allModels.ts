/**
 * The all models data build — every published model on one canvas.
 *
 * A model is a **group frame** (stitch-models.md ST14): a `model` node that
 * `GraphModelCanvas` styles as a group, with its node types pointing at it
 * through `parentId`. That is
 * `@invana/graph`'s own group concept, not a drawing convention, which is what
 * buys the rest of it — ELK packs members inside the frame (ST20), and a
 * collapsed frame renders as one node with every stitch re-routed onto it, so
 * the constellation and the detail are the same data at two altitudes (ST15).
 *
 * A **stitch is the only edge allowed to cross a frame**. Nothing marks one as
 * such: an edge whose endpoints sit in two different groups is a stitch by
 * construction, and one inside a frame is that model's own edge type.
 *
 * This module is pure — queries live in `useAllModels`, the drawing in
 * `@/canvases/model`, the page in `AllModelsCanvas`. It reads versions and links, never `…/global-model`
 * (ST16), so the global-model page stays stated rather than drawn (ST6).
 */

import {
	MODEL_EMPTY_TYPE,
	MODEL_FRAME_TYPE,
	type ModelEdgeData,
	type ModelFrameNode,
	type ModelGraphData,
	type ModelGraphEdge,
	type ModelProperty,
	type ModelTypeNode,
} from "@/canvases/model";
import type { ModelLink } from "@/pages/graphs-detail/features/models/types";
import type {
	EdgeTypeResponse,
	NodeTypeResponse,
} from "@/pages/graphs-detail/features/models/types";
import { colorSlotByString } from "@invana/styling/color";

/** One model, with the published version that is drawn. */
export interface ModelFrame {
	modelId: string;
	name: string;
	description: string;
	/** The published version drawn. `null` ⇒ nothing published yet (ST18). */
	versionId: string | null;
	versionLabel: string | null;
	/** `1`–`8`, the `--color-data-N` slot (ST17). */
	hue: number;
	nodeTypes: NodeTypeResponse[];
	edgeTypes: EdgeTypeResponse[];
}

/** A type with no icon of its own — the API carries none yet. */
const TYPE_ICON = "lucide/box";

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

export interface AllModelsBuild {
	data: ModelGraphData;
	/** Declared but not committed — drawn, and counted beside the union (ST21). */
	stagedCount: number;
	/** Stitches whose endpoint version is not the one drawn — stated, not dropped silently. */
	unresolvedStitches: number;
	stitchCount: number;
	memberCount: number;
}

/** What the stitches say about one type — its keys, its count, whether it is anchored. */
interface TypeStitches {
	keys: Map<string, string[]>;
	count: number;
	anchored: boolean;
}

/**
 * Build the canvas payload — `GraphModelCanvas`'s `ModelGraphData`.
 *
 * Ids are namespaced by model because two domains may both own a `Company` and
 * they are different types until an anchor says otherwise (domain-models.md
 * DM4) — collapsing them onto one node here would draw the merge the product
 * refuses to perform (ST2). A member's `type` is `Model.Type`, the key the
 * canvas binds its look under.
 */
export function buildAllModelsData(
	frames: readonly ModelFrame[],
	links: readonly ModelLink[],
	/**
	 * `false` draws the types with no frame around them — the model canvas,
	 * where the page is already the model and a group would say it twice (ME26).
	 */
	{ framed = true }: { framed?: boolean } = {},
): AllModelsBuild {
	const nodes: (ModelFrameNode | ModelTypeNode)[] = [];
	const edges: ModelGraphEdge[] = [];

	// versionId → model, and name → model. A link binds a *version*; the canvas
	// draws the *active* one, and those are the same row almost always and not
	// always, so both doors are open before a stitch is given up on.
	const byVersion = new Map<string, ModelFrame>();
	const byName = new Map<string, ModelFrame>();
	for (const t of frames) {
		if (t.versionId) byVersion.set(t.versionId, t);
		byName.set(t.name, t);
	}
	const present = new Set<string>();
	for (const t of frames)
		for (const n of t.nodeTypes) present.add(memberIdOf(t.modelId, n.name));

	// Resolve every link first: a type's card states the keys stitches use on
	// it, so the members cannot be built until the stitches are known.
	const resolved: {
		link: ModelLink;
		from: string;
		to: string;
		src: ModelFrame;
		tgt: ModelFrame;
	}[] = [];
	let unresolved = 0;
	for (const l of links) {
		const src =
			byVersion.get(l.source_version_id) ??
			(l.source_model ? byName.get(l.source_model) : undefined);
		const tgt =
			byVersion.get(l.target_version_id) ??
			(l.target_model ? byName.get(l.target_model) : undefined);
		const from = src ? memberIdOf(src.modelId, l.source_type) : "";
		const to = tgt ? memberIdOf(tgt.modelId, l.target_type) : "";
		// The link names a type the drawn version no longer carries. Saying so is
		// the point of the count — a stitch nobody can see is a stitch nobody
		// reviews when the version it binds is republished.
		if (!src || !tgt || !present.has(from) || !present.has(to)) {
			unresolved += 1;
			continue;
		}
		resolved.push({ link: l, from, to, src, tgt });
	}

	const stitchesOf = new Map<string, TypeStitches>();
	const note = (
		id: string,
		prop: string | null,
		pair: string,
		anchor: boolean,
	) => {
		const s = stitchesOf.get(id) ?? {
			keys: new Map(),
			count: 0,
			anchored: false,
		};
		s.count += 1;
		s.anchored ||= anchor;
		if (prop) s.keys.set(prop, [...(s.keys.get(prop) ?? []), pair]);
		stitchesOf.set(id, s);
	};
	for (const { link, from, to } of resolved) {
		const pair = stitchPair(link);
		const anchor = link.kind === "anchor";
		note(from, link.source_property, pair, anchor);
		note(to, link.target_property, pair, anchor);
	}

	for (const t of frames) {
		// A model with nothing drawn is a sized frame, not a group (ST29).
		if (framed)
			nodes.push({
				id: frameIdOf(t.modelId),
				type: t.nodeTypes.length === 0 ? MODEL_EMPTY_TYPE : MODEL_FRAME_TYPE,
				data: {
					name: t.name,
					description: t.description,
					version: t.versionLabel,
					hue: t.hue,
				},
			});

		const own = new Set(t.nodeTypes.map((n) => n.name));
		for (const n of t.nodeTypes) {
			const id = memberIdOf(t.modelId, n.name);
			const stitched = stitchesOf.get(id);
			const properties: ModelProperty[] = [...(n.property_mappings ?? [])]
				.sort((a, b) => a.sort_order - b.sort_order)
				.map((m) => {
					const pairs = stitched?.keys.get(m.property_key.name);
					return {
						name: m.property_key.name,
						type: m.property_key.type,
						...(pairs ? { identity: true, stitches: pairs } : {}),
					};
				});
			nodes.push({
				id,
				type: `${t.name}.${n.name}`,
				...(framed ? { parentId: frameIdOf(t.modelId) } : {}),
				data: {
					label: n.name,
					model: t.name,
					...(framed ? { frame: t.name } : {}),
					// The type's own colour, the one the Explorer paints it (ST17);
					// the frame around it carries the model's.
					hue: colorSlotByString(n.name),
					description: n.description ?? "",
					icon: TYPE_ICON,
					propertyCount: properties.length,
					stitchCount: stitched?.count ?? 0,
					identity: properties.find((p) => p.identity)?.name,
					anchored: stitched?.anchored ?? false,
					properties,
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
						data: {
							kind: "edge",
							// One model's page already names it, so nothing repeats it (ME26).
							title: framed
								? `${t.name}.${src} -[${e.name}]-> ${t.name}.${tgt}`
								: `${src} -[${e.name}]-> ${tgt}`,
							...(framed ? { model: t.name } : {}),
							description: e.description,
						},
					});
				}
			}
		}
	}

	let staged = 0;
	for (const { link: l, from, to, src } of resolved) {
		const isStaged = l.status === "staged";
		if (isStaged) staged += 1;
		const sourceModel = l.source_model_id
			? frames.find((f) => f.modelId === l.source_model_id)?.name
			: undefined;
		const data: ModelEdgeData = {
			kind: l.kind === "anchor" ? "anchor" : "relationship",
			title: stitchPair(l),
			staged: isStaged,
			description: l.description,
			rule: stitchRule(l, sourceModel ?? src.name),
			// How the two keys compare — an anchor's, and a keyed relationship's.
			...(l.source_property && l.target_property
				? { match: l.identity_match }
				: {}),
		};
		edges.push({
			id: `stitch:${l.id}`,
			source: from,
			target: to,
			type: l.kind === "anchor" ? "SAME_AS" : (l.edge_type ?? "relationship"),
			data,
		});
	}

	return {
		data: { nodes, edges },
		unresolvedStitches: unresolved,
		stitchCount: resolved.length,
		stagedCount: staged,
		memberCount: nodes.length - frames.length,
	};
}
