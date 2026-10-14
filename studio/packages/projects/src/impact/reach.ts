/**
 * The reach of an option over the graph — what the records its evidence cites
 * touch, one hop at a time. Pure: no React, no network; the caller hands in
 * the read (`read(vertexId)`, one Explorer expand) and gets back counts.
 *
 * The walk is breadth-first and bounded. Hop 0 is the seeds — the records the
 * option's findings cite, each counted once. Each later hop expands at most
 * `PER_HOP` records of the hop before (the ones reached by the most
 * relationships first, ties by id), each to `NEIGHBOURS` neighbours. A record
 * already reached at an earlier hop is never counted again. When a bound
 * trims what a hop could have reached — a frontier larger than `PER_HOP`, or a
 * read with more neighbours than it returned — that hop is *cut*, and the tab
 * says *more lies beyond*.
 *
 * `walkReach` calls `onHop` after every hop with the reach so far, so a
 * drawing can grow as the reads land. `summarise` is the grouping on its own:
 * from what was read to the per-hop groups, the links between them and the
 * most-reached records.
 */

import type { NeighbourRead, ReachEdge, ReachVertex } from "../types";

/** Records expanded per hop. */
export const PER_HOP = 12;
/** Neighbours asked of each expand. */
export const NEIGHBOURS = 50;
/** The furthest a reach walks. */
export const MAX_HOPS = 3;

/** One type at one hop. */
export interface ReachGroup {
	label: string;
	count: number;
	ids: string[];
	/** A bound trimmed this hop — more lies beyond. */
	cut: boolean;
}

interface ReachHop {
	hop: number;
	groups: ReachGroup[];
}

/** Relationships of one type joining a group at `fromHop` to one a hop further. */
interface ReachLink {
	fromHop: number;
	fromLabel: string;
	toLabel: string;
	edgeLabel: string;
	count: number;
}

interface ReachedRecord {
	id: string;
	label: string;
	name: string;
	hop: number;
	/** Relationships it was reached by, counted over every read. */
	degree: number;
}

export interface Reach {
	hops: ReachHop[];
	links: ReachLink[];
	/** The most-reached records past the seeds. */
	top: ReachedRecord[];
	/** Every reached record's display name, by id. */
	names: Map<string, string>;
	reads: number;
	/** Each refusal once, as the engine worded it. */
	errors: string[];
}

/** What the walk has read so far — the input `summarise` groups. */
interface ReachState {
	nodes: Map<string, { vertex: ReachVertex | null; hop: number }>;
	edges: Map<string, ReachEdge>;
	/** Hops a bound trimmed. */
	cut: Set<number>;
	reads: number;
	errors: string[];
}

const SEED_LABEL = "record";
const TOP = 8;

/** A record's display name: `name`, `title`, `code`, else its id. */
function nameOf(v: ReachVertex | null, id: string): string {
	const p = v?.properties ?? {};
	const n = p.name ?? p.title ?? p.code;
	return n === undefined || n === null || n === "" ? id : String(n);
}

function degrees(edges: Map<string, ReachEdge>): Map<string, number> {
	const d = new Map<string, number>();
	for (const e of edges.values()) {
		d.set(e.source, (d.get(e.source) ?? 0) + 1);
		if (e.target !== e.source) d.set(e.target, (d.get(e.target) ?? 0) + 1);
	}
	return d;
}

const byDegree =
	(d: Map<string, number>) =>
	(a: string, b: string): number =>
		(d.get(b) ?? 0) - (d.get(a) ?? 0) || (a < b ? -1 : a > b ? 1 : 0);

/** From what was read to groups per hop, links between them and the top records. */
function summarise(state: ReachState): Reach {
	const labelOf = (id: string) =>
		state.nodes.get(id)?.vertex?.label || SEED_LABEL;
	const deg = degrees(state.edges);

	const perHop = new Map<number, Map<string, string[]>>();
	for (const [id, n] of state.nodes) {
		const groups = perHop.get(n.hop) ?? new Map<string, string[]>();
		const label = labelOf(id);
		groups.set(label, [...(groups.get(label) ?? []), id]);
		perHop.set(n.hop, groups);
	}
	const hops: ReachHop[] = [...perHop.keys()]
		.sort((a, b) => a - b)
		.map((hop) => ({
			hop,
			groups: [...(perHop.get(hop) ?? new Map()).entries()]
				.map(([label, ids]: [string, string[]]) => ({
					label,
					count: ids.length,
					ids: [...ids].sort(byDegree(deg)),
					cut: state.cut.has(hop),
				}))
				.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
		}));

	const links = new Map<string, ReachLink>();
	for (const e of state.edges.values()) {
		const s = state.nodes.get(e.source);
		const t = state.nodes.get(e.target);
		if (!s || !t || Math.abs(s.hop - t.hop) !== 1) continue;
		const [from, to] =
			s.hop < t.hop ? [e.source, e.target] : [e.target, e.source];
		const fromHop = Math.min(s.hop, t.hop);
		const link = {
			fromHop,
			fromLabel: labelOf(from),
			toLabel: labelOf(to),
			edgeLabel: e.label,
		};
		const key = `${fromHop}|${link.fromLabel}|${link.toLabel}|${link.edgeLabel}`;
		const seen = links.get(key);
		links.set(key, { ...link, count: (seen?.count ?? 0) + 1 });
	}

	const top = [...state.nodes.entries()]
		.filter(([, n]) => n.hop > 0)
		.map(([id]) => id)
		.sort(byDegree(deg))
		.slice(0, TOP)
		.map((id) => {
			const n = state.nodes.get(id);
			return {
				id,
				label: labelOf(id),
				name: nameOf(n?.vertex ?? null, id),
				hop: n?.hop ?? 0,
				degree: deg.get(id) ?? 0,
			};
		});

	return {
		hops,
		links: [...links.values()].sort(
			(a, b) => a.fromHop - b.fromHop || b.count - a.count,
		),
		top,
		names: new Map(
			[...state.nodes].map(([id, n]) => [id, nameOf(n.vertex, id)]),
		),
		reads: state.reads,
		errors: state.errors,
	};
}

/**
 * Walk the reach from `seeds` out to `hops` hops. `onHop(reach, next)` fires
 * after the seeds and after each hop lands; `next` is the hop about to be
 * read, or null when the walk is done. A read that fails is recorded in
 * `errors` and the walk goes on with what the others returned.
 */
export async function walkReach({
	seeds,
	hops,
	read,
	onHop,
}: {
	seeds: string[];
	hops: number;
	read: (vertexId: string) => Promise<NeighbourRead>;
	onHop?: (reach: Reach, next: number | null) => void;
}): Promise<Reach> {
	const depth = Math.max(1, Math.min(MAX_HOPS, Math.floor(hops)));
	const state: ReachState = {
		nodes: new Map(),
		edges: new Map(),
		cut: new Set(),
		reads: 0,
		errors: [],
	};
	for (const id of seeds)
		if (!state.nodes.has(id)) state.nodes.set(id, { vertex: null, hop: 0 });

	let frontier = [...state.nodes.keys()];
	for (let hop = 1; hop <= depth && frontier.length > 0; hop++) {
		onHop?.(summarise(state), hop);
		const deg = degrees(state.edges);
		const expand = [...frontier].sort(byDegree(deg)).slice(0, PER_HOP);
		if (frontier.length > PER_HOP) state.cut.add(hop);

		const results = await Promise.allSettled(expand.map((id) => read(id)));
		const next: string[] = [];
		for (const r of results) {
			state.reads += 1;
			if (r.status === "rejected") {
				const msg =
					r.reason instanceof Error ? r.reason.message : String(r.reason);
				if (!state.errors.includes(msg)) state.errors.push(msg);
				continue;
			}
			const { data, total, returned, has_more } = r.value;
			if (has_more || total > returned) state.cut.add(hop);
			for (const v of data.nodes) {
				const seen = state.nodes.get(v.id);
				if (seen) {
					if (!seen.vertex) seen.vertex = v;
					continue;
				}
				state.nodes.set(v.id, { vertex: v, hop });
				next.push(v.id);
			}
			for (const e of data.edges) state.edges.set(e.id, e);
		}
		frontier = next;
	}
	const reach = summarise(state);
	onHop?.(reach, null);
	return reach;
}
