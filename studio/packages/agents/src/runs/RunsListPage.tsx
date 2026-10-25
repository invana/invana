/**
 * **Runs** — every root run in the Graph, newest first, at `/agents/runs`
 * (the-run-page.md › One runs list).
 *
 * *As a reviewer or an operator, I want every run in one list, so that I know
 * where each stands and can open any of it.*
 *
 * The list is on the list contract (list-contract.md): `All · Live · Waiting ·
 * Ended` and the Agent, Started by and From selects write the URL
 * (`?f.state=` · `?f.agent_id=` · `?f.started_by=` · `?f.origin=`), the engine
 * filters and counts, and the applied-filters strip names what is applied —
 * *set by the assistant* when it set them. The browser never narrows a row.
 *
 * - **The tiles are the engine's 24-hour stats.** Live and Waiting on you stand
 *   now; Served, Not served and Tokens are over the last day.
 * - **A row's status is its exit reason once it ended**, `running` while it
 *   runs and `waiting` while it is held on a person.
 * - **Size is how many agents the run used**, counted by the engine.
 *
 * A row opens the run's page as a workbook tab beside this one.
 */

import { type ColumnDef, DataTable } from "@invana/tables";
import {
	Badge,
	EmptyState,
	FilterBar,
	MetricGrid,
	MetricTile,
	SegmentedControl,
	Spinner,
	StatusDot,
	TypographyInlineCode,
} from "@invana/ui";
import {
	formatElapsed,
	formatGrouped,
	type RunStats,
	type TaskRunSummary,
	useListParams,
	useMembersQuery,
} from "@invana-studio/core";
import { FilterSelect } from "@invana-studio/ui";
import { useMemo } from "react";
import { RUN_FROM } from "../agents/agentParts";
import { useAgentsQuery } from "../agents/queries";
import {
	chipsOf,
	EVERY,
	FilteredEmpty,
	filterValue,
	ListStrip,
	matchCount,
	PAGE,
	setOne,
} from "../lists";
import { useAgentsOpen } from "../open";
import { FleetReadState, tokens } from "../overview/fleetParts";
import { SectionBody, SectionPage } from "../sections/SectionPage";
import type { SectionPageProps } from "../sections/spec";
import { useRunsPageQuery, useRunsTilesQuery } from "./queries";
import { agentsWord, runNumber, statusTone, statusWord } from "./runParts";

const SHOWING = [
	{ value: "all", label: "All" },
	{ value: "live", label: "Live" },
	{ value: "waiting", label: "Waiting" },
	{ value: "ended", label: "Ended" },
];

/** What *From* filters on: where a run came from, in the engine's words. */
const ORIGIN_OPTIONS = RUN_FROM.map((value) => ({ value, label: value }));

export function RunsListPage({ username, graphSlug }: SectionPageProps) {
	const open = useAgentsOpen();
	const list = useListParams();
	const query = useRunsPageQuery(username, graphSlug, {
		...list.query,
		limit: PAGE,
	});
	const stats = useRunsTilesQuery(username, graphSlug);
	const agents = useAgentsQuery(username, graphSlug, EVERY);
	const members = useMembersQuery({ username, graphSlug });
	const columns = useMemo(runColumns, []);

	const page = query.data;
	const chips = chipsOf(page, list);
	const state = filterValue(list, "state");
	const rows = page?.items ?? [];
	// The list the assistant opened reads as its answer: the strip and the rows.
	const byAssistant = list.viaAssistant && chips.length > 0;

	const agentOptions = useMemo(
		() =>
			(agents.data?.items ?? []).map((a) => ({ value: a.id, label: a.name })),
		[agents.data],
	);
	const memberOptions = useMemo(
		() =>
			(members.data?.items ?? []).map((m) => ({
				value: m.user_id,
				label: m.username,
			})),
		[members.data],
	);

	return (
		<SectionPage
			section="runs"
			chips={
				page ? (
					<Badge variant="outline" tone="muted" size="xs">
						{byAssistant
							? `${page.total} of ${page.unfiltered_total} runs match`
							: matchCount(page, "runs")}
					</Badge>
				) : null
			}
		>
			<SectionBody>
				{!byAssistant && stats.data ? <Tiles stats={stats.data} /> : null}
				{byAssistant ? null : (
					<div className="flex flex-wrap items-center gap-2">
						<SegmentedControl
							size="sm"
							aria-label="Showing"
							value={state || "all"}
							onValueChange={(v) => setOne(list, "state", v === "all" ? "" : v)}
							options={SHOWING}
						/>
						<FilterBar>
							<FilterSelect
								label="agent"
								any="any"
								value={filterValue(list, "agent_id")}
								options={agentOptions}
								onChange={(v) => setOne(list, "agent_id", v)}
							/>
							<FilterSelect
								label="started by"
								any="anyone"
								value={filterValue(list, "started_by")}
								options={memberOptions}
								onChange={(v) => setOne(list, "started_by", v)}
							/>
							<FilterSelect
								label="from"
								any="anywhere"
								value={filterValue(list, "origin")}
								options={ORIGIN_OPTIONS}
								onChange={(v) => setOne(list, "origin", v)}
							/>
						</FilterBar>
						<span className="ml-auto text-sm text-muted-foreground">
							Explorer · Todo · Schedule · Project · API
						</span>
					</div>
				)}
				<ListStrip page={page} list={list} />
				{query.isLoading ? (
					<Spinner />
				) : query.error ? (
					<FleetReadState loading={false} error={query.error} what="the runs" />
				) : rows.length === 0 ? (
					chips.length ? (
						<FilteredEmpty noun="run" filters={chips} onClear={list.clear} />
					) : (
						<EmptyState
							title="Nothing has run yet"
							description="A run is one piece of work an agent does, with every helper it spawns. An ask in Explorer, a Todo assigned to an agent or a schedule firing starts one."
						/>
					)
				) : (
					<DataTable
						columns={columns}
						data={rows}
						enableSorting={false}
						getRowId={(row) => row.id}
						onRowClick={(row) => open.run(row.id)}
					/>
				)}
			</SectionBody>
		</SectionPage>
	);
}

/** `4 no progress · 2 budget declined` — the engine's count per reason. */
function reasonsLine(byReason: Record<string, number> | undefined) {
	const parts = Object.entries(byReason ?? {})
		.filter(([, n]) => n > 0)
		.sort((a, b) => b[1] - a[1])
		.map(([reason, n]) => `${n} ${reason.replaceAll("_", " ")}`);
	return parts.length ? parts.join(" · ") : undefined;
}

function Tiles({ stats }: { stats: RunStats }) {
	const waiting = stats.waiting_approvals ?? 0;
	return (
		<MetricGrid minTileWidth={160}>
			<MetricTile
				label="Live"
				value={stats.live}
				caption={
					stats.largest_live_agents && stats.largest_live_agents > 1
						? `one with ${formatGrouped(stats.largest_live_agents)} agents`
						: undefined
				}
				captionTone="muted"
			/>
			<MetricTile
				label="Waiting on you"
				value={waiting}
				caption={waiting ? "approvals" : "nothing waiting"}
				captionTone={waiting ? "warning" : "muted"}
			/>
			<MetricTile
				label="Served · 24 h"
				value={stats.served ?? "—"}
				caption={
					stats.served_share != null
						? `${Math.round(stats.served_share * 100)}%`
						: undefined
				}
				captionTone="muted"
			/>
			<MetricTile
				label="Not served · 24 h"
				value={stats.not_served ?? "—"}
				caption={reasonsLine(stats.not_served_by_reason)}
				captionTone="muted"
			/>
			<MetricTile label="Tokens · 24 h" value={tokens(stats.tokens)} />
		</MetricGrid>
	);
}

/** The engine's stored time once settled; a live clock while it runs. */
function timeOf(run: TaskRunSummary): string {
	if (run.duration_ms != null) return formatElapsed(run.duration_ms);
	if (!run.finished_at && run.started_at)
		return formatElapsed(Date.now() - new Date(run.started_at).getTime());
	return "—";
}

function runColumns(): ColumnDef<TaskRunSummary>[] {
	return [
		{
			id: "run",
			header: "Run",
			cell: ({ row }) => (
				<TypographyInlineCode>
					{runNumber(row.original.id, row.original.number)}
				</TypographyInlineCode>
			),
		},
		{
			id: "agent",
			header: "Root agent",
			cell: ({ row }) => row.original.agent_name ?? "—",
		},
		{
			id: "asked",
			header: "Asked",
			cell: ({ row }) => (
				<span className="line-clamp-1">
					{row.original.body?.trim() ||
						row.original.task_title ||
						row.original.flow_key}
				</span>
			),
		},
		{
			id: "from",
			header: "From",
			cell: ({ row }) =>
				row.original.origin ? (
					<Badge variant="outline" tone="muted" size="xs">
						{row.original.origin}
					</Badge>
				) : (
					<span className="text-muted-foreground">—</span>
				),
		},
		{
			id: "started_by",
			header: "Started by",
			cell: ({ row }) => row.original.started_by_name ?? "—",
		},
		{
			id: "size",
			header: "Size",
			cell: ({ row }) =>
				row.original.agents != null ? agentsWord(row.original.agents) : "—",
		},
		{
			id: "tokens",
			header: "Tokens",
			cell: ({ row }) => (
				<span className="font-mono">
					{row.original.tokens > 0 ? tokens(row.original.tokens) : "—"}
				</span>
			),
		},
		{
			id: "time",
			header: "Time",
			cell: ({ row }) => (
				<span className="font-mono">{timeOf(row.original)}</span>
			),
		},
		{
			id: "status",
			header: "Status",
			cell: ({ row }) => (
				<span className="inline-flex items-center gap-1.5 whitespace-nowrap">
					<StatusDot
						tone={statusTone(row.original.status, row.original.exit_reason)}
					/>
					{statusWord(row.original.status, row.original.exit_reason)}
				</span>
			),
		},
	];
}
