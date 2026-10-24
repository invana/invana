/**
 * An agent › **Runs** (board `agents.agent.runs`): the one runs list,
 * filtered to this agent (`f.agent_id`), with its status tabs and filters.
 *
 * *All · Live · Waiting · Ended* each ask the engine for a set of statuses;
 * *Started by* (`f.started_by`, a member's id) and *From* (`f.origin`, what
 * opened the run) narrow it further. The engine filters and counts; the
 * applied-filters strip names what is applied, leaving out the agent, which
 * the tab fixes. The filters are this tab's own state — the agent page's URL
 * carries its page and tab, and a list filter there would leak into the
 * section lists beside it.
 *
 * *From* is where the run came from — a Todo, a schedule, a person asking —
 * never the kind of work it is: a badge per row (Asked · Schedule · Todo ·
 * Delegated), named once in the legend beside the filters. Who started a run and the size of its team
 * are not columns: the list row carries neither. A row opens the run's page.
 */

import {
	AppliedFilters,
	Badge,
	Card,
	EmptyState,
	FilterBar,
	SegmentedControl,
	StatusDot,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	TypographyInlineCode,
} from "@invana/ui";
import {
	type ListQuery,
	type TaskRunSummary,
	useMembersQuery,
} from "@invana-studio/core";
import { useRunsQuery } from "@invana-studio/shell";
import { FilterSelect } from "@invana-studio/ui";
import { useContext, useMemo, useState } from "react";
import { FilteredEmpty } from "../lists";
import { AgentsOpenContext } from "../open";
import { ms, tokens } from "../overview/fleetParts";
import { exitTone, RUN_ORIGIN, runLabel, TabReadState } from "./agentParts";
import type { Agent } from "./types";

const SHOWING = [
	{ value: "all", label: "All", statuses: [] },
	{ value: "live", label: "Live", statuses: ["queued", "running"] },
	{
		value: "waiting",
		label: "Waiting",
		statuses: ["awaiting_input", "awaiting_approval"],
	},
	{
		value: "ended",
		label: "Ended",
		statuses: ["succeeded", "failed", "cancelled"],
	},
] as const;

type Showing = (typeof SHOWING)[number]["value"];

/** The origins a person filters an agent's runs by. */
const ORIGIN_OPTIONS = ["task", "schedule", "user", "delegation"].map(
	(value) => ({ value, label: RUN_ORIGIN[value] }),
);

/** Where a run came from, in the words the *From* filter uses. */
function originOf(run: TaskRunSummary): string | null {
	return run.triggered_by
		? (RUN_ORIGIN[run.triggered_by] ?? run.triggered_by)
		: null;
}

export function AgentRunsTab({
	username,
	graphSlug,
	agent,
}: {
	username: string;
	graphSlug: string;
	agent: Agent;
}) {
	const open = useContext(AgentsOpenContext);
	const [showing, setShowing] = useState<Showing>("all");
	const [startedBy, setStartedBy] = useState("");
	const [origin, setOrigin] = useState("");
	const statuses = SHOWING.find((s) => s.value === showing)?.statuses ?? [];
	const query: ListQuery = {
		filters: {
			agent_id: [agent.id],
			...(statuses.length ? { status: [...statuses] } : {}),
			...(startedBy ? { started_by: [startedBy] } : {}),
			...(origin ? { origin: [origin] } : {}),
		},
		limit: 50,
	};
	const runs = useRunsQuery(username, graphSlug, query);
	const members = useMembersQuery({ username, graphSlug });
	const rows: TaskRunSummary[] = runs.data?.items ?? [];

	const memberOptions = useMemo(
		() =>
			(members.data?.items ?? []).map((m) => ({
				value: m.user_id,
				label: m.username,
			})),
		[members.data],
	);
	// The agent is the tab's, not a filter the reader applied or can remove.
	const chips = (runs.data?.applied ?? []).filter(
		(f) => f.field === "started_by" || f.field === "origin",
	);
	const remove = (field: string) => {
		if (field === "started_by") setStartedBy("");
		if (field === "origin") setOrigin("");
	};
	const clear = () => {
		setStartedBy("");
		setOrigin("");
	};

	return (
		<div className="flex flex-col gap-2.5 p-3.5">
			<div className="flex flex-wrap items-center gap-2">
				<SegmentedControl
					size="sm"
					aria-label="Showing"
					value={showing}
					onValueChange={(v) => setShowing(v as Showing)}
					options={SHOWING.map(({ value, label }) => ({ value, label }))}
				/>
				<FilterBar>
					<FilterSelect
						label="started by"
						value={startedBy}
						options={memberOptions}
						onChange={setStartedBy}
					/>
					<FilterSelect
						label="from"
						value={origin}
						options={ORIGIN_OPTIONS}
						onChange={setOrigin}
					/>
				</FilterBar>
				<span className="ml-auto text-sm text-muted-foreground">
					{ORIGIN_OPTIONS.map((o) => o.label).join(" · ")}
					{runs.data
						? ` — ${runs.data.total} run${runs.data.total === 1 ? "" : "s"}`
						: null}
				</span>
			</div>
			<AppliedFilters filters={chips} onRemove={remove} onClearAll={clear} />
			{runs.isLoading || runs.error ? (
				<TabReadState
					loading={runs.isLoading}
					error={runs.error}
					what="this agent's runs"
					onRetry={() => void runs.refetch()}
				/>
			) : rows.length === 0 ? (
				chips.length ? (
					<FilteredEmpty noun="run" filters={chips} onClear={clear} />
				) : (
					<EmptyState
						title={agent.status === "draft" ? "Not run yet" : "No runs here"}
						description={
							agent.status === "draft"
								? "A draft is never offered work — create the agent first."
								: "Nothing this agent ran matches this tab."
						}
					/>
				)
			) : (
				<Card className="rounded-none shadow-none">
					<Table bordered={false} density="compact">
						<TableHeader>
							<TableRow>
								<TableHead>Run</TableHead>
								<TableHead>Asked</TableHead>
								<TableHead>From</TableHead>
								<TableHead>Tokens</TableHead>
								<TableHead>Time</TableHead>
								<TableHead>Exit</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((run) => {
								const exit = run.outcome ?? run.status;
								const from = originOf(run);
								return (
									<TableRow
										key={run.id}
										className={open ? "cursor-pointer" : undefined}
										onClick={open ? () => open.run(run.id) : undefined}
									>
										<TableCell className="whitespace-nowrap">
											<TypographyInlineCode>
												{runLabel(run.id)}
											</TypographyInlineCode>
										</TableCell>
										<TableCell className="w-full max-w-0 truncate">
											{run.body?.trim() || run.task_title || run.flow_key}
										</TableCell>
										<TableCell className="whitespace-nowrap">
											{from ? (
												<Badge variant="outline" tone="muted" size="xs">
													{from}
												</Badge>
											) : (
												<span className="text-muted-foreground">—</span>
											)}
										</TableCell>
										<TableCell className="font-mono">
											{run.tokens > 0 ? tokens(run.tokens) : "—"}
										</TableCell>
										<TableCell className="font-mono">
											{ms(run.duration_ms)}
										</TableCell>
										<TableCell className="whitespace-nowrap">
											<span className="inline-flex items-center gap-1.5">
												<StatusDot tone={exitTone(exit)} />
												{exit.replaceAll("_", " ")}
											</span>
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</Card>
			)}
		</div>
	);
}
