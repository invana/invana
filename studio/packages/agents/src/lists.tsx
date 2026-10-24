/**
 * What every list in this package shares: the engine searches, filters, sorts
 * and counts it, the URL carries its filters, and the browser never narrows a
 * row (list-contract.md).
 *
 * - {@link EVERY} — the query of a caller that resolves ids or picks one record
 *   rather than showing a list: the most a page holds.
 * - {@link ListStrip} · {@link FilteredEmpty} · {@link matchCount} — the
 *   applied-filters strip, the empty state that names them, and the count.
 */

import { AppliedFilters, Button, EmptyState } from "@invana/ui";
import type {
	AppliedFilter,
	ListQuery,
	ListUrl,
	Page,
} from "@invana-studio/core";

/** Everything a Graph has today, in one page. */
export const EVERY: ListQuery = { limit: 200 };

/** A list that shows its rows asks for a full page and pages on from there. */
export const PAGE = 200;

/** The first value of one URL filter — what a single-value select shows. */
export function filterValue(list: ListUrl, field: string): string {
	return list.query.filters?.[field]?.[0] ?? "";
}

/** A single-value select's change: one value, or none to drop the filter. */
export function setOne(list: ListUrl, field: string, value: string): void {
	list.setFilter(field, value ? [value] : []);
}

/** The chips a list is filtered by — the engine's once it answers, the URL's until then. */
export function chipsOf(
	page: Page<unknown> | undefined,
	list: ListUrl,
): AppliedFilter[] {
	return page?.applied ?? list.pending;
}

/** `2 of 7 match` while something is applied, else the total. */
export function matchCount(
	page: Page<unknown> | undefined,
	noun?: string,
): string | undefined {
	if (!page) return undefined;
	if (page.applied.length)
		return `${page.total} of ${page.unfiltered_total} match`;
	return noun ? `${page.total} ${noun}` : String(page.total);
}

/** The applied-filters strip above a list's rows. Draws nothing when nothing is applied. */
export function ListStrip({
	page,
	list,
}: {
	page: Page<unknown> | undefined;
	list: ListUrl;
}) {
	return (
		<AppliedFilters
			className="shrink-0 border-b px-3 py-1.5"
			filters={chipsOf(page, list)}
			onRemove={list.remove}
			onClearAll={list.clear}
			setBy={list.viaAssistant ? "the assistant" : undefined}
		/>
	);
}

/** No row matches: say which filters, and offer the way back to every row. */
export function FilteredEmpty({
	noun,
	filters,
	onClear,
}: {
	/** What the list holds, singular — `agent`. */
	noun: string;
	filters: AppliedFilter[];
	onClear: () => void;
}) {
	const words = filters.map((f) => `${f.title} ${f.label}`).join(" · ");
	return (
		<EmptyState
			className="px-3 py-4"
			title={`No ${noun} matches ${words}`}
			description="Remove a filter above, or clear them all."
			actions={
				<Button size="sm" variant="outline" onClick={onClear}>
					Clear all
				</Button>
			}
		/>
	);
}
