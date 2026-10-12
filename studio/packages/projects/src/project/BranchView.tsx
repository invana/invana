/**
 * **A branch** — one line of inquiry with its hypothesis, verdict, evidence
 * for and against, what agents proposed and the todos filed on it
 * (projects.md PJ-05, board `projects.branch`).
 *
 * The header carries the branch's state — its status, the current verdict,
 * the balance of evidence and where it was forked from — and its acts:
 * *Decide*, *Merge…*, *Fork*, *Simulate* (when a simulator is installed) and
 * *Add finding*. **Work** is proposals over the todos and findings side by
 * side, because the next act on a branch is one of those three.
 * **Simulations** lists what was simulated on it, each opening its result.
 * **History** is its decisions, newest first, a superseded one kept and
 * marked: decisions are append-only.
 */

import { Input, Label } from "@invana/forms";
import {
	Badge,
	Button,
	ProposalCard,
	RecordHeader,
	Tabs,
	TabsList,
	TabsTrigger,
} from "@invana/ui";
import { humanStatus, RecordRow, taskTone } from "@invana-studio/ui";
import { FlaskConical, Gavel, GitFork, GitMerge, Plus } from "lucide-react";
import { useState } from "react";
import { useProjectsSlots } from "../ProjectsSlots";
import { useTodoMutations, useTodosQuery } from "../queries";
import {
	useBranchQuery,
	useRecordMutations,
	useSimulationsQuery,
} from "../records/queries";
import type { useProjectRecords } from "../records/useProjectRecords";
import {
	balance,
	branchLabel,
	branchWord,
	choiceLabel,
	evidenceWord,
	plural,
	STATUS_TONE,
	shortDate,
	verdictLabel,
} from "../records/words";
import { SimulationRows } from "../simulation/SimulationRows";
import type { Decision, Finding, Project, Proposal } from "../types";
import { AddFindingDialog } from "./AddFindingDialog";
import { Box, Muted, Page, ReadState, StanceBadge } from "./parts";

type BranchTab = "work" | "findings" | "simulations" | "history";

export function BranchView({
	username,
	graphSlug,
	project,
	number,
	frozen,
	onOpenBranch,
	onOpenFinding,
	onOpenTodo,
	onFork,
	onDecide,
	onSimulate,
	onOpenSimulation,
}: {
	username: string;
	graphSlug: string;
	project: Project;
	records: ReturnType<typeof useProjectRecords>;
	number: number;
	frozen: boolean;
	onOpenBranch: (n: number) => void;
	onOpenFinding: (n: number) => void;
	onOpenTodo?: (id: string) => void;
	onFork: (n: number) => void;
	onDecide: (n: number, merge?: boolean) => void;
	/** Absent while no simulator is installed. */
	onSimulate?: (n: number) => void;
	onOpenSimulation: (n: number) => void;
}) {
	const ref = { username, graphSlug, key: project.key };
	const detail = useBranchQuery(ref, number);
	const simulations = useSimulationsQuery(ref, number);
	const [tab, setTab] = useState<BranchTab>("work");
	const [adding, setAdding] = useState(false);

	const d = detail.data;
	if (!d)
		return (
			<Page>
				<ReadState loading={detail.isLoading} error={detail.error} />
			</Page>
		);
	const b = d.branch;
	const current = d.decisions.find((x) => x.number === b.current_decision);
	const closed = b.status === "dropped" || b.status === "merged";
	const label = branchLabel(project, b.number);

	return (
		<Page>
			<RecordHeader
				crumbs={[`${label} · ${b.title}`]}
				chips={
					<>
						<Badge variant="soft" tone={STATUS_TONE[b.status]} size="xs">
							{b.status}
						</Badge>
						<Badge variant="outline" tone="muted" size="xs">
							verdict:{" "}
							{current ? verdictLabel(project, current.verdict) : "open"}
						</Badge>
						<Badge
							variant="soft"
							tone={b.contradicts ? "warning" : "muted"}
							size="xs"
						>
							{balance(b)}
						</Badge>
						{b.parent_number !== null ? (
							<Badge variant="outline" tone="muted" size="xs">
								child of {branchLabel(project, b.parent_number)}
							</Badge>
						) : null}
						{b.merged_into_number !== null ? (
							<Badge variant="outline" tone="primary" size="xs">
								merged into {branchLabel(project, b.merged_into_number)}
							</Badge>
						) : null}
					</>
				}
				actions={
					frozen ? null : (
						<>
							<Button
								size="sm"
								disabled={closed}
								onClick={() => onDecide(b.number)}
							>
								<Gavel />
								Decide
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={closed}
								onClick={() => onDecide(b.number, true)}
							>
								<GitMerge />
								Merge…
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={closed}
								onClick={() => onFork(b.number)}
							>
								<GitFork />
								Fork
							</Button>
							{onSimulate ? (
								<Button
									variant="outline"
									size="sm"
									disabled={closed}
									onClick={() => onSimulate(b.number)}
								>
									<FlaskConical />
									Simulate
								</Button>
							) : null}
						</>
					)
				}
			/>
			<p className="px-4 pt-2 text-sm text-muted-foreground">
				{branchWord(project)}: {b.body || b.title}
			</p>
			<Tabs value={tab} onValueChange={(t) => setTab(t as BranchTab)}>
				<TabsList className="w-full justify-start gap-1 px-3">
					<TabsTrigger value="work">Work</TabsTrigger>
					<TabsTrigger value="findings">
						{evidenceWord(project)}s · {d.findings.length}
					</TabsTrigger>
					<TabsTrigger value="simulations">
						Simulations · {simulations.data?.total ?? 0}
					</TabsTrigger>
					<TabsTrigger value="history">
						History · {d.decisions.length}
					</TabsTrigger>
				</TabsList>
			</Tabs>

			{tab === "work" ? (
				<div className="flex flex-col gap-3 p-3">
					<Proposals
						project={project}
						refKey={ref}
						proposals={d.proposals.filter((p) => p.status === "open")}
						frozen={frozen}
					/>
					<div className="grid min-w-0 grid-cols-2 gap-3">
						<Todos
							username={username}
							graphSlug={graphSlug}
							project={project}
							branchId={b.id}
							branchNumber={b.number}
							frozen={frozen}
							onOpenTodo={onOpenTodo}
						/>
						<Box
							title={`${evidenceWord(project)}s`}
							count={d.findings.length}
							actions={
								frozen || closed ? null : (
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setAdding(true)}
									>
										<Plus />
										Add {evidenceWord(project).toLowerCase()}
									</Button>
								)
							}
						>
							<FindingRows
								project={project}
								findings={d.findings}
								onOpen={onOpenFinding}
							/>
						</Box>
					</div>
					{d.children.length ? (
						<Box title="Forked into" count={d.children.length}>
							<ul>
								{d.children.map((n) => (
									<li key={n}>
										<RecordRow
											title={branchLabel(project, n)}
											onClick={() => onOpenBranch(n)}
										/>
									</li>
								))}
							</ul>
						</Box>
					) : null}
				</div>
			) : tab === "findings" ? (
				<div className="p-3">
					<Box title={`${evidenceWord(project)}s`} count={d.findings.length}>
						<FindingRows
							project={project}
							findings={d.findings}
							onOpen={onOpenFinding}
						/>
					</Box>
				</div>
			) : tab === "simulations" ? (
				<div className="p-3">
					<Box title="Simulations" count={simulations.data?.total ?? 0}>
						<SimulationRows
							project={project}
							refKey={ref}
							branch={b.number}
							onOpen={onOpenSimulation}
						/>
					</Box>
				</div>
			) : (
				<div className="p-3">
					<Box title="Decisions" count={d.decisions.length}>
						<DecisionHistory project={project} decisions={d.decisions} />
					</Box>
				</div>
			)}

			<AddFindingDialog
				open={adding}
				onClose={() => setAdding(false)}
				username={username}
				graphSlug={graphSlug}
				fixed={{ project, branch: b.number }}
			/>
		</Page>
	);
}

/** A finding's subline: who added it, whether a person reviewed it, what it cites. */
function findingMeta(f: Finding, project: Project): string {
	const cites = f.cites.length
		? f.cites
				.map((c) => (c.kind === "dataset" ? c.ref : `${c.kind}`))
				.join(" · ")
		: "no cites";
	return [
		f.reviewed_by_id
			? "person-reviewed"
			: f.added_by_kind === "agent"
				? "added by an agent, not reviewed"
				: "not reviewed",
		cites,
		f.via === "fork" || f.via === "merge"
			? `${f.via === "fork" ? "inherited from" : "merged from"} ${f.branch_number !== null ? branchLabel(project, f.branch_number) : "another branch"}`
			: null,
	]
		.filter(Boolean)
		.join(" · ");
}

function FindingRows({
	project,
	findings,
	onOpen,
}: {
	project: Project;
	findings: Finding[];
	onOpen: (n: number) => void;
}) {
	if (findings.length === 0)
		return (
			<Muted>
				No {evidenceWord(project).toLowerCase()} yet — add what bears for or
				against this {branchWord(project).toLowerCase()}.
			</Muted>
		);
	return (
		<ul>
			{findings.map((f) => (
				<li key={f.id}>
					<RecordRow
						onClick={() => onOpen(f.number)}
						tone={f.reviewed_by_id ? "success" : "warning"}
						title={<span className="truncate">{f.statement}</span>}
						subtitle={
							<span className="truncate">{findingMeta(f, project)}</span>
						}
						actions={<StanceBadge stance={f.stance} />}
						pinActions
					/>
				</li>
			))}
		</ul>
	);
}

function Proposals({
	project,
	refKey,
	proposals,
	frozen,
}: {
	project: Project;
	refKey: { username: string; graphSlug: string; key: string };
	proposals: Proposal[];
	frozen: boolean;
}) {
	const { useAgents } = useProjectsSlots();
	const agents = useAgents(refKey.username, refKey.graphSlug).data?.items ?? [];
	const { resolve } = useRecordMutations(refKey);
	const [refusal, setRefusal] = useState<string | null>(null);
	if (proposals.length === 0) return null;
	return (
		<Box title="Proposals" count={proposals.length}>
			<p className="px-3 pt-2 text-sm text-muted-foreground">
				Agents propose; a person accepts or rejects.
			</p>
			<div className="flex flex-col gap-2 p-3">
				{proposals.map((p) => {
					const agent =
						agents.find((a) => a.id === p.agent_id)?.name ?? "An agent";
					const what =
						p.kind === "fork"
							? `fork into ${(p.payload.titles ?? []).join(", ")}`
							: `decide: ${p.payload.decision?.choice ? choiceLabel(project, p.payload.decision.choice) : "a decision"}`;
					return (
						<ProposalCard
							key={p.id}
							title={`${agent} proposes: ${what}`}
							source={`p${p.number} · ${shortDate(p.created_at)}`}
							actions={
								frozen ? null : (
									<>
										<Button
											variant="ghost"
											size="sm"
											disabled={resolve.isPending}
											onClick={() =>
												resolve.mutate({ n: p.number, act: "reject" })
											}
										>
											Reject
										</Button>
										<Button
											size="sm"
											disabled={resolve.isPending}
											onClick={() =>
												resolve.mutate(
													{ n: p.number, act: "accept" },
													{
														onError: (e) => setRefusal((e as Error).message),
														onSuccess: () => setRefusal(null),
													},
												)
											}
										>
											{p.kind === "fork" ? "Accept fork" : "Accept decision"}
										</Button>
									</>
								)
							}
						>
							“{p.rationale}”
						</ProposalCard>
					);
				})}
				{refusal ? (
					<p role="alert" className="text-sm text-destructive">
						{refusal}
					</p>
				) : null}
			</div>
		</Box>
	);
}

function Todos({
	username,
	graphSlug,
	project,
	branchId,
	branchNumber,
	frozen,
	onOpenTodo,
}: {
	username: string;
	graphSlug: string;
	project: Project;
	branchId: string;
	branchNumber: number;
	frozen: boolean;
	onOpenTodo?: (id: string) => void;
}) {
	const todos = useTodosQuery(username, graphSlug, { project: project.key });
	const mine = (todos.data?.items ?? []).filter(
		(t) => t.branch_id === branchId,
	);
	const { create } = useTodoMutations(username, graphSlug);
	const [title, setTitle] = useState<string | null>(null);
	return (
		<Box
			title="Todos"
			count={mine.length}
			actions={
				frozen ? null : (
					<Button variant="ghost" size="sm" onClick={() => setTitle("")}>
						<Plus />
						New todo
					</Button>
				)
			}
		>
			{title !== null ? (
				<form
					className="flex items-end gap-2 border-b px-3 py-2"
					onSubmit={(e) => {
						e.preventDefault();
						if (!title.trim()) return;
						create.mutate(
							{
								title: title.trim(),
								project_key: project.key,
								branch: branchNumber,
							},
							{ onSuccess: () => setTitle(null) },
						);
					}}
				>
					<div className="flex min-w-0 flex-1 flex-col gap-1">
						<Label htmlFor="branch-todo">Todo</Label>
						<Input
							id="branch-todo"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="What needs doing on this branch"
						/>
					</div>
					<Button
						type="submit"
						size="sm"
						disabled={!title.trim() || create.isPending}
					>
						Add
					</Button>
				</form>
			) : null}
			{mine.length === 0 ? (
				<Muted>No todos on this {branchWord(project).toLowerCase()}.</Muted>
			) : (
				<ul>
					{mine.map((t) => (
						<li key={t.id}>
							<RecordRow
								onClick={onOpenTodo ? () => onOpenTodo(t.id) : undefined}
								tone={taskTone(t.status)}
								live={t.status === "in_progress"}
								title={<span className="truncate">{t.title}</span>}
								subtitle={
									<span className="truncate">
										{[
											t.assignee_name ?? "unassigned",
											t.due_at ? `due ${shortDate(t.due_at)}` : null,
										]
											.filter(Boolean)
											.join(" · ")}
									</span>
								}
								status={humanStatus(t.status)}
								statusTone={taskTone(t.status)}
							/>
						</li>
					))}
				</ul>
			)}
		</Box>
	);
}

/** A branch's decisions, newest first; a superseded one is kept and says so. */
function DecisionHistory({
	project,
	decisions,
}: {
	project: Project;
	decisions: Decision[];
}) {
	if (decisions.length === 0)
		return (
			<Muted>Not decided yet. A decision closes or carries the line on.</Muted>
		);
	return (
		<ul>
			{[...decisions]
				.sort((a, b) => b.number - a.number)
				.map((d) => (
					<li key={d.id}>
						<RecordRow
							tone={d.superseded_by_number ? "muted" : "success"}
							title={
								<span
									className={
										d.superseded_by_number
											? "truncate text-muted-foreground line-through"
											: "truncate"
									}
								>
									d{d.number} · {choiceLabel(project, d.choice)} ·{" "}
									{verdictLabel(project, d.verdict)}
								</span>
							}
							subtitle={
								<span className="truncate">
									{[
										shortDate(d.created_at),
										d.rationale,
										d.supersedes_number
											? `supersedes d${d.supersedes_number}`
											: null,
										d.superseded_by_number
											? `superseded by d${d.superseded_by_number}`
											: null,
										plural(d.cites.length, "cite"),
									]
										.filter(Boolean)
										.join(" · ")}
								</span>
							}
							status={d.superseded_by_number ? "superseded" : "current"}
							statusTone={d.superseded_by_number ? "muted" : "success"}
						/>
					</li>
				))}
		</ul>
	);
}
