/**
 * An agent › **Runs** (board `agents.agent.runs`): the one runs list,
 * filtered to this agent (`f.agent_id`), with its status tabs.
 *
 * *All · Live · Waiting · Ended* each ask the engine for a set of statuses;
 * the engine filters and counts. The columns are what a list row carries — who
 * started a run and the size of its team are not on the row, so they are not
 * drawn. A row opens the run's page.
 */

import {
	EmptyState,
	SegmentedControl,
	StatusDot,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import type { ListQuery } from "@invana-studio/core";
import { useRunsQuery } from "@invana-studio/shell";
import { PanelSection } from "@invana-studio/ui";
import { useContext, useState } from "react";
import { AgentsOpenContext } from "../open";
import { ms, tokens } from "../overview/fleetParts";
import { exitTone, runLabel, TabReadState } from "./agentParts";
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
	const statuses = SHOWING.find((s) => s.value === showing)?.statuses ?? [];
	const query: ListQuery = {
		filters: {
			agent_id: [agent.id],
			...(statuses.length ? { status: [...statuses] } : {}),
		},
		limit: 50,
	};
	const runs = useRunsQuery(username, graphSlug, query);
	const rows = runs.data?.items ?? [];

	return (
		<div className="flex flex-col gap-2.5 p-3.5">
			<div className="flex items-center gap-2">
				<SegmentedControl
					size="sm"
					aria-label="Showing"
					value={showing}
					onValueChange={(v) => setShowing(v as Showing)}
					options={SHOWING.map(({ value, label }) => ({ value, label }))}
				/>
				{runs.data ? (
					<span className="ml-auto text-sm text-muted-foreground">
						{runs.data.total} run{runs.data.total === 1 ? "" : "s"}
					</span>
				) : null}
			</div>
			{runs.isLoading || runs.error ? (
				<TabReadState
					loading={runs.isLoading}
					error={runs.error}
					what="this agent's runs"
					onRetry={() => void runs.refetch()}
				/>
			) : rows.length === 0 ? (
				<EmptyState
					title={agent.status === "draft" ? "Not run yet" : "No runs here"}
					description={
						agent.status === "draft"
							? "A draft is never offered work — create the agent first."
							: "Nothing this agent ran matches this tab."
					}
				/>
			) : (
				<PanelSection card title="Runs — newest first">
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
								return (
									<TableRow
										key={run.id}
										className={open ? "cursor-pointer" : undefined}
										onClick={open ? () => open.run(run.id) : undefined}
									>
										<TableCell className="font-mono">
											{runLabel(run.id)}
										</TableCell>
										<TableCell className="w-full max-w-0 truncate">
											{run.body?.trim() || run.task_title || run.flow_key}
										</TableCell>
										<TableCell className="whitespace-nowrap text-muted-foreground">
											{run.task_id ? "Todo" : (run.kind ?? "ask")}
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
				</PanelSection>
			)}
		</div>
	);
}
