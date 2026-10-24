/**
 * Fleet › **Table** — every agent's numbers over the last 7 days: runs,
 * success, p95 against the 7 days before, tokens a run and the signal. These
 * are Performance's agent rows, read from the same fleet read, so the two
 * pages cannot disagree (the-agents-shell.md › Fleet).
 *
 * Every agent the Agents list holds gets a row; one that ran nothing in the
 * window reads `—`. *Find in the fleet* is the list contract's `?q=`: the
 * engine searches the agents, the browser never narrows a row.
 *
 * A row opens the agent's page as a workbook tab. Every figure is the
 * engine's; this only formats it. Tokens, never currency.
 */

import { type ColumnDef, DataTable } from "@invana/tables";
import { Badge, EmptyState, SearchInput } from "@invana/ui";
import { useListParams } from "@invana-studio/core";
import { useMemo } from "react";
import { chipsOf, FilteredEmpty, ListStrip } from "../lists";
import { useAgentsOpen } from "../open";
import { FleetReadState, pct, tokens } from "../overview/fleetParts";
import { P95Cell } from "./agentCells";
import { type FleetAgentRow, useFleetAgentRows } from "./agentRows";

export function FleetTable({
	username,
	graphSlug,
}: {
	username: string;
	graphSlug: string;
}) {
	const open = useAgentsOpen();
	const list = useListParams();
	const { rows, page, loading, error } = useFleetAgentRows(
		username,
		graphSlug,
		list.query,
	);
	const columns = useMemo(agentColumns, []);
	const chips = chipsOf(page, list);

	return (
		<>
			<div className="flex items-center gap-2">
				<SearchInput
					inputSize="sm"
					className="ml-auto w-64"
					placeholder="Find in the fleet"
					value={list.query.q ?? ""}
					onChange={list.setQ}
				/>
			</div>
			<ListStrip page={page} list={list} />
			{loading || error ? (
				<FleetReadState
					loading={loading}
					error={error}
					what="the fleet's numbers"
				/>
			) : rows.length === 0 ? (
				chips.length ? (
					<FilteredEmpty noun="agent" filters={chips} onClear={list.clear} />
				) : (
					<EmptyState
						title="No agents yet"
						description="Every Graph is seeded with its own agents — try refreshing."
					/>
				)
			) : (
				<DataTable
					columns={columns}
					data={rows}
					enableSorting={false}
					getRowId={(row) => row.agent.id}
					onRowClick={(row) => open.agent(row.agent.id)}
				/>
			)}
		</>
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
			id: "success",
			header: "Success",
			cell: ({ row }) => (
				<span
					className={
						row.original.perf?.signal === "failing"
							? "font-mono text-destructive"
							: "font-mono"
					}
				>
					{pct(row.original.perf?.success)}
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
				<span className="font-mono">
					{tokens(row.original.perf?.tokens_per_run)}
				</span>
			),
		},
		{
			id: "signal",
			header: "Signal",
			cell: ({ row }) => {
				const signal = row.original.perf?.signal;
				return signal ? (
					<Badge
						variant="outline"
						tone={signal === "failing" ? "destructive" : "warning"}
						size="xs"
					>
						{signal}
					</Badge>
				) : (
					<span className="text-muted-foreground">—</span>
				);
			},
		},
	];
}
