/**
 * The Journeys view — every journey's diagram as one graph, pure functions over the parse.
 *
 * The parser reads each journey's *The journey* flowchart into `NEXT` edges between `Story` and `Step` nodes; a story
 * is one node however many journeys it is on, so the journeys meet where they share a story. This module only views
 * that: it keeps the Story and Step nodes on a `NEXT` edge, colours a story by its product and an edge by its
 * journey, shapes a step by its `shape`, and builds the filter tree (Product → Feature → Story, and the journeys).
 *
 * ```ts
 * const view = journeyView(index);
 * const data = toJourneyData(index, view, palette);
 * const groups = filterGroups(index, view);
 * const lanes = journeyLanes(view);         // each journey's lane, read left to right from its start
 * const lit = highlightOf(view, "J03");   // a journey's whole path, or every journey a story is on
 * const hulls = journeyGroups(index, view, "persona", hiddenStories); // Group by: one hull per persona
 * ```
 *
 * Level of detail is a canvas state: `ZoomStateBehaviour` writes {@link DETAIL} on every node up close, and a story's
 * label grows from its id to `id · title` while a step's name appears. An arrow's label lives only in the
 * `highlighted` overlay, so it shows for a hovered edge and for every edge of a selection.
 */
import type { TreeFilterGroup, TreeFilterItem } from "@invana/canvas-ui";
import type { GraphIndex, Palette, SpecEdge, SpecNode } from "./model";

/** One journey: its id, its label and every node its diagram reaches. */
export interface JourneyPath {
	id: string;
	title: string;
	nodes: string[];
}

/** What the view needs, read once from the parse. */
export interface JourneyView {
	/** Journeys in id order, each with the nodes on its path. */
	journeys: JourneyPath[];
	/** The journeys each story is on, in id order. */
	storyJourneys: Map<string, string[]>;
	/** The `NEXT` edges. */
	edges: SpecEdge[];
	/** The Story and Step ids drawn. */
	ids: Set<string>;
	/** The products of the stories drawn, in id order. */
	products: string[];
	/** Each product's and each journey's categorical slot, in id order. */
	slots: Map<string, number>;
}

/** Read the journey paths out of the parse. */
export function journeyView(index: GraphIndex): JourneyView {
	const edges = index.graph.edges.filter((e) => e.type === "NEXT");
	const on = new Map<string, Set<string>>();
	for (const e of edges) {
		const j = e.journey ?? "";
		if (!on.has(j)) on.set(j, new Set());
		on.get(j)?.add(e.source);
		on.get(j)?.add(e.target);
	}
	const journeys = index.graph.nodes
		.filter((n) => n.kind === "Journey" && on.has(n.id))
		.sort((a, b) => a.id.localeCompare(b.id))
		.map((n) => ({
			id: n.id,
			title: n.title,
			nodes: [...(on.get(n.id) ?? [])].sort(),
		}));
	const storyJourneys = new Map<string, string[]>();
	for (const j of journeys)
		for (const id of j.nodes)
			if (index.nodes.get(id)?.kind === "Story")
				storyJourneys.set(id, [...(storyJourneys.get(id) ?? []), j.id]);
	const ids = new Set(journeys.flatMap((j) => j.nodes));
	const products = [
		...new Set(
			[...ids].flatMap((id) => {
				const p = index.nodes.get(id)?.product;
				return p ? [p] : [];
			}),
		),
	].sort();
	const slots = new Map<string, number>([
		...products.map((p, i): [string, number] => [p, i]),
		...journeys.map((j, i): [string, number] => [j.id, i]),
	]);
	return { journeys, storyJourneys, edges, ids, products, slots };
}

/** The runtime state a node carries up close, and the zoom it starts at. */
export const DETAIL = { state: "detail", minZoom: 1.1 } as const;

/** The world-unit grid of the lanes: a column per step along a journey, a row per branch, a gap between lanes. */
export const LANE_GRID = { column: 175, row: 50, head: 60, gap: 30 } as const;

/** The id of a journey's lane head — the node that names the lane. */
export const laneId = (journey: string) => `lane:${journey}`;

/** Where every node sits: one lane per journey, top to bottom in id order. */
export interface JourneyLanes {
	/** Each node's centre, lane heads included. */
	positions: Map<string, { x: number; y: number }>;
	/** The journey whose lane a node sits in — the first journey, in id order, that reaches it. */
	owner: Map<string, string>;
}

/**
 * Lay the journeys out as lanes. A journey reads left to right from its start: a node's column is its longest
 * distance from the start along that journey's own edges (a loop back is not counted). A node is drawn once, in the
 * lane of the first journey that reaches it; a later journey's edges reach across to it. Within a lane a node keeps
 * the row of the step before it, and a branch drops to the first free row below — so a journey's main line stays
 * straight. Linear in nodes and edges.
 */
export function journeyLanes(
	view: JourneyView,
	grid: typeof LANE_GRID = LANE_GRID,
): JourneyLanes {
	const positions = new Map<string, { x: number; y: number }>();
	const owner = new Map<string, string>();
	let top = 0;
	for (const j of view.journeys) {
		const edges = view.edges.filter((e) => e.journey === j.id);
		const out = new Map<string, string[]>();
		const into = new Set<string>();
		for (const e of edges) {
			out.set(e.source, [...(out.get(e.source) ?? []), e.target]);
			into.add(e.target);
		}
		const starts = [
			...j.nodes.filter((n) => !into.has(n)),
			...j.nodes.filter((n) => into.has(n)),
		];
		// Depth first from the start: the preorder places rows, the reverse postorder ranks columns.
		const parent = new Map<string, string | null>();
		const preorder: string[] = [];
		const postorder: string[] = [];
		const back = new Set<string>();
		const onStack = new Set<string>();
		for (const root of starts) {
			if (parent.has(root)) continue;
			parent.set(root, null);
			preorder.push(root);
			onStack.add(root);
			const stack: [string, number][] = [[root, 0]];
			while (stack.length) {
				const top2 = stack[stack.length - 1] as [string, number];
				const [v, i] = top2;
				const next = out.get(v) ?? [];
				if (i >= next.length) {
					stack.pop();
					onStack.delete(v);
					postorder.push(v);
					continue;
				}
				top2[1] = i + 1;
				const w = next[i] as string;
				if (onStack.has(w)) back.add(`${v}>${w}`);
				else if (!parent.has(w)) {
					parent.set(w, v);
					preorder.push(w);
					onStack.add(w);
					stack.push([w, 0]);
				}
			}
		}
		const rank = new Map<string, number>();
		for (const v of postorder.reverse()) {
			const r = rank.get(v) ?? 0;
			rank.set(v, r);
			for (const w of out.get(v) ?? [])
				if (!back.has(`${v}>${w}`))
					rank.set(w, Math.max(rank.get(w) ?? 0, r + 1));
		}
		// Rows: a node takes its parent's row when that cell is free, else the first free row below.
		const taken = new Set<string>();
		const row = new Map<string, number>();
		let rows = 1;
		for (const v of preorder) {
			if (owner.has(v)) continue;
			owner.set(v, j.id);
			const p = parent.get(v);
			let r = p && owner.get(p) === j.id ? (row.get(p) ?? 0) : 0;
			const c = rank.get(v) ?? 0;
			while (taken.has(`${c}:${r}`)) r++;
			taken.add(`${c}:${r}`);
			row.set(v, r);
			rows = Math.max(rows, r + 1);
			positions.set(v, {
				x: c * grid.column,
				y: top + grid.head + r * grid.row,
			});
		}
		positions.set(laneId(j.id), {
			x: -grid.column / 2,
			y: top,
		});
		top += grid.head + rows * grid.row + grid.gap;
	}
	return { positions, owner };
}

/** A step's shape on the canvas, by the parse's `shape`. */
const STEP_SHAPES = {
	decision: { kind: "regular-polygon", sides: 4, radius: 11 },
	terminal: { kind: "rect", width: 30, height: 14, cornerRadius: 7 },
	step: { kind: "rect", width: 24, height: 14, cornerRadius: 2 },
} as const;

/** The longest label drawn; the full title is in the node's data. */
const LABEL_MAX = 30;

const short = (s: string) =>
	s.length > LABEL_MAX ? `${s.slice(0, LABEL_MAX - 1)}…` : s;

/**
 * How a story or a step is drawn in the Journeys view: its base `style`, and the `state` overlay it wears up close
 * ({@link DETAIL}) — a story's id grows to `id · title`; a step, unlabelled at overview, reads its name.
 */
export function journeyNodeStyle(
	n: SpecNode,
	view: JourneyView,
	palette: Palette,
) {
	if (n.kind === "Story") {
		const colour = palette.data(view.slots.get(n.product ?? "") ?? 0);
		return {
			style: {
				shape: { kind: "circle" as const, radius: 9 },
				bgFill: colour,
				bgAlpha: 1,
				bgStrokeColor: colour,
				bgStrokeWidth: 1,
				labelText: n.id,
			},
			state: { [DETAIL.state]: { labelText: short(`${n.id} · ${n.title}`) } },
		};
	}
	const shape =
		STEP_SHAPES[(n.shape ?? "step") as keyof typeof STEP_SHAPES] ??
		STEP_SHAPES.step;
	return {
		style: {
			shape,
			bgFill: palette.muted,
			bgAlpha: 0.35,
			bgStrokeColor: palette.muted,
			bgStrokeWidth: 1,
		},
		state: { [DETAIL.state]: { labelText: short(n.title) } },
	};
}

/** The canvas edge id of a `NEXT` edge — one per journey and label. */
export const nextEdgeId = (e: SpecEdge) =>
	`${e.source}|NEXT|${e.journey ?? ""}|${e.label ?? ""}|${e.target}`;

/**
 * The canvas `GraphData` of the Journeys view: every story and step on a path at its lane position, a head naming
 * each lane, and every `NEXT` edge — its arrow label only in the `highlighted` overlay (hover and selection).
 */
export function toJourneyData(
	index: GraphIndex,
	view: JourneyView,
	palette: Palette,
	lanes: JourneyLanes = journeyLanes(view),
) {
	const colourOf = (journey: string) =>
		palette.data(view.slots.get(journey) ?? 0);
	const nodes = [...view.ids].sort().map((id) => {
		const n = index.nodes.get(id) as SpecNode;
		return {
			id,
			type: n.kind,
			position: lanes.positions.get(id),
			data: {
				title: n.title,
				product: n.product ?? "—",
				journeys: (view.storyJourneys.get(id) ?? [n.journey ?? ""]).join(" · "),
				...(n.shape ? { shape: n.shape } : {}),
				path: n.path ?? "—",
			},
			...journeyNodeStyle(n, view, palette),
		};
	});
	const heads = view.journeys.map((j) => ({
		id: laneId(j.id),
		type: "Lane",
		position: lanes.positions.get(laneId(j.id)),
		data: { title: j.title, journey: j.id },
		style: {
			shape: { kind: "rect" as const, width: 6, height: 18, cornerRadius: 3 },
			bgFill: colourOf(j.id),
			bgAlpha: 1,
			bgStrokeColor: colourOf(j.id),
			bgStrokeWidth: 1,
			labelText: `${j.id} · ${j.title}`,
			labelPlacement: "right" as const,
			labelOffsetX: 6,
			labelFontWeight: 600,
			labelForceShow: true,
		},
	}));
	const at = (id: string) => lanes.positions.get(id);
	const edges = view.edges.map((e) => {
		const journey = e.journey ?? "";
		const s = at(e.source);
		const t = at(e.target);
		// Forward: out of the right face and into the left, curving between lanes.
		const forward = s && t && t.x > s.x;
		// An edge reaching into another journey's lane is hidden until its journey, a story on it or the edge is lit,
		// so each lane reads on its own.
		const across =
			lanes.owner.get(e.source) !== journey ||
			lanes.owner.get(e.target) !== journey;
		return {
			id: nextEdgeId(e),
			source: e.source,
			target: e.target,
			type: e.type,
			data: { journey, label: e.label || "—" },
			style: {
				strokeColor: colourOf(journey),
				strokeWidth: 1.5,
				strokeAlpha: across ? 0 : 0.85,
				arrowTargetShape: "triangle" as const,
				arrowTargetSize: 6,
				labelAutoRotate: false,
				...(forward
					? {
							shape: {
								pathType: "bump-horizontal" as const,
								sourceAnchor: "edge-port" as const,
								sourceAnchorOpts: { side: "right" },
								targetAnchor: "edge-port" as const,
								targetAnchorOpts: { side: "left" },
							},
						}
					: {}),
			},
			state: {
				// Lit: bolder in its own journey's colour, with its label.
				highlighted: {
					strokeColor: colourOf(journey),
					strokeWidth: 2.5,
					strokeAlpha: 1,
					...(e.label ? { labelText: e.label, labelOffsetY: -8 } : {}),
				},
			},
		};
	});
	return { nodes: [...heads, ...nodes], edges };
}

/**
 * The filter tree: Product → Feature → Story over the stories drawn (titles from the parse), and the journeys, each
 * standing for every node on its path.
 */
export function filterGroups(
	index: GraphIndex,
	view: JourneyView,
): TreeFilterGroup[] {
	const featureOf = new Map<string, string>();
	for (const e of index.graph.edges)
		if (e.type === "PART_OF" && index.nodes.get(e.source)?.kind === "Story")
			featureOf.set(e.source, e.target);
	const titled = (id: string) => {
		const t = index.nodes.get(id)?.title;
		return t ? `${id} · ${t}` : id;
	};
	const tree = new Map<string, Map<string, string[]>>();
	for (const id of [...view.storyJourneys.keys()].sort()) {
		const product = index.nodes.get(id)?.product ?? "—";
		const feature = featureOf.get(id) ?? `${product} · no feature`;
		if (!tree.has(product)) tree.set(product, new Map());
		const features = tree.get(product) as Map<string, string[]>;
		features.set(feature, [...(features.get(feature) ?? []), id]);
	}
	const products: TreeFilterItem[] = [...tree.keys()].sort().map((p) => ({
		id: `product:${p}`,
		label: index.nodes.get(p)?.title ?? p,
		children: [...(tree.get(p)?.entries() ?? [])]
			.sort((a, b) => a[0].localeCompare(b[0]))
			.map(([f, stories]) => ({
				id: `feature:${f}`,
				label: titled(f),
				children: stories.map((s) => ({
					id: s,
					label: titled(s),
					nodeIds: [s],
				})),
			})),
	}));
	return [
		{ id: "products", title: "Products", items: products },
		{
			id: "journeys",
			title: "Journeys",
			items: view.journeys.map((j) => ({
				id: j.id,
				label: `${j.id} · ${j.title}`,
				nodeIds: [laneId(j.id), ...j.nodes],
			})),
		},
	];
}

/** What the header's *Group by* can wrap the stories in, by its value in the address (`?group=`). */
export const GROUP_BY = {
	none: "None",
	capability: "Capability",
	feature: "Feature",
	persona: "Persona",
	journey: "Journey",
} as const;
export type GroupBy = keyof typeof GROUP_BY;

/** `?group=`'s value as a {@link GroupBy}; anything else is `none`. */
export const groupByOf = (value: string | null | undefined): GroupBy =>
	value && value in GROUP_BY ? (value as GroupBy) : "none";

/** One hull of *Group by*: the stories it wraps, and its categorical colour slot. */
export interface JourneyGroup {
	/** `<by>:<id>` — `persona:persona:admin`, `feature:MO-F01`. */
	id: string;
	label: string;
	/** The story ids inside it that are shown, in id order. */
	members: string[];
	/** The legend's and the hull's colour slot: a capability's and a journey's are the view's own, so a hull matches its legend entry. */
	slot: number;
}

/**
 * The groups `by` wraps the stories of the view in, each over its shown stories only — a story in `hidden` leaves
 * its hull, and a group with no story left draws none. A story sits in every group it belongs to:
 *
 * | By | A story is in | From |
 * |---|---|---|
 * | capability | its capability | the story's `product` |
 * | feature | its feature | `PART_OF` Story → Feature |
 * | persona | every persona it serves | `SERVES` Story → Persona |
 * | journey | every journey that reaches it, its own lane or another's | `NEXT` (the view's paths) |
 *
 * Slots are given before hiding, so a hull keeps its colour while the filter changes.
 */
export function journeyGroups(
	index: GraphIndex,
	view: JourneyView,
	by: GroupBy,
	hidden: ReadonlySet<string> = new Set(),
): JourneyGroup[] {
	if (by === "none") return [];
	const stories = [...view.storyJourneys.keys()].sort();
	const of = new Map<string, string[]>();
	const add = (key: string, story: string) =>
		of.set(key, [...(of.get(key) ?? []), story]);
	if (by === "journey")
		for (const j of view.journeys)
			for (const id of j.nodes) if (view.storyJourneys.has(id)) add(j.id, id);
	if (by === "capability")
		for (const s of stories) {
			const p = index.nodes.get(s)?.product;
			if (p) add(p, s);
		}
	if (by === "feature" || by === "persona") {
		const edge = by === "feature" ? "PART_OF" : "SERVES";
		const kind = by === "feature" ? "Feature" : "Persona";
		for (const e of index.graph.edges)
			if (
				e.type === edge &&
				view.storyJourneys.has(e.source) &&
				index.nodes.get(e.target)?.kind === kind
			)
				add(e.target, e.source);
	}
	const title = (id: string) => index.nodes.get(id)?.title ?? id;
	const label = (id: string) =>
		by === "persona" || by === "capability"
			? title(id)
			: `${id} · ${title(id)}`;
	return [...of.keys()]
		.sort()
		.map((key, i) => ({
			id: `${by}:${key}`,
			label: label(key),
			members: [...new Set(of.get(key))].filter((s) => !hidden.has(s)).sort(),
			slot:
				by === "capability" || by === "journey"
					? (view.slots.get(key) ?? i)
					: i,
		}))
		.filter((g) => g.members.length > 0);
}

/** What a selection lights: a journey's whole path and its lane head; a story's every journey; a product or feature, its stories. */
export function highlightOf(
	view: JourneyView,
	id: string,
	leaves: string[] = [],
): string[] {
	const journey = view.journeys.find((j) => j.id === id);
	if (journey) return [laneId(journey.id), ...journey.nodes];
	const on = view.storyJourneys.get(id);
	if (on) {
		const ids = new Set<string>([id]);
		for (const j of view.journeys)
			if (on.includes(j.id)) {
				ids.add(laneId(j.id));
				for (const n of j.nodes) ids.add(n);
			}
		return [...ids];
	}
	return leaves.filter((l) => view.ids.has(l));
}
