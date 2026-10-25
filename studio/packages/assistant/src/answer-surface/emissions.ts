// Deriving emissions from what a reply carries today
// (docs/for-developers/modules/ask/features/the-answer-surface.md).
//
// The engine does not produce typed emissions yet — 3.3's API column is not
// built, so there is no `emissions` row, no `template_id` and no citation to
// resolve. What a reply *does* carry is the query result the Execute step
// returned, and that already knows its own shape. So Studio folds one emission
// out of it: `tabular` is a table, `graph` is a subgraph, and either at zero
// records is the empty emission.
//
// This is the seam that goes when the engine emits: `emissionsFromResult` is
// replaced by reading the emissions off the run, and every component below
// it keeps working — they take an `Emission`, not a `QueryResponse`.

import type { Emission, QueryResponse } from "@invana-studio/core";

/** Worded as an answer, not as a count — the engine will carry its own
 *  sentence once emissions are real. */
const NOTHING_HELD = "The graph does not hold records for this question.";

export function emissionsFromResult(
	result: QueryResponse | null | undefined,
	{ onCanvas = false }: { onCanvas?: boolean } = {},
): Emission[] {
	if (!result) return [];

	if (result.result_type === "graph") {
		const data = result.data;
		const count = data ? data.nodes.length + data.edges.length : 0;
		if (!data || count === 0) {
			return [
				{
					seq: 0,
					kind: "empty",
					statement: NOTHING_HELD,
					citation: { recordCount: 0 },
				},
			];
		}
		return [
			{
				seq: 0,
				kind: "subgraph",
				data,
				onCanvas,
				// The records behind the emission are the rows the query returned
				// — not the nodes and edges the projection folded them into,
				// which the body states in its own words.
				citation: { recordCount: result.row_count || count },
			},
		];
	}

	const rows = result.rows ?? [];
	if (rows.length === 0) {
		return [
			{
				seq: 0,
				kind: "empty",
				statement: NOTHING_HELD,
				citation: { recordCount: 0 },
			},
		];
	}
	return [
		{
			seq: 0,
			kind: "table",
			rows,
			citation: { recordCount: result.row_count || rows.length },
		},
	];
}

// ── The link emission (docs/for-developers/modules/ask/features/the-assistant-opens-boards.md)
//
// An ask for a list is answered by opening it: `board.open` writes a `link`
// emission naming the list, its filters as the list contract's own params,
// one chip per filter and the row count the list's own query returned.

/** One filter the link sets, as the list's strip reads it. */
interface LinkChip {
	field: string;
	title: string;
	value: string;
	label: string;
}

/** A filter the engine could not resolve, in the words that failed. */
interface LinkUnresolved {
	field: string;
	word: string;
	reason: string;
}

export interface LinkEmission {
	id: string;
	seq: number;
	/** `runs` · `agents` · `approvals` · `ledger`. */
	list: string;
	/** The list's name — `Runs`. */
	label: string;
	/** What one row is called, singular then plural. */
	noun: [string, string];
	/** Where the list lives under the Graph — `/agents/runs`. */
	path: string;
	/** `f.<field>` → value, exactly what a person would set. */
	params: Record<string, string>;
	chips: LinkChip[];
	total: number;
	unresolved: LinkUnresolved[];
}

/** One emission row as the engine returns it, before any kind is read. */
export interface RawEmissionRow {
	id: string;
	seq: number;
	kind: string;
	payload: Record<string, unknown>;
}

/** The link rows of a run's emissions, in order; every other kind is left out. */
export function linksFromRows(rows: readonly RawEmissionRow[]): LinkEmission[] {
	return rows
		.filter((r) => r.kind === "link")
		.map((r) => {
			const p = r.payload;
			const noun = Array.isArray(p.noun) ? p.noun.map(String) : [];
			return {
				id: r.id,
				seq: r.seq,
				list: String(p.list ?? ""),
				label: String(p.label ?? p.list ?? ""),
				noun: [noun[0] ?? "row", noun[1] ?? "rows"],
				path: String(p.path ?? ""),
				params: (p.params ?? {}) as Record<string, string>,
				chips: (Array.isArray(p.chips) ? p.chips : []) as LinkChip[],
				total: Number(p.total ?? 0),
				unresolved: (Array.isArray(p.unresolved)
					? p.unresolved
					: []) as LinkUnresolved[],
			};
		});
}

/** The address a link opens — the list's own params, marked as the assistant's. */
export function linkHref(
	link: Pick<LinkEmission, "path" | "params">,
	username: string,
	graphSlug: string,
): string {
	const search = new URLSearchParams(link.params);
	search.set("via", "assistant");
	return `/u/${username}/${graphSlug}${link.path}?${search.toString()}`;
}
