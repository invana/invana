/**
 * The one list contract (docs/for-developers/modules/platform/features/list-contract.md).
 * Every list endpoint answers a `Page`; `total` and `unfiltered_total` are the
 * engine's counts — Studio shows them and never counts `items`.
 */

/** One filter the engine applied, labelled the way a person reads it. */
export interface AppliedFilter {
	/** The filter's field — `q` for the search. */
	field: string;
	/** The chip's words before the value: `agent` for `agent_id`. */
	title: string;
	value: string;
	/** The value as a person reads it: an agent's name for its id. */
	label: string;
}

export interface Page<T> {
	items: T[];
	/** Every row that matches. */
	total: number;
	/** Every row with no search and no filters — "2 of 61 match". */
	unfiltered_total: number;
	next_cursor: string | null;
	applied: AppliedFilter[];
}

/** What a list asks the engine for: search, named filters, sort, paging. */
export interface ListQuery {
	q?: string;
	/** Field → values; values of one field OR, fields AND. */
	filters?: Record<string, string[]>;
	sort?: string;
	cursor?: string | null;
	limit?: number;
}
