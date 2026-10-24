/**
 * Fleet › Overview's **Agents** card — every agent at a glance: runs and
 * served over 7 days, p95 a run, how it stands against the 7 days before, the
 * month's tokens against its budget, and its status.
 *
 * The rows are {@link useFleetAgentRows}: every agent the list holds, one
 * that ran nothing reading `—`. A row opens the agent's page as a workbook
 * tab. Every figure is the engine's. Tokens, never currency.
 */

import { type ColumnDef, DataTable } from "@invana/tables";
import { PanelSection } from "@invana-studio/ui";
import { useMemo } from "react";
import { useAgentsOpen } from "../open";
import { FleetReadState, ms, pct } from "../overview/fleetParts";
import { AgainstCell, BudgetCell, StatusCell } from "./agentCells";
import type { FleetAgentRow } from "./agentRows";

export function FleetAgentsCard({
	rows,
	loading,
	error,
}: {
	rows: FleetAgentRow[];
	loading: boolean;
	error: Error | null;
}) {
	const open = useAgentsOpen();
	const columns = useMemo(agentColumns, []);
	return (
		<PanelSection card title="Agents">
			{loading || error ? (
				<FleetReadState loading={loading} error={error} what="the agents" />
			) : (
				<DataTable
					columns={columns}
					data={rows}
					enableSorting={false}
					getRowId={(row) => row.agent.id}
					onRowClick={(row) => open.agent(row.agent.id)}
					emptyState="No agents yet"
				/>
			)}
		</PanelSection>
	);
}

function agentColumns(): ColumnDef<FleetAgentRow>[] {
	return [
		{
			id: "agent",
			header: "Agent",
			cell: ({ row }) => (
				<span className="font-medium">{row.original.agent.name}</span>
			),
		},
		{
			id: "runs",
			header: "Runs · 7 days",
			cell: ({ row }) => (
				<span className="font-mono">{row.original.perf?.runs ?? "—"}</span>
			),
		},
		{
			id: "served",
			header: "Served",
			cell: ({ row }) => (
				<span className="font-mono">{pct(row.original.perf?.success)}</span>
			),
		},
		{
			id: "p95",
			header: "p95 a run",
			cell: ({ row }) => (
				<span className="font-mono">{ms(row.original.perf?.p95_ms)}</span>
			),
		},
		{
			id: "against",
			header: "Against last week",
			cell: ({ row }) => <AgainstCell row={row.original} />,
		},
		{
			id: "budget",
			header: "Month budget",
			cell: ({ row }) => <BudgetCell row={row.original} />,
		},
		{
			id: "now",
			header: "Now",
			cell: ({ row }) => <StatusCell row={row.original} />,
		},
	];
}
