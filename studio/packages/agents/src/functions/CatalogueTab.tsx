/**
 * Functions › Functions — the catalogue, every function a plan may name, as
 * one table grouped by namespace (`graph.read.*` over its rows, with the
 * bounds its rows spend).
 *
 * The rows are `runtime/catalogue/registry.py` through `GET …/catalogue`,
 * never a second copy of the declaration. The engine searches (key and
 * summary) and filters by bound; the browser only groups what came back,
 * sorted by key so a namespace's rows are contiguous. A row opens the
 * function's page as a tab beside this one. Read-only: nothing here adds,
 * edits or disables an entry — a plugin's state is switched on Plugins.
 */

import {
	BoundChip,
	SearchInput,
	SegmentedControl,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { Fragment } from "react";
import { FilteredEmpty, filterValue, ListStrip, setOne } from "../lists";
import { useAgentsOpen } from "../open";
import { useCatalogueQuery } from "../plans/queries";
import type { CatalogueEntry } from "../plans/types";
import { RowsFailed, RowsLoading, useTabList } from "./shared";

/** The bounds offered as presets of the `bound` filter, in the runtime's order. */
const BOUNDS = [
	"graph_read",
	"graph_write",
	"schema_write",
	"ingest",
	"network",
	"llm",
	"plan_write",
	"work_write",
	"none",
];

const BOUND_OPTIONS = [
	{ value: "all", label: "All bounds" },
	...BOUNDS.map((b) => ({ value: b, label: b })),
];

/** `graph.read.query` → `graph.read`; a one-segment key is its own namespace. */
const namespaceOf = (key: string): string =>
	key.includes(".") ? key.slice(0, key.lastIndexOf(".")) : key;

export function CatalogueTab({
	username,
	graphSlug,
}: {
	username: string;
	graphSlug: string;
}) {
	const open = useAgentsOpen();
	const { list, query, search } = useTabList(["bound"]);
	const catalogue = useCatalogueQuery(username, graphSlug, {
		...query,
		sort: "key",
	});
	const rows = catalogue.data?.items ?? [];

	const groups = new Map<string, CatalogueEntry[]>();
	for (const e of rows) {
		const ns = namespaceOf(e.step_key);
		groups.set(ns, [...(groups.get(ns) ?? []), e]);
	}

	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap items-center gap-2">
				<SearchInput
					inputSize="sm"
					value={search}
					onChange={list.setQ}
					placeholder="Filter by name or summary"
					className="w-72"
				/>
				{/* A preset of the `bound` filter: picking one shows as its chip. */}
				<SegmentedControl
					size="xs"
					options={BOUND_OPTIONS}
					value={filterValue(list, "bound") || "all"}
					onValueChange={(v) => setOne(list, "bound", v === "all" ? "" : v)}
					aria-label="Bound"
				/>
				<span className="ml-auto text-muted-foreground">
					Grouped by namespace
				</span>
			</div>
			<ListStrip page={catalogue.data} list={list} />
			{catalogue.isLoading ? (
				<RowsLoading />
			) : catalogue.isError ? (
				<RowsFailed what="The catalogue" error={catalogue.error} />
			) : rows.length === 0 ? (
				catalogue.data?.applied.length ? (
					<FilteredEmpty
						noun="function"
						filters={catalogue.data.applied}
						onClear={list.clear}
					/>
				) : (
					<p className="p-3 text-muted-foreground">
						This engine's catalogue is empty.
					</p>
				)
			) : (
				<Table density="compact">
					<TableHeader>
						<TableRow>
							<TableHead>Function</TableHead>
							<TableHead className="w-full">What it does</TableHead>
							<TableHead>Bound</TableHead>
							<TableHead>Plugin</TableHead>
							<TableHead className="whitespace-nowrap">Used by</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{[...groups].map(([ns, entries]) => (
							<Fragment key={ns}>
								<TableRow className="bg-muted hover:bg-muted">
									<TableCell colSpan={5}>
										<span className="font-mono font-semibold">{ns}.*</span>
										<span className="ml-2 text-muted-foreground">
											{[...new Set(entries.map((e) => e.bound))].join(" · ")}
										</span>
									</TableCell>
								</TableRow>
								{entries.map((e) => (
									<TableRow
										key={e.step_key}
										className="cursor-pointer"
										onClick={() => open.func(e.step_key)}
									>
										<TableCell className="whitespace-nowrap font-mono">
											{e.step_key}
										</TableCell>
										<TableCell>{e.summary}</TableCell>
										<TableCell>
											<BoundChip bound={e.bound} />
										</TableCell>
										<TableCell className="whitespace-nowrap text-muted-foreground">
											{e.plugin || "—"}
										</TableCell>
										<TableCell className="whitespace-nowrap">
											{/* An unused function is a fact, not an error. */}
											{e.used_by
												? `${e.used_by} plan${e.used_by === 1 ? "" : "s"}`
												: "none"}
										</TableCell>
									</TableRow>
								))}
							</Fragment>
						))}
					</TableBody>
				</Table>
			)}
		</div>
	);
}
