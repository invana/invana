/**
 * **The run page** — `?page=run:<id>` in the Agents workbook, the same for one
 * agent, nine or seven hundred (the-run-page.md).
 *
 * *As a reviewer or an operator, I want each run read the same way at any
 * size — its numbers, who spawned whom, each stage's input and output, what it
 * produced and touched, and every act it made — so that I know where it stands
 * and can audit or rerun any of it.*
 *
 * - **The head**: `Runs › Run #N · <root agent>`, its status (the exit reason
 *   once it ended), what started it, `N of M tokens` with a meter, and
 *   Compare (on a rerun) · Rerun · Stop run — one row. Rerun is offered once
 *   the run has ended; Stop run is absent once it has.
 * - **The tabs** (`&tab=`): Overview · Agents · Stages · Assets · Data touched
 *   · Ledger. They never change with size; past 50 agents the Overview reads
 *   the large run and Agents offers *By role* (`&view=role`).
 * - **A step opens under the stage canvas** (`&step=`, `&lane=all`).
 * - **Rerun** is a dialog over the page (`&rerun=1`); the new run opens on its
 *   own page.
 *
 * A run still going is read again every five seconds. Every number is the
 * engine's; the page formats it. A run the reader cannot open reads *not
 * found*.
 */

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Button,
	EmptyState,
	Progress,
	RecordHeader,
	TabbedPanel,
} from "@invana/ui";
import { ApiError, runsApi } from "@invana-studio/core";
import { DetailStatus } from "@invana-studio/ui";
import { useQuery } from "@tanstack/react-query";
import { Play, RotateCw, Square } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TabReadState } from "../agents/agentParts";
import { LedgerRowsTable } from "../ledger/LedgerRowsTable";
import { useAgentsOpen } from "../open";
import { tokens } from "../overview/fleetParts";
import { AgentsTab } from "./page/AgentsTab";
import { AssetsTab } from "./page/AssetsTab";
import { OverviewTab } from "./page/OverviewTab";
import { StagesTab } from "./page/StagesTab";
import { TouchedTab } from "./page/TouchedTab";
import { useRunParam } from "./page/useRunParam";
import { useRunOverviewQuery, useStopRunMutation } from "./queries";
import { RerunDialog } from "./RerunDialog";
import { runNumber, statusTone, statusWord } from "./runParts";
import type { RunHead, RunTab } from "./types";

const TABS: { value: RunTab; label: string }[] = [
	{ value: "overview", label: "Overview" },
	{ value: "agents", label: "Agents" },
	{ value: "stages", label: "Stages" },
	{ value: "assets", label: "Assets" },
	{ value: "touched", label: "Data touched" },
	{ value: "ledger", label: "Ledger" },
];

const isRunTab = (v: string | null): v is RunTab =>
	TABS.some((t) => t.value === v);

export interface RunPageProps {
	username: string;
	graphSlug: string;
	runId: string;
	/** The step open under the stage canvas — the host's `&step=`. */
	stepId: string | null;
	onOpenStep: (id: string | null) => void;
	/** Compare this run with the one it reran. */
	onCompare?: (otherRunId: string) => void;
	/** Open another run's page — a rerun, or the run a step's crumb names. */
	onOpenRun: (id: string) => void;
}

/** `Todo by ravi · "Audit LHR…"` · `asked in Explorer by meera · session "…"`. */
function startedLine(head: RunHead): string {
	const by = head.started_by_name ? ` by ${head.started_by_name}` : "";
	if (head.origin === "Explorer")
		return [
			`asked in Explorer${by}`,
			head.session_title ? `session "${head.session_title}"` : null,
		]
			.filter(Boolean)
			.join(" · ");
	const asked = head.body?.trim() || head.task_title;
	return [
		head.origin ? `${head.origin}${by}` : null,
		asked ? `"${asked}"` : null,
	]
		.filter(Boolean)
		.join(" · ");
}

export function RunPage({
	username,
	graphSlug,
	runId,
	stepId,
	onOpenStep,
	onCompare,
	onOpenRun,
}: RunPageProps) {
	const open = useAgentsOpen();
	const navigate = useNavigate();
	const overview = useRunOverviewQuery(username, graphSlug, runId);
	const stop = useStopRunMutation(username, graphSlug);
	// The run a rerun was made from — what Compare reads it against.
	const record = useQuery({
		queryKey: ["run-page", username, graphSlug, runId, "record"],
		queryFn: () => runsApi.get(username, graphSlug, runId),
		enabled: !!onCompare,
	});
	const [tabParam, setTab] = useRunParam(runId, "tab");
	const [rerunParam, setRerun] = useRunParam(runId, "rerun");
	const [stopping, setStopping] = useState(false);
	// A link to a step opens on Stages, with that step under the canvas.
	const tab: RunTab = isRunTab(tabParam)
		? tabParam
		: stepId
			? "stages"
			: "overview";
	const crumb = { label: "Runs", onClick: () => open.section("runs") };

	const data = overview.data;
	if (!data) {
		const missing =
			overview.error instanceof ApiError &&
			(overview.error.status === 404 || overview.error.status === 403);
		return (
			<div className="flex h-full min-h-0 flex-col">
				<RecordHeader variant="page" icon={<Play />} crumbs={[crumb]} />
				{missing ? (
					<EmptyState
						title="Not found"
						description="This run is not in the Graph, or you cannot open it."
					/>
				) : (
					<TabReadState
						loading={overview.isLoading}
						error={overview.error}
						what="this run"
						onRetry={() => void overview.refetch()}
					/>
				)}
			</div>
		);
	}

	const head = data.head;
	const live = head.can_stop;
	const name = runNumber(head.id, head.number);
	const rerunOf = record.data?.rerunOfRunId;
	const started = [
		startedLine(head),
		data.large ? `${data.tiles.agents} agents` : null,
	]
		.filter(Boolean)
		.join(" · ");

	const body = () => {
		const scope = { username, graphSlug, runId, live };
		switch (tab) {
			case "agents":
				return <AgentsTab {...scope} large={data.large} />;
			case "stages":
				return (
					<StagesTab
						{...scope}
						stepId={stepId}
						onOpenStep={onOpenStep}
						onOpenRun={onOpenRun}
					/>
				);
			case "assets":
				return <AssetsTab {...scope} />;
			case "touched":
				return <TouchedTab {...scope} />;
			case "ledger":
				return (
					<div className="p-3">
						<LedgerRowsTable
							username={username}
							graphSlug={graphSlug}
							runId={runId}
						/>
					</div>
				);
			default:
				return <OverviewTab overview={data} live={live} />;
		}
	};

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="shrink-0">
				<RecordHeader
					size="lg"
					variant="page"
					icon={<Play />}
					crumbs={[
						crumb,
						`Run ${name}${head.agent_name ? ` · ${head.agent_name}` : ""}`,
					]}
					chips={
						<>
							<DetailStatus tone={statusTone(head.status, head.exit_reason)}>
								{statusWord(head.status, head.exit_reason)}
							</DetailStatus>
							{started ? (
								// The origin rides the head's one row; a long ask truncates.
								<span
									className="max-w-96 truncate text-sm text-muted-foreground"
									title={started}
								>
									{started}
								</span>
							) : null}
							{head.session_id ? (
								<Button
									size="sm"
									variant="link"
									className="shrink-0"
									onClick={() =>
										navigate(
											`/u/${username}/${graphSlug}/explorer/${encodeURIComponent(head.session_id as string)}`,
										)
									}
								>
									Open the session
								</Button>
							) : null}
						</>
					}
					actions={
						<>
							<span className="inline-flex items-center gap-2 whitespace-nowrap text-sm text-muted-foreground">
								{head.tokens == null ? "—" : tokens(head.tokens)}
								{head.max_tokens_run != null
									? ` of ${tokens(head.max_tokens_run)}`
									: ""}{" "}
								tokens
								{head.max_tokens_run && head.tokens != null ? (
									<Progress
										size="sm"
										className="w-28"
										value={Math.min(
											100,
											(head.tokens / head.max_tokens_run) * 100,
										)}
										aria-label="Tokens against the run budget"
									/>
								) : null}
							</span>
							{onCompare && rerunOf ? (
								<Button
									size="sm"
									variant="ghost"
									onClick={() => onCompare(rerunOf)}
								>
									Compare
								</Button>
							) : null}
							<Button
								size="sm"
								variant="outline"
								disabled={!head.can_rerun}
								title={
									head.can_rerun ? undefined : "Offered once the run has ended"
								}
								onClick={() => setRerun("1")}
							>
								<RotateCw />
								Rerun
							</Button>
							{head.can_stop ? (
								<Button
									size="sm"
									variant="outline"
									disabled={stop.isPending}
									onClick={() => setStopping(true)}
								>
									<Square />
									Stop run
								</Button>
							) : null}
						</>
					}
				/>
			</div>
			<TabbedPanel
				className="min-h-0 flex-1 border-0 bg-transparent shadow-none"
				activeTab={tab}
				onTabChange={(v) => setTab(v === "overview" ? null : v)}
				tabs={TABS.map((t) => ({
					value: t.value,
					label: t.label,
					content: t.value === tab ? body() : null,
				}))}
			/>

			{head.can_rerun ? (
				<RerunDialog
					open={rerunParam === "1"}
					onOpenChange={(next) => setRerun(next ? "1" : null)}
					username={username}
					graphSlug={graphSlug}
					head={head}
					title={`Rerun ${name}`}
					onRerun={onOpenRun}
				/>
			) : null}

			<AlertDialog open={stopping} onOpenChange={setStopping}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Stop run {name}?</AlertDialogTitle>
						<AlertDialogDescription>
							{stop.error instanceof Error
								? stop.error.message
								: "It cancels the run and every agent it spawned: each child ends parent ended, the run ends stopped. Both are ledger rows."}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Keep it running</AlertDialogCancel>
						<AlertDialogAction
							disabled={stop.isPending}
							onClick={() =>
								stop.mutate(runId, { onSuccess: () => setStopping(false) })
							}
						>
							Stop run
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
