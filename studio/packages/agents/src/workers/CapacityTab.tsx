/**
 * Workers › Capacity — where steps wait, for how long, and how many workers
 * the engine suggests. Invana never starts machines: a short pool's callout
 * leads to Add workers.
 */

import { type ColumnDef, DataTable } from "@invana/tables";
import { Alert, AlertDescription, PropertyList, PropertyRow } from "@invana/ui";
import { formatGrouped } from "@invana-studio/core";
import { PanelSection } from "@invana-studio/ui";
import { Plus } from "lucide-react";
import { useMemo } from "react";
import { FleetReadState } from "../overview/fleetParts";
import { EventsCard } from "./PoolsTab";
import { AdminButton, DASH, span } from "./parts";
import { useCapacityQuery } from "./queries";
import type { CapacityRow } from "./types";

/** `keeping up` · `short — 16 clear it in ~10 min` · `no workers — start one`. */
function stateLine(r: CapacityRow): string {
	if (r.unroutable_label)
		return `unroutable — no pool carries ${r.unroutable_label}`;
	if (r.state === "short") return `short — ${r.suggested} clear it in ~10 min`;
	if (r.state === "no_workers") return "no workers — start one";
	if (r.state === "keeping_up") return "keeping up";
	return DASH;
}

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
				cell: ({ row }) => formatGrouped(row.original.ready),
			},
			{
				id: "oldest",
				header: "Oldest",
				cell: ({ row }) =>
					row.original.oldest_s == null ? DASH : span(row.original.oldest_s),
			},
			{
				id: "workers",
				header: "Workers",
				cell: ({ row }) => row.original.workers,
			},
			{
				id: "suggested",
				header: "Suggested",
				cell: ({ row }) => row.original.suggested,
			},
			{
				id: "state",
				header: "",
				cell: ({ row }) => (
					<span className="text-muted-foreground">
						{stateLine(row.original)}
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

	const short = capacity.data.rows.filter((r) => r.state === "short");
	const first = short[0];
	return (
		<>
			{short.map((r) => (
				<Alert
					key={r.pool_id}
					tone="warning"
					className="flex items-center gap-3"
				>
					<AlertDescription className="flex-1">
						<span className="font-semibold text-foreground">
							{r.pool} is short of workers.
						</span>{" "}
						{formatGrouped(r.ready)} steps wait, the oldest for{" "}
						{span(r.oldest_s)}. Invana never starts machines; add workers where{" "}
						{r.pool} runs.
					</AlertDescription>
					<AdminButton variant="outline" onClick={onAdd}>
						<Plus />
						Add workers
					</AdminButton>
				</Alert>
			))}
			{first ? (
				<PanelSection card title={`Suggested for ${first.pool}`}>
					<PropertyList labelWidth={150}>
						<PropertyRow label="Now">{first.workers} workers</PropertyRow>
						<PropertyRow label="To clear in 10 min">
							{first.suggested} workers
						</PropertyRow>
						<PropertyRow label="How">
							ready steps ÷ slots a worker, over the last 10 min
						</PropertyRow>
						<PropertyRow label="Computed">
							by the engine, every 30 s
						</PropertyRow>
					</PropertyList>
				</PanelSection>
			) : null}
			<PanelSection card title="Every pool">
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
