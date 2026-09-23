/**
 * A5 · the pools, busy or quiet — and what is waiting behind the ceiling.
 *
 * *As the person who set this Graph's ceiling, I want to see which pool is
 * full and who is queued behind it, so that "why is nothing moving?" has an
 * answer on the screen where the number is set.*
 *
 * **A pool that appeared only once it was busy would make *is this Graph
 * stalled on connections?* a question nobody could answer in the quiet case**
 * ([CC8](../../../../../docs/for-developers/modules/agents/features/concurrency-and-contention.md)).
 * So every configured pool lists, `in_use: 0` included, and the table is the
 * same shape whether anything is in flight or not.
 *
 * **The run ceiling and the pools are different bounds.** The ceiling says how
 * many runs may proceed; a pool says how many crossings of one kind may be in
 * flight — a Graph with two runs going and `graphdb` full is stalled, and the
 * running count alone says it is fine.
 *
 * **A queued run names why it is waiting**, and *a person is waiting* is the
 * one reason that changes what anybody does about it: a person's question is
 * served before a scheduled run (CC3).
 */

import type { GraphContention } from "@/types/graphs";
import { type ColumnDef, DataTable } from "@invana/tables";
import { useMemo } from "react";

type Pool = GraphContention["pools"][number];
type Queued = GraphContention["queued"][number];

export interface PoolsTableProps {
	contention: GraphContention;
}

export function PoolsTable({ contention }: PoolsTableProps) {
	const columns = useMemo<ColumnDef<Pool>[]>(
		() => [
			{
				accessorKey: "pool",
				header: "Pool",
				enableSorting: false,
				cell: ({ row }) => (
					<span className="font-mono">{row.original.pool}</span>
				),
			},
			{
				id: "in_use",
				header: "In use",
				enableSorting: false,
				cell: ({ row }) => {
					const full = row.original.in_use >= row.original.size;
					return (
						<span className={full ? "text-warning" : undefined}>
							{row.original.in_use} of {row.original.size}
							{full ? " · full" : ""}
						</span>
					);
				},
			},
		],
		[],
	);

	return (
		<div className="space-y-2">
			{contention.pools.length ? (
				<DataTable
					columns={columns}
					data={contention.pools}
					enableSorting={false}
					enablePagination={false}
					// Two columns, both of which the reader needs: no column chooser.
					enableColumnVisibility={false}
				/>
			) : (
				// A sentence, never an empty table: no pool configured means every
				// crossing is unbounded, which is a state and not an absence.
				<p className="text-sm text-muted-foreground">
					No pool is configured, so nothing bounds how many crossings are in
					flight — only the run ceiling above.
				</p>
			)}

			{contention.queued.length ? (
				<ul className="space-y-0.5">
					{contention.queued.map((run) => (
						<li key={run.run_id} className="text-sm">
							<span className="text-warning">#{run.position} queued</span>
							<span className="text-muted-foreground">
								{" "}
								· {waitingBecause(run)}
							</span>
						</li>
					))}
				</ul>
			) : null}
		</div>
	);
}

/** Why this run is waiting, in the words that decide what to do about it. */
function waitingBecause(run: Queued): string {
	return run.triggered_by === "user" || run.triggered_by === "person"
		? "a person is waiting"
		: `triggered by ${run.triggered_by}`;
}
