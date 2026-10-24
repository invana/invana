/**
 * The list contract's two query strings, and the one translation between them.
 *
 * Studio's address bar carries a list's filters as `?q=` and `?f.<field>=`, so
 * a list's own page params (`?tab=`, `?right=`) never collide with a filter.
 * The engine reads plain field names (`?status=`). A link, a reload, ⌘K or the
 * assistant all land on the same URL, and so on the same rows.
 */

import type { ListQuery } from "../types/list";

/** The prefix a filter carries in Studio's URL. */
export const FILTER_PREFIX = "f.";
/** Marks filters the assistant set, until a person changes one. */
export const VIA_PARAM = "via";

/** The list query a Studio URL holds. */
export function listQueryFromSearch(search: URLSearchParams): ListQuery {
	const filters: Record<string, string[]> = {};
	for (const [key, value] of search) {
		if (!key.startsWith(FILTER_PREFIX) || value === "") continue;
		const field = key.slice(FILTER_PREFIX.length);
		filters[field] = [...(filters[field] ?? []), value];
	}
	const q = search.get("q")?.trim();
	return { q: q || undefined, filters, sort: search.get("sort") ?? undefined };
}

/** The engine's query string for a list query — plain field names. */
export function listQueryToApi(query: ListQuery): string {
	const params = new URLSearchParams();
	if (query.q) params.set("q", query.q);
	for (const [field, values] of Object.entries(query.filters ?? {})) {
		for (const value of values) params.append(field, value);
	}
	if (query.sort) params.set("sort", query.sort);
	if (query.cursor) params.set("cursor", query.cursor);
	if (query.limit) params.set("limit", String(query.limit));
	const out = params.toString();
	return out ? `?${out}` : "";
}

/** A stable key for a list query, for a TanStack Query key. */
export function listQueryKey(query: ListQuery): string {
	return listQueryToApi({ ...query, cursor: undefined });
}
