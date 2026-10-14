/**
 * **A project** — the page `mainSection` draws when a project is open
 * (projects.md PJ-03…PJ-11, PJ-14; boards `projects.project` and its
 * tabs).
 *
 * The header names the project and what is true of it — its type, who can see
 * it, how many branches, whether a decision is open — over the question it
 * decides and the people on it. A private project's header reads *people
 * only:* and the names staffed on it — people as the Graph's member list names
 * them, agents by their own names — because that list is who can open it. A
 * member without the `work` role reads the page under a read-only notice, its
 * acts drawn disabled with who to ask. Its tabs read the project six ways:
 * **Overview** where the quest stands, **Branches** the tree of inquiry,
 * **Impact** what an option reaches over the graph, **Decisions** what was
 * decided on it, **Lineage** how a decision got here, **Report** the
 * write-up. A branch, a finding and a simulation's result are drill-ins with
 * headers of their own; the tab they were opened from waits behind them.
 * *Simulate* is offered whenever a simulator is installed.
 *
 * The page reads the project's records once (`useProjectRecords`) and hands
 * them down, so the header's counts and the tab under it never disagree.
 */

import {
	Badge,
	Button,
	RecordHeader,
	Tabs,
	TabsList,
	TabsTrigger,
} from "@invana/ui";
import { useMembersQuery } from "@invana-studio/core";
import { ActButton, ReadOnlyNotice } from "@invana-studio/shell";
import { FileText, FlaskConical, GitFork } from "lucide-react";
import { useState } from "react";
import { ImpactTab } from "../impact/ImpactTab";
import { useProjectQuery } from "../queries";
import {
	useAssignmentsQuery,
	useReportQuery,
	useSimulatorsQuery,
} from "../records/queries";
import { useProjectRecords } from "../records/useProjectRecords";
import { branchWord, plural, typeLabel } from "../records/words";
import { SimulateDialog } from "../simulation/SimulateDialog";
import { SimulationView } from "../simulation/SimulationView";
import type { Simulation } from "../types";
import { useProjectsViewPanel } from "../useProjectsViewPanel";
import { BranchCanvas } from "./BranchTree";
import { BranchView } from "./BranchView";
import { DecideDialog } from "./DecideDialog";
import { DecisionsTable } from "./DecisionsTable";
import { FindingView } from "./FindingView";
import { ForkDialog } from "./ForkDialog";
import { LineageTab } from "./LineageTab";
import { OverviewTab } from "./OverviewTab";
import { CanvasFrame, Page, ReadState } from "./parts";
import { ReportTab } from "./ReportTab";
import { type ProjectTab, useProjectView } from "./useProjectView";

export interface ProjectPageProps {
	username: string;
	graphSlug: string;
	projectKey: string;
	/** A run a finding cites, opened as its board. */
	onOpenRun?: (runId: string) => void;
	/** A dataset a finding cites, opened in Datasets. */
	onOpenDataset?: (address: string) => void;
	/** A todo on a branch; the Projects stack's Todos section by default. */
	onOpenTodo?: (id: string) => void;
}

type Act =
	| { kind: "fork"; branch: number }
	| { kind: "decide"; branch: number; merge?: boolean }
	| { kind: "simulate"; branch: number | null }
	| null;

export function ProjectPage(pageProps: ProjectPageProps) {
	const stack = useProjectsViewPanel();
	const props = {
		...pageProps,
		onOpenTodo: pageProps.onOpenTodo ?? stack.openTodo,
	};
	const { username, graphSlug, projectKey } = props;
	const ref = { username, graphSlug, key: projectKey };
	const query = useProjectQuery(username, graphSlug, projectKey);
	const records = useProjectRecords(ref);
	const staff = useAssignmentsQuery(ref);
	const members = useMembersQuery({ username, graphSlug });
	const report = useReportQuery(ref);
	const view = useProjectView();
	const [act, setAct] = useState<Act>(null);
	const simulators = useSimulatorsQuery();
	const canSimulate = (simulators.data?.items.length ?? 0) > 0;

	const project = query.data;
	if (!project)
		return (
			<Page>
				<ReadState loading={query.isLoading} error={query.error} />
			</Page>
		);

	const { branches, decisions } = records;
	const root = branches.find((b) => b.parent_number === null)?.number ?? 1;
	const undecided = branches.filter(
		(b) =>
			b.current_decision === null &&
			b.status !== "dropped" &&
			b.status !== "merged",
	);
	const frozen = project.status === "archived";
	// A person by the name the Graph's member list knows them by; an agent by its own.
	const byUserId = new Map(
		(members.data?.items ?? []).map((m) => [
			m.user_id,
			m.first_name || m.username,
		]),
	);
	const people = (staff.data?.items ?? []).map((a) =>
		a.principal_kind === "agent"
			? (a.principal_name ?? "an agent")
			: (byUserId.get(a.principal_id) ?? a.principal_name ?? "someone"),
	);

	const openAct = (next: Act) => setAct(next);
	const acts = (
		<Acts
			project={project}
			act={act}
			records={records}
			onClose={() => setAct(null)}
			onSimulated={(s) => view.openSimulation(s.number, s.branch)}
			refKey={ref}
		/>
	);

	if (view.finding !== null)
		return (
			<FindingView
				{...props}
				project={project}
				records={records}
				number={view.finding}
				onTrace={(d) => view.traceDecision(d)}
			/>
		);

	if (view.simulation !== null)
		return (
			<SimulationView {...props} project={project} number={view.simulation} />
		);

	if (view.branch !== null)
		return (
			<>
				<BranchView
					{...props}
					project={project}
					records={records}
					number={view.branch}
					frozen={frozen}
					onOpenBranch={view.openBranch}
					onOpenFinding={view.openFinding}
					onFork={(n) => openAct({ kind: "fork", branch: n })}
					onDecide={(n, merge) => openAct({ kind: "decide", branch: n, merge })}
					onSimulate={
						canSimulate
							? (n) => openAct({ kind: "simulate", branch: n })
							: undefined
					}
					onOpenSimulation={(n) =>
						view.openSimulation(n, view.branch ?? undefined)
					}
				/>
				{acts}
			</>
		);

	const tabs: { id: ProjectTab; label: string }[] = [
		{ id: "overview", label: "Overview" },
		{ id: "branches", label: `Branches · ${branches.length}` },
		{ id: "impact", label: "Impact" },
		{ id: "decisions", label: `Decisions · ${decisions.length}` },
		{ id: "lineage", label: "Lineage" },
		{
			id: "report",
			label: report.data?.versions.length
				? `Report · ${report.data.versions.length}`
				: "Report",
		},
	];

	return (
		<Page>
			<RecordHeader
				crumbs={[project.name]}
				chips={
					<>
						<Badge variant="soft" tone="primary" size="xs">
							{typeLabel(project.type)}
						</Badge>
						<Badge variant="outline" tone="muted" size="xs">
							{project.visibility === "private"
								? `people only: ${people.join(", ") || "you"}`
								: "Graph members"}
						</Badge>
						<Badge variant="outline" tone="muted" size="xs">
							{plural(branches.length, "branch", "branches")}
						</Badge>
						{undecided.length ? (
							<Badge variant="soft" tone="warning" size="xs">
								{plural(undecided.length, "decision")} open
							</Badge>
						) : null}
						{frozen ? (
							<Badge variant="outline" tone="muted" size="xs">
								archived
							</Badge>
						) : null}
					</>
				}
				actions={
					<>
						<Button
							variant="outline"
							size="sm"
							onClick={() => view.setTab("report")}
						>
							<FileText />
							Report
						</Button>
						{canSimulate ? (
							<ActButton
								area="work"
								variant="outline"
								size="sm"
								disabled={frozen}
								onClick={() => openAct({ kind: "simulate", branch: null })}
							>
								<FlaskConical />
								Simulate
							</ActButton>
						) : null}
						<ActButton
							area="work"
							size="sm"
							disabled={frozen}
							onClick={() => openAct({ kind: "fork", branch: root })}
						>
							<GitFork />
							Fork a branch
						</ActButton>
					</>
				}
			/>
			<div className="px-4 pt-2 empty:hidden">
				<ReadOnlyNotice area="work" noun="project" />
			</div>
			<p className="truncate px-4 pt-2 text-sm text-muted-foreground">
				{[
					project.question || project.description || "No question written yet",
					project.visibility === "private" ? null : people.join(", "),
				]
					.filter(Boolean)
					.join(" · ")}
			</p>
			<Tabs
				value={view.tab}
				onValueChange={(t) => view.setTab(t as ProjectTab)}
			>
				<TabsList className="w-full justify-start gap-1 px-3">
					{tabs.map((t) => (
						<TabsTrigger key={t.id} value={t.id}>
							{t.label}
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>

			{view.tab === "overview" ? (
				<OverviewTab
					{...props}
					project={project}
					records={records}
					onOpenBranch={view.openBranch}
				/>
			) : view.tab === "branches" ? (
				<div className="p-3">
					<CanvasFrame>
						<BranchCanvas
							project={project}
							branches={branches}
							decisions={decisions}
							onOpen={view.openBranch}
						/>
					</CanvasFrame>
				</div>
			) : view.tab === "impact" ? (
				<ImpactTab
					username={username}
					graphSlug={graphSlug}
					project={project}
					records={records}
					of={view.of}
					hops={view.hops}
					onReach={view.setReach}
					onOpenFinding={(n, b) => view.openFindingOn(b, n)}
				/>
			) : view.tab === "decisions" ? (
				<div className="p-3">
					<DecisionsTable
						decisions={decisions}
						projects={[project]}
						onOpen={(d) => d.branch_number && view.openBranch(d.branch_number)}
						onTrace={(d) => view.traceDecision(d.number)}
						empty={`Nothing decided yet. Open a ${branchWord(project).toLowerCase()} and Decide when the evidence is in.`}
					/>
				</div>
			) : view.tab === "lineage" ? (
				<LineageTab
					{...props}
					project={project}
					records={records}
					decision={view.decision}
					onPick={view.traceDecision}
					onOpenFinding={(n, b) => view.openFindingOn(b, n)}
				/>
			) : (
				<ReportTab project={project} refKey={ref} frozen={frozen} />
			)}

			{acts}
		</Page>
	);
}

/** The dialogs the page's acts open — fork, decide, merge and simulate. */
function Acts({
	project,
	act,
	records,
	refKey,
	onClose,
	onSimulated,
}: {
	project: Parameters<typeof ForkDialog>[0]["project"];
	act: Act;
	records: ReturnType<typeof useProjectRecords>;
	refKey: { username: string; graphSlug: string; key: string };
	onClose: () => void;
	onSimulated: (s: Simulation) => void;
}) {
	return (
		<>
			<ForkDialog
				project={project}
				refKey={refKey}
				records={records}
				branch={act?.kind === "fork" ? act.branch : null}
				onClose={onClose}
			/>
			<DecideDialog
				project={project}
				refKey={refKey}
				records={records}
				branch={act?.kind === "decide" ? act.branch : null}
				merge={act?.kind === "decide" && !!act.merge}
				onClose={onClose}
			/>
			<SimulateDialog
				open={act?.kind === "simulate"}
				onClose={onClose}
				project={project}
				refKey={refKey}
				branch={act?.kind === "simulate" ? act.branch : null}
				branches={records.branches}
				onSimulated={onSimulated}
			/>
		</>
	);
}
