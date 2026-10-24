/**
 * Fleet › **Table** — the fleet's numbers over the last 7 days, read two ways
 * by the *Agents · Skills* switch (`?view=`). Both are Performance's rows, read
 * from the same fleet read, so the two pages cannot disagree
 * (the-agents-shell.md › Fleet).
 *
 * - **Agents** — every agent the Agents list holds gets a row; one that ran
 *   nothing in the window reads `—`. *Find in the fleet* is the list
 *   contract's `?q=`: the engine searches the agents, the browser never
 *   narrows a row.
 * - **Skills** — Performance's skill rows: every skill that ran in the window,
 *   its p95 against its previous version.
 *
 * A row opens its agent's or skill's page as a workbook tab. Every figure is
 * the engine's; this only formats it. Tokens, never currency.
 */

import { type ColumnDef, DataTable } from "@invana/tables";
import { Badge, EmptyState, SearchInput, SegmentedControl } from "@invana/ui";
import { useListParams, useUpdateSearchParams } from "@invana-studio/core";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { chipsOf, FilteredEmpty, ListStrip } from "../lists";
import { useAgentsOpen } from "../open";
import { FleetReadState, pct, tokens } from "../overview/fleetParts";
import { P95Cell } from "./agentCells";
import { type FleetAgentRow, useFleetAgentRows } from "./agentRows";
import { useFleetPerformanceQuery } from "./queries";
import type { FleetOverview, PerformanceRow } from "./types";

type View = "agents" | "skills";

const VIEW_PARAM = "view";

export function FleetTable({
	username,
	graphSlug,
	overview,
}: {
	username: string;
	graphSlug: string;
	/** The fleet's counts for the switch; undefined while it is read. */
	overview: FleetOverview | undefined;
}) {
	const [search] = useSearchParams();
	const update = useUpdateSearchParams();
	const view: View = search.get(VIEW_PARAM) === "skills" ? "skills" : "agents";
	const setView = (next: string) =>
		update((params) => {
			if (next === "skills") params.set(VIEW_PARAM, next);
			else params.delete(VIEW_PARAM);
			return params;
		});
	const list = useListParams();
	const count = (n: number | undefined) => (n == null ? "" : ` ${n}`);

	return (
		<>
			<div className="flex flex-wrap items-center gap-2">
				<SegmentedControl
					size="sm"
					aria-label="Rows"
					value={view}
					onValueChange={setView}
					options={[
						{ value: "agents", label: `Agents${count(overview?.agents)}` },
						{ value: "skills", label: `Skills${count(overview?.skills)}` },
					]}
				/>
				{/* The agents' `?q=`; the skill rows are not searched. */}
				{view === "agents" ? (
					<SearchInput
						inputSize="sm"
						className="w-64"
						placeholder="Find in the fleet"
						value={list.query.q ?? ""}
						onChange={list.setQ}
					/>
				) : null}
			</div>
			{view === "skills" ? (
				<SkillRows username={username} graphSlug={graphSlug} />
			) : (
				<AgentRows username={username} graphSlug={graphSlug} />
			)}
		</>
	);
}

function AgentRows({
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

function SkillRows({
	username,
	graphSlug,
}: {
	username: string;
	graphSlug: string;
}) {
	const open = useAgentsOpen();
	const perf = useFleetPerformanceQuery(username, graphSlug, "7d");
	const columns = useMemo(skillColumns, []);

	if (perf.isLoading || perf.error)
		return (
			<FleetReadState
				loading={perf.isLoading}
				error={perf.error}
				what="the skills' numbers"
			/>
		);
	return (
		<DataTable
			columns={columns}
			data={perf.data?.skills ?? []}
			enableSorting={false}
			getRowId={(row) => row.id}
			onRowClick={(row) => open.skill(row.id)}
			emptyState="No skill ran in the last 7 days"
		/>
	);
}

/** A row's signal, or `—` when it has none. */
function SignalCell({ perf }: { perf: PerformanceRow | null }) {
	const signal = perf?.signal;
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
}

/** Success, in the destructive tone when the row is failing. */
function SuccessCell({ perf }: { perf: PerformanceRow | null }) {
	return (
		<span
			className={
				perf?.signal === "failing" ? "font-mono text-destructive" : "font-mono"
			}
		>
			{pct(perf?.success)}
		</span>
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
			cell: ({ row }) => <SuccessCell perf={row.original.perf} />,
		},
		{
			id: "p95",
			header: "p95 a run",
			cell: ({ row }) => <P95Cell perf={row.original.perf} />,
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
			cell: ({ row }) => <SignalCell perf={row.original.perf} />,
		},
	];
}

function skillColumns(): ColumnDef<PerformanceRow>[] {
	return [
		{
			id: "skill",
			header: "Skill",
			cell: ({ row }) => (
				<span className="font-medium">{row.original.name}</span>
			),
		},
		{
			id: "version",
			header: "Version",
			cell: ({ row }) => (
				<span className="font-mono">
					{row.original.version ? `v${row.original.version}` : "—"}
				</span>
			),
		},
		{
			id: "runs",
			header: "Runs · 7 days",
			cell: ({ row }) => <span className="font-mono">{row.original.runs}</span>,
		},
		{
			id: "success",
			header: "Success",
			cell: ({ row }) => <SuccessCell perf={row.original} />,
		},
		{
			id: "p95",
			header: "p95 a run",
			cell: ({ row }) => <P95Cell perf={row.original} />,
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
			cell: ({ row }) => <SignalCell perf={row.original} />,
		},
	];
}
