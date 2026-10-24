/**
 * The pools, busy or quiet.
 *
 * *As the person who set this Graph's ceiling, I want to see which pool is
 * full, so that "why is nothing moving?" has an answer on the screen where the
 * number is set.*
 *
 * **A pool that appeared only once it was busy would make *is this Graph
 * stalled on connections?* a question nobody could answer in the quiet case**
 * ([concurrency-and-contention.md](../../../../../docs/for-developers/modules/agents/features/concurrency-and-contention.md)).
 * So every configured pool lists, `in_use: 0` included, and the table is the
 * same shape whether anything is in flight or not.
 *
 * **The run ceiling and the pools are different bounds.** The ceiling says how
 * many runs may proceed; a pool says how many crossings of one kind may be in
 * flight — a Graph with two runs going and `graphdb` full is stalled, and the
 * running count alone says it is fine.
 */

import { type ColumnDef, DataTable } from "@invana/tables";
import type { GraphContention } from "@invana-studio/core";
import { useMemo } from "react";

type Pool = GraphContention["pools"][number];

export interface PoolsTableProps {
	pools: Pool[];
}

export function PoolsTable({ pools }: PoolsTableProps) {
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

	return pools.length ? (
		<DataTable
			columns={columns}
			data={pools}
			enableSorting={false}
			// Two columns, both of which the reader needs: no column chooser.
		/>
	) : (
		// A sentence, never an empty table: no pool configured means every
		// crossing is unbounded, which is a state and not an absence.
		<p className="text-muted-foreground">
			No pool is configured, so nothing bounds how many crossings are in flight
			— only the run ceiling above.
		</p>
	);
}
