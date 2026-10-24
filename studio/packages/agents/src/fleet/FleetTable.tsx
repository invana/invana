/**
 * Fleet › **Table** — every agent's numbers over the last 7 days: runs,
 * success, p95 against the 7 days before, tokens a run and the signal. These
 * are Performance's agent rows, read from the same fleet read, so the two
 * pages cannot disagree (the-agents-shell.md › Fleet).
 *
 * A row opens the agent's page as a workbook tab. Every figure is the
 * engine's; this only formats it. Tokens, never currency.
 */

import { type ColumnDef, DataTable } from "@invana/tables";
import { Badge } from "@invana/ui";
import { useMemo } from "react";
import { useAgentsOpen } from "../open";
import {
	changeText,
	changeTone,
	FleetReadState,
	ms,
	pct,
	TONE_TEXT,
	tokens,
} from "../overview/fleetParts";
import { useFleetPerformanceQuery } from "./queries";
import type { PerformanceRow } from "./types";

export function FleetTable({
	username,
	graphSlug,
}: {
	username: string;
	graphSlug: string;
}) {
	const open = useAgentsOpen();
	const query = useFleetPerformanceQuery(username, graphSlug, "7d");
	const columns = useMemo(agentColumns, []);

	if (!query.data)
		return (
			<FleetReadState
				loading={query.isLoading}
				error={query.error}
				what="the fleet's numbers"
			/>
		);

	return (
		<DataTable
			columns={columns}
			data={query.data.agents}
			enableSorting={false}
			getRowId={(row) => row.id}
			onRowClick={(row) => open.agent(row.id)}
			emptyState="Nothing ran in the last 7 days"
		/>
	);
}

function agentColumns(): ColumnDef<PerformanceRow>[] {
	return [
		{ accessorKey: "name", header: "Agent" },
		{
			accessorKey: "runs",
			header: "Runs · 7 days",
			cell: ({ row }) => <span className="font-mono">{row.original.runs}</span>,
		},
		{
			id: "success",
			header: "Success",
			cell: ({ row }) => (
				<span
					className={
						row.original.signal === "failing"
							? "font-mono text-destructive"
							: "font-mono"
					}
				>
					{pct(row.original.success)}
				</span>
			),
		},
		{
			id: "p95",
			header: "p95 a run",
			cell: ({ row }) => <P95Cell row={row.original} />,
		},
		{
			id: "tokens",
			header: "Tokens / run",
			cell: ({ row }) => (
				<span className="font-mono">{tokens(row.original.tokens_per_run)}</span>
			),
		},
		{
			id: "signal",
			header: "Signal",
			cell: ({ row }) =>
				row.original.signal ? (
					<Badge
						variant="outline"
						tone={row.original.signal === "failing" ? "destructive" : "warning"}
						size="xs"
					>
						{row.original.signal}
					</Badge>
				) : (
					<span className="text-muted-foreground">—</span>
				),
		},
	];
}

/** `48 s ▲ 38%` — p95 and its change against the 7 days before. */
function P95Cell({ row }: { row: PerformanceRow }) {
	const change = row.p95_change;
	return (
		<span className="font-mono">
			{ms(row.p95_ms)}
			{change ? (
				<span className={TONE_TEXT[changeTone(change)]}>
					{" "}
					{changeText(change, ["▲", "▼"])}
				</span>
			) : null}
		</span>
	);
}
