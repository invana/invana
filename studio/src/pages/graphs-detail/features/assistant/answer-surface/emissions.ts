// Deriving emissions from what a reply carries today
// (docs/for-developers/modules/ask/features/the-answer-surface.md).
//
// The engine does not produce typed emissions yet — 3.3's API column is not
// built, so there is no `emissions` row, no `template_id` and no citation to
// resolve. What a reply *does* carry is the query result the Execute step
// returned, and that already knows its own shape. So Studio folds one emission
// out of it: `tabular` is a table, `graph` is a subgraph, and either at zero
// records is the empty emission (AS7).
//
// This is the seam that goes when the engine emits: `emissionsFromResult` is
// replaced by reading the emissions off the run, and every component below
// it keeps working — they take an `Emission`, not a `QueryResponse`.

import type { Emission } from "@/types/emission";
import type { QueryResponse } from "@/types/query";

/** Worded as an answer, not as a count — the engine will carry its own
 *  sentence once emissions are real (AS7). */
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
				// (AS3) — not the nodes and edges the projection folded them into,
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
