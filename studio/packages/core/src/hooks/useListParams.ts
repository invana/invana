/**
 * A list's search and filters, read from and written to the URL.
 *
 * Every search box, select and segmented control over a list writes here; the
 * list's query hook sends `query` to the engine, which decides what the list
 * leaves out. Nothing narrows rows in the browser.
 *
 *     const list = useListParams();
 *     const agents = useAgentsQuery(owner, graph, list.query);
 *     <SearchInput value={list.query.q ?? ""} onChange={list.setQ} />
 *     <AppliedFilters filters={agents.data?.applied ?? list.pending} onRemove={list.remove}
 *         onClearAll={list.clear} setBy={list.viaAssistant ? "the assistant" : undefined} />
 */

import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
	FILTER_PREFIX,
	listQueryFromSearch,
	VIA_PARAM,
} from "../lib/listQuery";
import type { AppliedFilter, ListQuery } from "../types/list";
import { useUpdateSearchParams } from "./useUpdateSearchParams";

export interface ListUrl {
	/** What to send the engine. */
	query: ListQuery;
	/** The URL's filters as chips, before the engine's `applied` arrives. */
	pending: AppliedFilter[];
	/** The assistant set these filters and no person has changed one since. */
	viaAssistant: boolean;
	setQ: (q: string) => void;
	/** Replace one filter's values; an empty list removes it. */
	setFilter: (field: string, values: string[]) => void;
	/** Remove one chip — a value of a filter, or the search when `field` is `q`. */
	remove: (field: string, value: string) => void;
	clear: () => void;
}

export function useListParams(): ListUrl {
	const [search] = useSearchParams();
	const update = useUpdateSearchParams();

	return useMemo(() => {
		const query = listQueryFromSearch(search);
		const pending: AppliedFilter[] = [
			...(query.q
				? [{ field: "q", title: "search", value: query.q, label: query.q }]
				: []),
			...Object.entries(query.filters ?? {}).flatMap(([field, values]) =>
				values.map((value) => ({
					field,
					title: field.replaceAll("_", " "),
					value,
					label: value,
				})),
			),
		];
		// A person's change drops the assistant's mark.
		const edit = (fn: (next: URLSearchParams) => void) =>
			update((prev) => {
				const next = new URLSearchParams(prev);
				fn(next);
				next.delete(VIA_PARAM);
				next.delete("cursor");
				return next;
			});
		return {
			query,
			pending,
			viaAssistant: search.get(VIA_PARAM) === "assistant",
			setQ: (q) =>
				edit((next) => {
					if (q.trim()) next.set("q", q);
					else next.delete("q");
				}),
			setFilter: (field, values) =>
				edit((next) => {
					next.delete(FILTER_PREFIX + field);
					for (const v of values) next.append(FILTER_PREFIX + field, v);
				}),
			remove: (field, value) =>
				edit((next) => {
					if (field === "q") {
						next.delete("q");
						return;
					}
					const key = FILTER_PREFIX + field;
					const kept = next.getAll(key).filter((v) => v !== value);
					next.delete(key);
					for (const v of kept) next.append(key, v);
				}),
			clear: () =>
				edit((next) => {
					next.delete("q");
					for (const key of [...next.keys()]) {
						if (key.startsWith(FILTER_PREFIX)) next.delete(key);
					}
				}),
		};
	}, [search, update]);
}
