/**
 * How ⌘K orders what it found: names first, by how well they match.
 *
 * A query matches a name exactly, as its start, as the start of one of its
 * words, or somewhere inside it — four ranks, best first. Keywords count as
 * names. Within a rank the shorter name wins, so `airport` sits above
 * `airport lounge` for `air`. Anything that matches none of the four is out:
 * meaning-based matches are a separate group, never mixed into these.
 */

export interface Rankable {
	label: string;
	keywords?: string[];
}

/** 0 exact · 1 prefix · 2 a word's prefix · 3 contains · null no match. */
export function matchRank(query: string, item: Rankable): number | null {
	const q = query.trim().toLowerCase();
	if (!q) return null;
	let best: number | null = null;
	for (const name of [item.label, ...(item.keywords ?? [])]) {
		const n = name.toLowerCase();
		const rank =
			n === q
				? 0
				: n.startsWith(q)
					? 1
					: n.split(/[\s\-_/·:.]+/).some((w) => w.startsWith(q))
						? 2
						: n.includes(q)
							? 3
							: null;
		if (rank !== null && (best === null || rank < best)) best = rank;
	}
	return best;
}

/** The items that match, best first, at most `limit`. */
export function rankByName<T extends Rankable>(
	query: string,
	items: readonly T[],
	limit = 5,
): T[] {
	return items
		.map((item) => ({ item, rank: matchRank(query, item) }))
		.filter((r): r is { item: T; rank: number } => r.rank !== null)
		.sort(
			(a, b) => a.rank - b.rank || a.item.label.length - b.item.label.length,
		)
		.slice(0, limit)
		.map((r) => r.item);
}
