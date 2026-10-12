/**
 * **A project** — the page `mainSection` draws when a project is open
 * (projects.md PJ-03…PJ-08, PJ-11, PJ-14; boards `projects.project` and its
 * tabs).
 *
 * The header names the project and what is true of it — its type, who can see
 * it, how many branches, whether a decision is open — over the question it
 * decides and the people on it. Its tabs read the project five ways:
 * **Overview** where the quest stands, **Branches** the tree of inquiry,
 * **Decisions** what was decided on it, **Lineage** how a decision got here,
 * **Report** the write-up. A branch and a finding are drill-ins with headers
 * of their own; the tab they were opened from waits behind them.
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
import { FileText, GitFork } from "lucide-react";
import { useState } from "react";
import { useProjectQuery } from "../queries";
import { useAssignmentsQuery, useReportQuery } from "../records/queries";
import { useProjectRecords } from "../records/useProjectRecords";
import { branchWord, plural, typeLabel } from "../records/words";
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
	const report = useReportQuery(ref);
	const view = useProjectView();
	const [act, setAct] = useState<Act>(null);

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
	const people = (staff.data?.items ?? []).map((a) =>
		a.principal_kind === "agent"
			? `${a.principal_name ?? "an agent"}`
			: (a.principal_name ?? "someone"),
	);

	const openAct = (next: Act) => setAct(next);

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
				/>
				<Acts
					project={project}
					act={act}
					records={records}
					onClose={() => setAct(null)}
					refKey={ref}
				/>
			</>
		);

	const tabs: { id: ProjectTab; label: string }[] = [
		{ id: "overview", label: "Overview" },
		{ id: "branches", label: `Branches · ${branches.length}` },
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
								? "people only"
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
						<Button
							size="sm"
							disabled={frozen}
							onClick={() => openAct({ kind: "fork", branch: root })}
						>
							<GitFork />
							Fork a branch
						</Button>
					</>
				}
			/>
			<p className="truncate px-4 pt-2 text-sm text-muted-foreground">
				{[
					project.question || project.description || "No question written yet",
					people.join(", "),
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

			<Acts
				project={project}
				act={act}
				records={records}
				onClose={() => setAct(null)}
				refKey={ref}
			/>
		</Page>
	);
}

/** The dialogs the page's acts open — fork, decide and merge. */
function Acts({
	project,
	act,
	records,
	refKey,
	onClose,
}: {
	project: Parameters<typeof ForkDialog>[0]["project"];
	act: Act;
	records: ReturnType<typeof useProjectRecords>;
	refKey: { username: string; graphSlug: string; key: string };
	onClose: () => void;
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
		</>
	);
}
