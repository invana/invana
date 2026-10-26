/**
 * Workers › Capacity — where steps wait, for how long, and how many workers
 * the engine suggests. Invana never starts machines: a short pool's callout
 * leads to Add workers.
 */

import { type ColumnDef, DataTable } from "@invana/tables";
import { Alert, AlertDescription, AlertTitle } from "@invana/ui";
import { formatGrouped } from "@invana-studio/core";
import { PanelSection } from "@invana-studio/ui";
import { useMemo } from "react";
import { FleetReadState } from "../overview/fleetParts";
import { EventsCard } from "./PoolsTab";
import { AdminButton, DASH, PoolStateChip, span } from "./parts";
import { useCapacityQuery } from "./queries";
import type { CapacityRow } from "./types";

export function CapacityTab({ onAdd }: { onAdd: () => void }) {
	const capacity = useCapacityQuery();
	const columns = useMemo<ColumnDef<CapacityRow>[]>(
		() => [
			{
				id: "pool",
				header: "Pool",
				cell: ({ row }) => (
					<span className="font-medium">{row.original.pool}</span>
				),
			},
			{
				id: "ready",
				header: "Ready steps",
				cell: ({ row }) => (
					<span className="font-mono">{formatGrouped(row.original.ready)}</span>
				),
			},
			{
				id: "oldest",
				header: "Oldest",
				cell: ({ row }) => (
					<span className="font-mono">
						{row.original.oldest_s == null ? DASH : span(row.original.oldest_s)}
					</span>
				),
			},
			{
				id: "workers",
				header: "Workers",
				cell: ({ row }) => (
					<span className="font-mono">{row.original.workers}</span>
				),
			},
			{
				id: "suggested",
				header: "Suggested",
				cell: ({ row }) => (
					<span className="font-mono">{row.original.suggested}</span>
				),
			},
			{
				id: "state",
				header: "",
				cell: ({ row }) => (
					<span className="flex flex-wrap items-center gap-2">
						<PoolStateChip state={row.original.state} />
						{row.original.state === "no_workers" ? (
							<span className="text-muted-foreground">start one</span>
						) : null}
						{row.original.unroutable_label ? (
							<span className="text-muted-foreground">
								unroutable — no pool carries {row.original.unroutable_label}
							</span>
						) : null}
					</span>
				),
			},
		],
		[],
	);

	if (!capacity.data)
		return (
			<FleetReadState
				loading={capacity.isLoading}
				error={capacity.error}
				what="capacity"
			/>
		);

	const short = capacity.data.rows.filter((r) => r.callout);
	return (
		<>
			{short.map((r) => (
				<Alert key={r.pool_id} tone="warning">
					<AlertTitle>{r.pool} is short of workers.</AlertTitle>
					<AlertDescription>
						<span>{r.callout} </span>
						<span>
							Invana never starts machines; add workers where {r.pool} runs.
						</span>
						<span className="mt-2 flex">
							<AdminButton variant="outline" onClick={onAdd}>
								Add workers
							</AdminButton>
						</span>
					</AlertDescription>
				</Alert>
			))}
			<PanelSection
				card
				title="Every pool"
				action={
					<span className="text-sm text-muted-foreground">
						ready steps ÷ slots a worker, over the last 10 min · computed by the
						engine every 30 s
					</span>
				}
			>
				<DataTable
					columns={columns}
					data={capacity.data.rows}
					enableSorting={false}
					getRowId={(row) => row.pool_id}
					emptyState="No pool yet"
				/>
			</PanelSection>
			<EventsCard withActor />
		</>
	);
}
