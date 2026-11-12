/**
 * The spec graph as the canvas draws it — pure functions over `specs-graph.json`, no DOM and no canvas.
 *
 * `specs-graph.json` is the parse `scripts/specs/check.py --graph` writes; its schema is the docstring of
 * `scripts/specs/graph.py`. This module only *views* it: it filters nodes, styles them by their ontology kind and
 * edge type, and — for the hierarchy layout alone — keeps the containment edges as a tree. It never adds a fact
 * the parse does not hold and never recomputes `analysis`.
 *
 * ```ts
 * const graph = (await (await fetch("specs-graph.json")).json()) as SpecGraph;
 * const index = indexGraph(graph);
 * const data = toGraphData(index, defaultFilters(index), "force", colors);
 * ```
 */

/** One node of the parse — see `scripts/specs/graph.py`. */
export interface SpecNode {
	id: string;
	kind: string;
	title: string;
	path: string | null;
	status: string | null;
	placeholder: boolean;
	product: string | null;
	/** The summary line, persona row or table cell the node was read with, or `null`. */
	description?: string | null;
	owner?: string | null;
	/** A step's journey. */
	journey?: string;
	/** A step's shape: `decision` · `terminal` · `step`. */
	shape?: string;
}

/** One edge of the parse. */
export interface SpecEdge {
	source: string;
	target: string;
	type: string;
	via: string;
	/** A `NEXT` edge's journey. */
	journey?: string;
	/** A `NEXT` edge's arrow label, or `""`. */
	label?: string;
}

/** `specs-graph.json`. Only the keys the graph page reads are typed. */
export interface SpecGraph {
	version: number;
	nodes: SpecNode[];
	edges: SpecEdge[];
	analysis: Record<string, unknown>;
}

/** The layouts the page offers. */
export type LayoutId = "force" | "elk" | "hierarchy" | "radial" | "sankey";

export const LAYOUTS: Record<LayoutId, string> = {
	force: "Force (d3-force)",
	elk: "Layered (ELK)",
	hierarchy: "Tree (d3-hierarchy)",
	radial: "Radial (geometric)",
	sankey: "Flow (d3-sankey)",
};

/** The value a filter uses for a node with no status. */
export const NO_STATUS = "none";

/** What the page shows: a node passes when it passes every dimension. An empty persona or product set is "all". */
export interface Filters {
	kinds: ReadonlySet<string>;
	statuses: ReadonlySet<string>;
	personas: ReadonlySet<string>;
	products: ReadonlySet<string>;
}

/** The parse, with the lookups the view needs. */
export interface GraphIndex {
	graph: SpecGraph;
	nodes: Map<string, SpecNode>;
	/** Persona ids each node serves (`SERVES`). */
	serves: Map<string, Set<string>>;
	/** Every node id adjacent to each node, over any edge. */
	neighbours: Map<string, Set<string>>;
	/** The distinct values of each filter dimension with their node counts, in display order. */
	counts: {
		kinds: [string, number][];
		statuses: [string, number][];
		personas: [string, string, number][];
		products: [string, string, number][];
	};
}

/**
 * Kinds the page hides on load — the rows of a spec's tables, thousands together, which would drown the rest:
 * decisions, acceptance criteria and the Engine's records, routes, events and refusals. Filters offers each; a focused
 * node's kind is always shown.
 */
export const HIDDEN_ON_LOAD = new Set([
	"Decision",
	"Criterion",
	"Record",
	"Route",
	"Event",
	"Refusal",
]);

/** The node a view-only tree root stands for in the hierarchy layout; it is not in the parse. */
export const TREE_ROOT = "specs/";

/** Containment edges, read child → parent; the hierarchy layout draws them parent → child. */
const CONTAINMENT = new Set(["PART_OF", "DECIDES"]);

const statusOf = (n: SpecNode) => n.status ?? NO_STATUS;

const tally = (values: Iterable<string>) => {
	const m = new Map<string, number>();
	for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
	return m;
};

/** Index the parse once. */
export function indexGraph(graph: SpecGraph): GraphIndex {
	const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
	const serves = new Map<string, Set<string>>();
	const neighbours = new Map<string, Set<string>>();
	const link = (a: string, b: string) => {
		if (!neighbours.has(a)) neighbours.set(a, new Set());
		neighbours.get(a)?.add(b);
	};
	for (const e of graph.edges) {
		link(e.source, e.target);
		link(e.target, e.source);
		if (e.type === "SERVES") {
			if (!serves.has(e.source)) serves.set(e.source, new Set());
			serves.get(e.source)?.add(e.target);
		}
	}
	const kinds = tally(graph.nodes.map((n) => n.kind));
	const statuses = tally(graph.nodes.map(statusOf));
	const personaCount = tally([...serves.values()].flatMap((s) => [...s]));
	const productCount = tally(
		graph.nodes.flatMap((n) => (n.product ? [n.product] : [])),
	);
	const titled = (id: string) => nodes.get(id)?.title || id;
	return {
		graph,
		nodes,
		serves,
		neighbours,
		counts: {
			kinds: [...kinds].sort((a, b) => a[0].localeCompare(b[0])),
			statuses: [...statuses].sort((a, b) => a[0].localeCompare(b[0])),
			personas: graph.nodes
				.filter((n) => n.kind === "Persona")
				.map((n): [string, string, number] => [
					n.id,
					titled(n.id),
					personaCount.get(n.id) ?? 0,
				]),
			products: [...productCount]
				.sort((a, b) => a[0].localeCompare(b[0]))
				.map(([code, n]): [string, string, number] => [code, titled(code), n]),
		},
	};
}

/** Every kind and status but the ones hidden on load; no persona or product narrowing. */
export function defaultFilters(
	index: GraphIndex,
	focus?: string | null,
): Filters {
	const focusKind = focus ? index.nodes.get(focus)?.kind : undefined;
	return {
		kinds: new Set(
			index.counts.kinds
				.map(([k]) => k)
				.filter((k) => !HIDDEN_ON_LOAD.has(k) || k === focusKind),
		),
		statuses: new Set(index.counts.statuses.map(([s]) => s)),
		personas: new Set(),
		products: new Set(),
	};
}

/**
 * The ids that pass `filters`.
 *
 * Kind and status narrow every node. A product narrows to that product's nodes and the product-less nodes next to
 * them (a persona, a board, a journey they touch). A persona narrows to the nodes that serve it, and the persona.
 */
export function visibleIds(index: GraphIndex, filters: Filters): Set<string> {
	let ids = new Set(
		index.graph.nodes
			.filter(
				(n) => filters.kinds.has(n.kind) && filters.statuses.has(statusOf(n)),
			)
			.map((n) => n.id),
	);
	if (filters.products.size > 0) {
		const inProduct = new Set(
			[...ids].filter((id) => {
				const p = index.nodes.get(id)?.product;
				return p != null && filters.products.has(p);
			}),
		);
		const beside = [...ids].filter(
			(id) =>
				index.nodes.get(id)?.product == null &&
				[...(index.neighbours.get(id) ?? [])].some((o) => inProduct.has(o)),
		);
		ids = new Set([...inProduct, ...beside]);
	}
	if (filters.personas.size > 0) {
		ids = new Set(
			[...ids].filter(
				(id) =>
					filters.personas.has(id) ||
					[...(index.serves.get(id) ?? [])].some((p) =>
						filters.personas.has(p),
					),
			),
		);
	}
	return ids;
}

/**
 * The site page a node is read from, relative to the site root — `products/…/feature/` — or `null` for a node
 * with no file under `specs/` (a board). Follows MkDocs' directory URLs: `README.md` and `index.md` are their folder.
 */
export function pageUrl(path: string | null): string | null {
	if (!path) return null;
	const p = path.replaceAll("\\", "/");
	if (!p.startsWith("specs/") || !p.endsWith(".md")) return null;
	const rel = p.slice("specs/".length, -".md".length);
	const parts = rel.split("/");
	const last = parts.at(-1)?.toLowerCase();
	if (last === "readme" || last === "index") parts.pop();
	return parts.length ? `${parts.join("/")}/` : "";
}

/** The node a URL asks the graph to focus on: `?focus=<id>`, or `null`. */
export function focusFrom(search: string): string | null {
	const id = new URLSearchParams(search).get("focus");
	return id?.trim() ? id.trim() : null;
}

/** The colours the canvas paints, resolved from the design-kit tokens by the caller. */
export interface Palette {
	/** A node kind's or an edge type's colour. */
	type: (name: string) => number;
	/** The grey a placeholder is drawn in. */
	muted: number;
	/** The warning colour: the dense end of the unready-density bands. */
	alert: number;
	/** The n-th categorical data slot (0-based, wrapping over the kit's eight). */
	data: (slot: number) => number;
}

type Shape =
	| { kind: "circle"; radius: number }
	| { kind: "rect"; width: number; height: number; cornerRadius: number }
	| { kind: "regular-polygon"; sides: number; radius: number }
	| { kind: "star"; points: number; innerRadius: number; outerRadius: number };

/** A shape per ontology kind, so a kind reads without its colour. */
const SHAPES: Record<string, Shape> = {
	Product: { kind: "regular-polygon", sides: 6, radius: 22 },
	Feature: { kind: "rect", width: 30, height: 20, cornerRadius: 4 },
	Story: { kind: "circle", radius: 8 },
	Journey: { kind: "regular-polygon", sides: 4, radius: 12 },
	Task: { kind: "circle", radius: 5 },
	Persona: { kind: "star", points: 5, innerRadius: 7, outerRadius: 15 },
	Board: { kind: "rect", width: 14, height: 10, cornerRadius: 1 },
	NFR: { kind: "regular-polygon", sides: 3, radius: 11 },
	DesignSection: { kind: "rect", width: 22, height: 22, cornerRadius: 2 },
	Decision: { kind: "circle", radius: 4 },
	Criterion: { kind: "circle", radius: 3 },
	Record: { kind: "rect", width: 18, height: 12, cornerRadius: 0 },
	Route: { kind: "regular-polygon", sides: 5, radius: 8 },
	Event: { kind: "star", points: 4, innerRadius: 3, outerRadius: 8 },
	Refusal: { kind: "regular-polygon", sides: 8, radius: 7 },
};

/** Edge widths by type: the dependencies the graph exists to show draw heaviest. */
const EDGE_WIDTH: Record<string, number> = {
	DEPENDS_ON: 2.5,
	MUST_MEET: 2,
	CHANGES: 2,
	PART_OF: 1.5,
};

/** A node's label: personas and boards by title, the rest by id. */
export function labelOf(n: SpecNode): string {
	if (n.kind === "Persona" || n.kind === "Board") return n.title || n.id;
	return n.id;
}

/** How one node is drawn: its kind's shape and colour, a placeholder grey with a dashed outline. */
export function nodeStyle(n: SpecNode, palette: Palette) {
	const colour = n.placeholder ? palette.muted : palette.type(n.kind);
	return {
		shape: SHAPES[n.kind] ?? { kind: "circle", radius: 6 },
		bgFill: colour,
		bgAlpha: n.placeholder ? 0.35 : 1,
		bgStrokeColor: colour,
		bgStrokeWidth: n.placeholder ? 2 : 1,
		...(n.placeholder ? { bgStrokeDashArray: [4, 3] as [number, number] } : {}),
		labelText: labelOf(n),
	};
}

/** How one edge is drawn: its type's colour; a mention is dashed and faint. */
export function edgeStyle(type: string, palette: Palette) {
	const mention = type === "MENTIONS";
	return {
		strokeColor: palette.type(type),
		strokeWidth: EDGE_WIDTH[type] ?? 1,
		strokeAlpha: mention ? 0.35 : 0.8,
		arrowTargetShape: "triangle" as "triangle" | "none",
		arrowTargetSize: 6,
		...(mention ? { strokeDashArray: [6, 4] as [number, number] } : {}),
	};
}

export interface CanvasNode {
	id: string;
	type: string;
	data: Record<string, unknown>;
	style: ReturnType<typeof nodeStyle>;
}

export interface CanvasEdge {
	id: string;
	source: string;
	target: string;
	type: string;
	data: Record<string, unknown>;
	style: ReturnType<typeof edgeStyle>;
}

/**
 * The containment tree over `ids`, parent → child, for the hierarchy layout: each node's first `PART_OF` or
 * `DECIDES` parent that is shown; a node with none hangs from {@link TREE_ROOT}. A d3 tree needs one root and one
 * parent per node, so a second parent is left out of this view (the other layouts draw it).
 */
export function treeEdges(index: GraphIndex, ids: ReadonlySet<string>) {
	const parent = new Map<string, SpecEdge>();
	for (const e of index.graph.edges) {
		if (!CONTAINMENT.has(e.type) || parent.has(e.source)) continue;
		if (ids.has(e.source) && ids.has(e.target)) parent.set(e.source, e);
	}
	// A loop in containment would have no root; its members hang from the tree root instead.
	const rooted = (id: string) => {
		const seen = new Set<string>();
		for (let n: string | undefined = id; n; n = parent.get(n)?.target) {
			if (seen.has(n)) return false;
			seen.add(n);
		}
		return true;
	};
	const tree: SpecEdge[] = [];
	for (const id of ids) {
		const e = parent.get(id);
		if (e && rooted(id))
			tree.push({ ...e, source: e.target, target: e.source });
		else
			tree.push({ source: TREE_ROOT, target: id, type: "IN_SPECS", via: "" });
	}
	return tree;
}

/** The columns of the flow view, left to right. */
export const SANKEY_KINDS = ["Story", "Feature", "NFR", "DesignSection"];

/** The parsed edges the flow view draws: a story's feature, the NFRs a story or feature must meet, an NFR's section. */
export function isFlowEdge(e: SpecEdge, index: GraphIndex): boolean {
	const from = index.nodes.get(e.source)?.kind;
	const to = index.nodes.get(e.target)?.kind;
	if (e.type === "PART_OF")
		return (
			(from === "Story" && to === "Feature") ||
			(from === "NFR" && to === "DesignSection")
		);
	return e.type === "MUST_MEET" && to === "NFR";
}

/**
 * The flow view's edges over `filters`: the {@link SANKEY_KINDS} columns whatever the kind filter says (status,
 * product and persona still narrow), joined only by {@link isFlowEdge} edges. A node with no flow edge has no place in
 * a flow and is left out; each edge carries one unit.
 */
export function sankeyEdges(index: GraphIndex, filters: Filters): SpecEdge[] {
	const ids = visibleIds(index, {
		...filters,
		kinds: new Set(SANKEY_KINDS),
	});
	return index.graph.edges.filter(
		(e) => ids.has(e.source) && ids.has(e.target) && isFlowEdge(e, index),
	);
}

/**
 * The canvas `GraphData` for what `filters` leave: every node it passes, styled, and every parsed edge between two
 * of them — or, for the hierarchy layout, the containment tree (see {@link treeEdges}), and for the flow layout the
 * story → feature → NFR → design-section flow (see {@link sankeyEdges}).
 */
export function toGraphData(
	index: GraphIndex,
	filters: Filters,
	layout: LayoutId,
	palette: Palette,
): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
	if (layout === "sankey") return toFlowData(index, filters, palette);
	const ids = visibleIds(index, filters);
	const nodes = [...ids].map((id) => toCanvasNode(index, id, palette));
	let specEdges: SpecEdge[];
	if (layout === "hierarchy") {
		specEdges = treeEdges(index, ids);
		const root: SpecNode = {
			id: TREE_ROOT,
			kind: "Specs",
			title: "specs/",
			path: null,
			status: null,
			placeholder: false,
			product: null,
		};
		nodes.push({
			id: TREE_ROOT,
			type: root.kind,
			data: { title: "The specs folder — the tree's root in this view only" },
			style: { ...nodeStyle(root, palette), labelText: TREE_ROOT },
		});
	} else {
		specEdges = index.graph.edges.filter(
			(e) => ids.has(e.source) && ids.has(e.target),
		);
	}
	return { nodes, edges: toCanvasEdges(specEdges, palette) };
}

/** The canvas edge id of a parsed edge. */
export const edgeId = (e: SpecEdge) => `${e.source}|${e.type}|${e.target}`;

function toCanvasNode(
	index: GraphIndex,
	id: string,
	palette: Palette,
): CanvasNode {
	const n = index.nodes.get(id) as SpecNode;
	return {
		id,
		type: n.kind,
		data: {
			title: n.title,
			status: n.status ?? "—",
			placeholder: n.placeholder,
			product: n.product ?? "—",
			path: n.path ?? "—",
			...(n.description ? { description: n.description } : {}),
			...(n.owner ? { owner: n.owner } : {}),
		},
		style: nodeStyle(n, palette),
	};
}

function toCanvasEdges(specEdges: SpecEdge[], palette: Palette): CanvasEdge[] {
	const seen = new Set<string>();
	const edges: CanvasEdge[] = [];
	for (const e of specEdges) {
		const id = edgeId(e);
		if (seen.has(id)) continue;
		seen.add(id);
		edges.push({
			id,
			source: e.source,
			target: e.target,
			type: e.type,
			data: { via: e.via || "—" },
			style: edgeStyle(e.type, palette),
		});
	}
	return edges;
}

/** The flow view: the nodes on a flow edge, and those edges as ribbons of one unit each — no arrowheads. */
function toFlowData(index: GraphIndex, filters: Filters, palette: Palette) {
	const specEdges = sankeyEdges(index, filters);
	const ids = new Set(specEdges.flatMap((e) => [e.source, e.target]));
	const nodes = [...ids].map((id) => toCanvasNode(index, id, palette));
	const edges = toCanvasEdges(specEdges, palette).map((e) => ({
		...e,
		data: { ...e.data, value: 1 },
		style: { ...e.style, arrowTargetShape: "none" as const, strokeAlpha: 0.4 },
	}));
	return { nodes, edges };
}
