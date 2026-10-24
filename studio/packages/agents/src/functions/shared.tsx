/**
 * What the Functions tabs share: one address bar holds the page's search and
 * filters, and each tab sends the engine only the fields its own list takes —
 * a bound filter set on Functions never reaches the plugin registry. The
 * search box shows the address bar's own text, untrimmed, so a space typed
 * between two words survives.
 */

import { EmptyState, Spinner } from "@invana/ui";
import {
	type ListQuery,
	type ListUrl,
	useListParams,
} from "@invana-studio/core";
import { useSearchParams } from "react-router-dom";
import { PAGE } from "../lists";

/** Namespaces two segments deep: `graph.read` · `graph.stitch` · `mcp.<server>`. */
const TWO_SEGMENT = new Set(["graph", "mcp"]);

/**
 * The library namespace a function belongs to — `graph.read.query` →
 * `graph.read`, `mcp.figma.get_design_context` → `mcp.figma`,
 * `data.bundle.check` → `data`, `science.pubmed.search` → `science`.
 * The catalogue groups by it and Fleet › Map draws one node per namespace.
 */
export function namespaceOf(key: string): string {
	const parts = key.split(".");
	return TWO_SEGMENT.has(parts[0]) && parts.length > 2
		? `${parts[0]}.${parts[1]}`
		: parts[0];
}

/** The URL's list, the query a tab sends, and the search box's raw text. */
export function useTabList(fields: readonly string[]): {
	list: ListUrl;
	query: ListQuery;
	search: string;
} {
	const list = useListParams();
	const [params] = useSearchParams();
	const filters = Object.fromEntries(
		Object.entries(list.query.filters ?? {}).filter(([f]) =>
			fields.includes(f),
		),
	);
	return {
		list,
		query: { q: list.query.q, filters, limit: PAGE },
		search: params.get("q") ?? "",
	};
}

/** The kit's spinner where the rows will be. */
export function RowsLoading() {
	return (
		<div className="flex justify-center p-6">
			<Spinner />
		</div>
	);
}

/** What could not be read, in the engine's words. */
export function RowsFailed({ what, error }: { what: string; error: unknown }) {
	return (
		<EmptyState
			title={`${what} did not load`}
			description={
				error instanceof Error ? error.message : "The engine did not answer."
			}
		/>
	);
}
