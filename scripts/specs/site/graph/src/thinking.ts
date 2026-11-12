/**
 * Graph-thinking over the spec graph — pure functions, no DOM and no canvas.
 *
 * | Function | Answers |
 * |---|---|
 * | {@link readAnalysis} | The parser's `analysis` block, typed. The page lists and highlights it; it never recomputes it |
 * | {@link blastRadius} | What a change to one node reaches: everything that depends on it, part of it, drawn on it or serving through it, transitively |
 * | {@link shortestPath} | The fewest typed edges between two nodes, in either direction |
 * | {@link productSets} · {@link loopSets} | The groups the bubble-sets layer draws: one per product, one per loop |
 * | {@link unreadyIds} | The nodes the density contour weighs: status `idea`, or a placeholder |
 *
 * Blast radius and path are queries a person asks of the graph by pointing at it, not analysis of the whole
 * tree, so they are computed here from the parse's edges — the same edges the page draws.
 */
import type { GraphIndex, SpecEdge } from "./model";

/** `analysis` in `specs-graph.json` — see `scripts/specs/graph.py`. */
export interface Analysis {
	cycles: string[][];
	chains: string[][];
	blockers: { source: string; target: string; type: string }[];
	orphans: string[];
	gaps: { node: string; gap: string }[];
}

/** The parse's `analysis`, with every list present. */
export function readAnalysis(raw: Record<string, unknown>): Analysis {
	const list = <T>(key: string) =>
		Array.isArray(raw[key]) ? (raw[key] as T[]) : [];
	return {
		cycles: list<string[]>("cycles"),
		chains: list<string[]>("chains"),
		blockers: list("blockers"),
		orphans: list<string>("orphans"),
		gaps: list("gaps"),
	};
}

/**
 * The edge types a change travels back along: `A —T→ B` means a change to B reaches A. A mention is prose, and a
 * decision governs its subject rather than depending on it, so neither carries a change.
 */
export const BLAST_TYPES = new Set([
	"DEPENDS_ON",
	"MUST_MEET",
	"CHANGES",
	"PART_OF",
	"DRAWN_ON",
	"IN_JOURNEY",
	"SERVES",
]);

/** Every node a change to `id` reaches, with its distance in hops; `id` itself is at 0. */
export function blastRadius(
	index: GraphIndex,
	id: string,
): Map<string, number> {
	const into = new Map<string, string[]>();
	for (const e of index.graph.edges) {
		if (!BLAST_TYPES.has(e.type)) continue;
		if (!into.has(e.target)) into.set(e.target, []);
		into.get(e.target)?.push(e.source);
	}
	const depth = new Map([[id, 0]]);
	let frontier = [id];
	for (let d = 1; frontier.length; d++) {
		const next: string[] = [];
		for (const n of frontier)
			for (const s of into.get(n) ?? [])
				if (!depth.has(s)) {
					depth.set(s, d);
					next.push(s);
				}
		frontier = next;
	}
	return depth;
}

/**
 * The shortest path from `from` to `to` over the parsed edges between nodes in `ids`, walked in either direction —
 * as node ids, ends included, and the edges it takes. `null` when no path joins them. A mention is prose, not
 * structure, so it is walked only when no typed path exists.
 */
export function shortestPath(
	index: GraphIndex,
	from: string,
	to: string,
	ids: ReadonlySet<string>,
): { nodes: string[]; edges: SpecEdge[] } | null {
	const typed = index.graph.edges.filter((e) => e.type !== "MENTIONS");
	return (
		bfs(typed, from, to, ids) ?? bfs(index.graph.edges, from, to, ids) ?? null
	);
}

function bfs(
	edges: SpecEdge[],
	from: string,
	to: string,
	ids: ReadonlySet<string>,
) {
	if (!ids.has(from) || !ids.has(to)) return undefined;
	const adj = new Map<string, [string, SpecEdge][]>();
	const add = (a: string, b: string, e: SpecEdge) => {
		if (!adj.has(a)) adj.set(a, []);
		adj.get(a)?.push([b, e]);
	};
	for (const e of edges) {
		if (!ids.has(e.source) || !ids.has(e.target)) continue;
		add(e.source, e.target, e);
		add(e.target, e.source, e);
	}
	const prev = new Map<string, [string, SpecEdge] | null>([[from, null]]);
	const queue = [from];
	while (queue.length) {
		const n = queue.shift() as string;
		if (n === to) break;
		for (const [m, e] of adj.get(n) ?? [])
			if (!prev.has(m)) {
				prev.set(m, [n, e]);
				queue.push(m);
			}
	}
	if (!prev.has(to)) return undefined;
	const nodes = [to];
	const path: SpecEdge[] = [];
	for (let step = prev.get(to); step; step = prev.get(step[0])) {
		nodes.unshift(step[0]);
		path.unshift(step[1]);
	}
	return { nodes, edges: path };
}

/** A group the bubble-sets layer draws. */
export interface NodeSet {
	id: string;
	label: string;
	members: string[];
}

/** One set per product with two or more of its nodes in `ids`. */
export function productSets(
	index: GraphIndex,
	ids: ReadonlySet<string>,
): NodeSet[] {
	const by = new Map<string, string[]>();
	for (const id of ids) {
		const p = index.nodes.get(id)?.product;
		if (!p) continue;
		if (!by.has(p)) by.set(p, []);
		by.get(p)?.push(id);
	}
	return [...by]
		.filter(([, m]) => m.length > 1)
		.sort((a, b) => a[0].localeCompare(b[0]))
		.map(([code, members]) => ({
			id: `product:${code}`,
			label: index.nodes.get(code)?.title || code,
			members,
		}));
}

/** One set per loop in `analysis.cycles`, over its members in `ids`, numbered as the site's `/loops` page numbers them. */
export function loopSets(
	analysis: Analysis,
	ids: ReadonlySet<string>,
): NodeSet[] {
	return analysis.cycles
		.map((c, i) => ({
			id: `loop:${i + 1}`,
			label: `Loop ${i + 1}`,
			members: c.filter((n) => ids.has(n)),
		}))
		.filter((s) => s.members.length > 1);
}

/** The nodes in `ids` that are not ready to build on: status `idea`, or a placeholder. */
export function unreadyIds(index: GraphIndex, ids: Iterable<string>): string[] {
	return [...ids].filter((id) => {
		const n = index.nodes.get(id);
		return n != null && (n.placeholder || n.status === "idea");
	});
}
