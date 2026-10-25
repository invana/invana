/**
 * The ledger's rows as one table, newest first, with the row drawer
 * (`?row=<id>`). Two hosts draw it:
 *
 * - **Ledger › Rows** — no `runId`: the filters are the URL's (`?f.since` ·
 *   `f.actor` · `f.act` · `f.layer` · `f.run_id` · `f.verdict`, and `?q=`), drawn
 *   above the table with the applied-filters strip and *N of M match*.
 * - **A run's Ledger tab** — `runId`: the rows of that run only, no filter
 *   bar; the run page's own URL filters are left alone.
 *
 * The engine filters, counts and pages; the browser never narrows a row. A
 * member reads the rows of runs they can open and their own acts; the rest is
 * counted (`hidden`) and a banner says how many.
 *
 *     <LedgerRowsTable username={u} graphSlug={g} runId={run.id} />
 */

import {
	Alert,
	AlertDescription,
	Button,
	EmptyState,
	FilterBar,
	SearchInput,
	SegmentedControl,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import {
	type ListQuery,
	listQueryKey,
	useListParams,
} from "@invana-studio/core";
import { useRunsQuery } from "@invana-studio/shell";
import { FilterSelect } from "@invana-studio/ui";
import { ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
	chipsOf,
	FilteredEmpty,
	filterValue,
	ListStrip,
	matchCount,
	setOne,
} from "../lists";
import { FleetReadState } from "../overview/fleetParts";
import { useActorOptions } from "./actors";
import { LedgerRowDrawer } from "./LedgerRowDrawer";
import {
	Act,
	ActorChain,
	LAYER_OPTIONS,
	n,
	rowTime,
	runLabel,
	SINCE_OPTIONS,
	touchedLine,
	VerdictBadge,
} from "./ledgerParts";
import { useLedgerRowsQuery } from "./queries";

/** Rows a page holds; the engine pages on from its cursor. */
const ROWS = 50;

const VERDICTS = [
	{ value: "all", label: "All" },
	{ value: "allowed", label: "Allowed" },
	{ value: "refused", label: "Refused" },
	{ value: "approval", label: "Approval" },
];

/** Act patterns the select offers; the engine matches `*`. */
const ACT_OPTIONS = [
	"graph.read.*",
	"graph.write.*",
	"web.*",
	"nl.*",
	"secret.use",
	"work.spawn_agent",
	"access.*",
	"run.*",
].map((value) => ({ value, label: value }));

export function LedgerRowsTable({
	username,
	graphSlug,
	runId,
}: {
	username: string;
	graphSlug: string;
	/** A run's rows only, with no filter bar. */
	runId?: string;
}) {
	const list = useListParams();
	const [search, setSearch] = useSearchParams();
	const [cursors, setCursors] = useState<string[]>([]);

	const base: ListQuery = runId
		? { filters: { run_id: [runId] } }
		: { q: list.query.q, filters: list.query.filters };
	const baseKey = listQueryKey(base);
	// A new filter starts again from the newest row.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset on the query's key
	useEffect(() => setCursors([]), [baseKey]);

	const query = useLedgerRowsQuery(username, graphSlug, {
		...base,
		limit: ROWS,
		cursor: cursors.at(-1) ?? null,
	});
	const page = query.data;
	const chips = runId ? [] : chipsOf(page, list);

	const rowId = search.get("row");
	const setRow = (id: string | null) =>
		setSearch(
			(prev) => {
				const next = new URLSearchParams(prev);
				if (id) next.set("row", id);
				else next.delete("row");
				return next;
			},
			{ replace: true },
		);

	return (
		<div className="flex flex-col gap-3">
			{page && page.hidden > 0 && (
				<Alert tone="info">
					<ShieldCheck className="size-4" />
					<AlertDescription>
						You see the rows of runs you can open, and your own acts.{" "}
						{n(page.hidden)} row{page.hidden === 1 ? "" : "s"} here belong to
						runs you cannot open — counted, not shown.
					</AlertDescription>
				</Alert>
			)}
			{!runId && (
				<RowFilters username={username} graphSlug={graphSlug} list={list} />
			)}
			{!runId && <ListStrip page={page} list={list} />}

			{query.isLoading ? (
				<FleetReadState loading error={null} what="the ledger" />
			) : query.error ? (
				<FleetReadState loading={false} error={query.error} what="the ledger" />
			) : !page || page.items.length === 0 ? (
				chips.length ? (
					<FilteredEmpty noun="act" filters={chips} onClear={list.clear} />
				) : (
					<EmptyState
						title="No acts yet"
						description={
							runId
								? "This run has written no ledger row yet."
								: "A run or a person's act writes the first row."
						}
					/>
				)
			) : (
				<>
					<div className="rounded-sm border">
						<Table density="compact">
							<TableHeader>
								<TableRow>
									<TableHead>When</TableHead>
									<TableHead>Actor</TableHead>
									<TableHead>Act</TableHead>
									<TableHead>Touched</TableHead>
									<TableHead>Verdict</TableHead>
									{!runId && <TableHead>Run</TableHead>}
									<TableHead>Where</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{page.items.map((row) => (
									<TableRow
										key={row.id}
										className="cursor-pointer"
										data-state={row.id === rowId ? "selected" : undefined}
										aria-selected={row.id === rowId}
										onClick={() => setRow(row.id)}
									>
										<TableCell className="whitespace-nowrap font-mono text-muted-foreground">
											{rowTime(row.at)}
										</TableCell>
										<TableCell>
											<ActorChain chain={row.actor_chain} />
										</TableCell>
										<TableCell>
											<Act act={row.act} />
										</TableCell>
										<TableCell className="text-muted-foreground">
											{touchedLine(row)}
										</TableCell>
										<TableCell>
											<VerdictBadge
												verdict={row.verdict}
												refusedBy={row.refused_by}
											/>
										</TableCell>
										{!runId && (
											<TableCell className="whitespace-nowrap">
												{runLabel(row.run_number, row.run_id)}
											</TableCell>
										)}
										<TableCell className="text-muted-foreground">
											{row.where || "—"}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
					<div className="flex items-center gap-2 text-muted-foreground">
						<span>
							{page.applied.length || runId
								? matchCount(page)
								: `${n(page.total)} rows`}{" "}
							· newest first
						</span>
						<span className="ml-auto flex gap-1">
							<Button
								variant="ghost"
								size="sm"
								disabled={!cursors.length}
								onClick={() => setCursors((c) => c.slice(0, -1))}
							>
								Newer
							</Button>
							<Button
								variant="ghost"
								size="sm"
								disabled={!page.next_cursor}
								onClick={() =>
									page.next_cursor &&
									setCursors((c) => [...c, page.next_cursor as string])
								}
							>
								Older
							</Button>
						</span>
					</div>
				</>
			)}

			<LedgerRowDrawer
				username={username}
				graphSlug={graphSlug}
				rowId={rowId}
				onRow={setRow}
			/>
		</div>
	);
}

/** Since · actor · act · touched · run, a search, and the verdict. */
function RowFilters({
	username,
	graphSlug,
	list,
}: {
	username: string;
	graphSlug: string;
	list: ReturnType<typeof useListParams>;
}) {
	const [search] = useSearchParams();
	const actorOptions = useActorOptions(username, graphSlug);
	const runs = useRunsQuery(username, graphSlug, { limit: 50 });
	const runOptions = useMemo(
		() =>
			(runs.data?.items ?? []).map((r) => ({
				value: r.id,
				label: r.task_title ?? r.id.slice(0, 8),
			})),
		[runs.data],
	);
	const verdict = filterValue(list, "verdict");

	return (
		<div className="flex flex-wrap items-center gap-2">
			<FilterBar>
				<FilterSelect
					label="since"
					value={filterValue(list, "since")}
					options={SINCE_OPTIONS}
					onChange={(v) => setOne(list, "since", v)}
				/>
				<FilterSelect
					label="actor"
					value={filterValue(list, "actor")}
					options={actorOptions}
					onChange={(v) => setOne(list, "actor", v)}
				/>
				<FilterSelect
					label="act"
					value={filterValue(list, "act")}
					options={ACT_OPTIONS}
					onChange={(v) => setOne(list, "act", v)}
				/>
				<FilterSelect
					label="touched"
					value={filterValue(list, "layer")}
					options={LAYER_OPTIONS}
					onChange={(v) => setOne(list, "layer", v)}
				/>
				<FilterSelect
					label="run"
					value={filterValue(list, "run_id")}
					options={runOptions}
					onChange={(v) => setOne(list, "run_id", v)}
				/>
			</FilterBar>
			<SegmentedControl
				size="sm"
				aria-label="Verdict"
				value={verdict || "all"}
				onValueChange={(v) => setOne(list, "verdict", v === "all" ? "" : v)}
				options={VERDICTS}
			/>
			<SearchInput
				inputSize="sm"
				className="w-56"
				placeholder="Find an act or a record"
				value={search.get("q") ?? ""}
				onChange={list.setQ}
			/>
		</div>
	);
}
