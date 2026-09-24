/**
 * The graph-wide task list and the task detail (docs/for-developers/modules/work/spec.md J1, J2).
 *
 * The detail is where the governance seam is visible: an agent posts a result
 * and the task sits in **review** until a person accepts it. Accept is offered
 * to people only — there is no agent-side path to it, which is how "an agent
 * never marks its own task done" is enforced rather than merely intended.
 *
 * Three tabs, and the split between them is the promise of explainability:
 *
 * | Tab | Answers |
 * |---|---|
 * | **Work** | what was asked, what came back, and what you owe |
 * | **Activity** | who did what, on behalf of whom, caused by what |
 * | **Thoughts** | the steps inside each run — the same rows the session thread shows |
 *
 * `Thoughts` renders through {@link StepList}, the session's own component, on
 * purpose: a step row must mean one thing in Studio, not two.
 */

import {
	useAgentsQuery,
	useRunsQuery,
	useTaskActivityQuery,
	useTaskMutations,
	useTaskQuery,
	useTaskThinkingsQuery,
	useTasksQuery,
} from "@/hooks/queries/useWork";
import { formatDuration } from "@/lib/time";
import {
	StepList,
	totalDuration,
} from "@/pages/graphs-detail/features/ask/assistant/SessionSteps";
import { TaskActivityTree } from "@/pages/graphs-detail/features/work/TaskActivityTree";
import {
	DetailBlock,
	DetailPlaceholder,
	DetailProse,
	DetailStatus,
} from "@/pages/graphs-detail/shared/DetailRows";
import { WorkRow } from "@/pages/graphs-detail/shared/WorkRow";
import { humanStatus, taskTone } from "@/pages/graphs-detail/shared/statusTone";
import type { RunNode } from "@/types/run";
import type { Task, TaskRunSummary } from "@/types/work";
import { FilterSelect } from "@/ui/FilterSelect";
import { PanelStatusBar, StatusCount, StatusCrumb } from "@/ui/PanelStatusBar";
import { PrincipalChip } from "@/ui/PrincipalChip";
import {
	Button,
	CardFooter,
	FilterBar,
	MetricTile,
	PropertyRow,
	Spinner,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@invana/ui";
import { Check, Undo2, UserCog } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/**
 * Focus the field the moment it appears. The form only exists because the user
 * just clicked "+", so putting the caret in it is the completion of that
 * gesture — not an unprompted focus steal, which is what the lint rule guards
 * against.
 */
function focusOnMount(el: HTMLInputElement | null) {
	el?.focus();
}

const STATUS_OPTIONS = [
	"open",
	"assigned",
	"in_progress",
	"needs_input",
	"blocked",
	"review",
	"done",
	"failed",
].map((value) => ({ value, label: humanStatus(value) }));

type TaskTab = "work" | "activity" | "runs";

interface Props {
	username: string;
	graphSlug: string;
	/** The drawer header's live search string (G33) — this body owns no chrome. */
	search: string;
	/** Opens the new-Todo form, which the drawer header's `+` toggles. */
	creating: boolean;
	onCreating: (v: boolean) => void;
	selectedTaskId: string | null;
	onSelectTask: (id: string | null) => void;
	/** Prefill a new task into this project. */
	projectKey?: string | null;
	onOpenAgent?: (agentId: string) => void;
	/** A statement on a step row opens that rule's board (RU12). */
	onOpenRule?: (ruleId: string) => void;
	/**
	 * The selected task's project, reported up as soon as the detail loads.
	 *
	 * A task has no graph of its own until its run emits one, so the honest
	 * canvas for a selected task is the plan it sits inside — and only the panel
	 * knows which project that is, because the agent row does not carry it until
	 * the detail resolves.
	 */
	onProjectContext?: (projectKey: string | null) => void;
}

export function TodosDrawerBody({
	username,
	graphSlug,
	search,
	creating,
	onCreating,
	selectedTaskId,
	onSelectTask,
	projectKey,
	onOpenAgent,
	onOpenRule,
	onProjectContext,
}: Props) {
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [statusFilter, setStatusFilter] = useState("");
	const [assigneeFilter, setAssigneeFilter] = useState("");

	const list = useTasksQuery(username, graphSlug, {
		project: projectKey ?? undefined,
	});
	const detail = useTaskQuery(username, graphSlug, selectedTaskId ?? undefined);
	const mutations = useTaskMutations(username, graphSlug);
	const agents = useAgentsQuery(username, graphSlug);
	// Where each task's run has got to, for the row subline. One list, indexed.
	const runs = useRunsQuery(username, graphSlug, { limit: 200 });
	const runByTask = useMemo(() => {
		const byTask = new Map<string, TaskRunSummary>();
		for (const run of runs.data?.items ?? [])
			if (run.task_id && !byTask.has(run.task_id)) byTask.set(run.task_id, run);
		return byTask;
	}, [runs.data]);

	const tasks = list.data?.items ?? [];
	const assigneeOptions = useMemo(() => {
		const seen = new Map<string, string>();
		for (const task of tasks)
			if (task.assignee_id)
				seen.set(task.assignee_id, task.assignee_name ?? task.assignee_id);
		return [...seen].map(([value, label]) => ({ value, label }));
	}, [tasks]);

	const running = tasks.filter((t) => t.status === "in_progress").length;
	const reviewing = tasks.filter((t) => t.status === "review").length;

	const detailProjectKey = detail.data?.project_key ?? null;
	useEffect(() => {
		if (selectedTaskId) onProjectContext?.(detailProjectKey);
	}, [selectedTaskId, detailProjectKey, onProjectContext]);

	return (() => {
		const visible = tasks.filter(
			(t) =>
				t.title.toLowerCase().includes(search.toLowerCase()) &&
				(!statusFilter || t.status === statusFilter) &&
				(!assigneeFilter || t.assignee_id === assigneeFilter),
		);
		return (
			<div className="flex h-full min-h-0 flex-col">
				{creating && !selectedTaskId ? (
					<form
						className="space-y-1.5 border-b px-3 py-2"
						onSubmit={(e) => {
							e.preventDefault();
							if (!title.trim()) return;
							mutations.create.mutate(
								{
									title: title.trim(),
									body: body.trim(),
									project_key: projectKey ?? null,
								},
								{
									onSuccess: (task) => {
										setTitle("");
										setBody("");
										onCreating(false);
										onSelectTask(task.id);
									},
								},
							);
						}}
					>
						<input
							ref={focusOnMount}
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="What needs doing?"
							className="w-full rounded-sm border bg-background px-2 py-1.5 text-base"
						/>
						<textarea
							value={body}
							onChange={(e) => setBody(e.target.value)}
							placeholder="The goal, in prose — this is what an agent plans from."
							rows={3}
							className="w-full resize-none rounded-sm border bg-background px-2 py-1.5 text-base"
						/>
						<Button type="submit" size="sm" className="h-7 w-full text-base">
							Create
						</Button>
					</form>
				) : null}

				{selectedTaskId && detail.data ? (
					<TaskDetail
						username={username}
						graphSlug={graphSlug}
						task={detail.data}
						agents={agents.data?.items ?? []}
						onBack={() => onSelectTask(null)}
						onOpenAgent={onOpenAgent}
						onOpenRule={onOpenRule}
						mutations={mutations}
					/>
				) : (
					<>
						<FilterBar
							summary={`${visible.length} task${visible.length === 1 ? "" : "s"}`}
						>
							<FilterSelect
								label="status"
								value={statusFilter}
								options={STATUS_OPTIONS}
								onChange={setStatusFilter}
							/>
							<FilterSelect
								label="assignee"
								value={assigneeFilter}
								options={assigneeOptions}
								onChange={setAssigneeFilter}
							/>
						</FilterBar>

						<div className="flex-1 overflow-y-auto">
							{list.isLoading ? (
								<div className="px-3 py-4">
									<Spinner />
								</div>
							) : visible.length === 0 ? (
								<p className="px-3 py-4 text-base text-muted-foreground">
									{tasks.length
										? "No task matches those filters."
										: "No tasks yet. Write one down and hand it to an agent."}
								</p>
							) : (
								visible.map((task) => (
									<WorkRow
										key={task.id}
										active={task.id === selectedTaskId}
										onClick={() => onSelectTask(task.id)}
										tone={taskTone(task.status)}
										live={task.status === "in_progress"}
										indent={task.parent_id ? 1 : 0}
										title={task.title}
										status={humanStatus(task.status)}
										statusTone={taskTone(task.status)}
										subtitle={
											<>
												{task.assignee_name ? (
													<PrincipalChip
														name={task.assignee_name}
														kind={task.assignee_kind}
													/>
												) : (
													<span>unassigned</span>
												)}
												{task.project_key ? (
													<span className="truncate">· {task.project_key}</span>
												) : null}
												{runByTask.get(task.id)?.step_label &&
												runByTask.get(task.id)?.steps_total ? (
													<span className="truncate">
														· {runByTask.get(task.id)?.step_label}{" "}
														{runByTask.get(task.id)?.steps_done}/
														{runByTask.get(task.id)?.steps_total}
													</span>
												) : null}
											</>
										}
									/>
								))
							)}
						</div>

						<PanelStatusBar
							left={<StatusCrumb active>Tasks</StatusCrumb>}
							middle={[
								...(running
									? [
											<StatusCount key="r" tone="info">
												{running} running
											</StatusCount>,
										]
									: []),
								...(reviewing
									? [
											<StatusCount key="v" tone="info">
												{reviewing} in review
											</StatusCount>,
										]
									: []),
							]}
							right="⌘N new task"
						/>
					</>
				)}
			</div>
		);
	})();
}

function TaskDetail({
	username,
	graphSlug,
	task,
	agents,
	onBack,
	onOpenAgent,
	onOpenRule,
	mutations,
}: {
	username: string;
	graphSlug: string;
	task: Task;
	agents: { id: string; name: string; status: string }[];
	onBack: () => void;
	onOpenAgent?: (id: string) => void;
	onOpenRule?: (ruleId: string) => void;
	mutations: ReturnType<typeof useTaskMutations>;
}) {
	const [tab, setTab] = useState<TaskTab>("work");
	const [note, setNote] = useState("");
	const [rejecting, setRejecting] = useState(false);
	const [reassigning, setReassigning] = useState(false);

	const activity = useTaskActivityQuery(username, graphSlug, task.id);
	const runs = useTaskThinkingsQuery(username, graphSlug, task.run_ids);

	const stepCount = useMemo(
		() =>
			(runs.data ?? []).reduce(
				(n, t) => n + new Set(t.steps.map((s) => s.seq)).size,
				0,
			),
		[runs.data],
	);

	const canAccept = task.status === "review";

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="flex items-center gap-2 border-b px-3 py-1.5">
				<button
					type="button"
					onClick={onBack}
					className="shrink-0 text-base text-muted-foreground hover:text-foreground"
				>
					← Tasks
				</button>
			</div>

			{/*
			 * The attribution line. `<agent> for <person>` is the whole governance
			 * story in one row: an agent is always acting on someone's behalf, and
			 * that someone is who Accept belongs to.
			 */}
			<div className="flex shrink-0 flex-wrap items-center gap-2 px-3 pb-1.5 pt-2.5">
				<DetailStatus tone={taskTone(task.status)}>
					{humanStatus(task.status)}
				</DetailStatus>
				{task.assignee_name ? (
					<>
						<PrincipalChip
							name={task.assignee_name}
							kind={task.assignee_kind}
							onClick={
								task.assignee_kind === "agent" &&
								onOpenAgent &&
								task.assignee_id
									? () => onOpenAgent(task.assignee_id as string)
									: undefined
							}
						/>
						{task.assignee_kind === "agent" ? (
							<span className="text-base text-muted-foreground">for</span>
						) : null}
					</>
				) : null}
				{task.assignee_kind === "agent" && task.created_by_id ? (
					<PrincipalChip name="you" kind="user" />
				) : null}
				<span className="ml-auto truncate text-base text-muted-foreground">
					{[
						task.project_key,
						task.due_at
							? `due ${new Date(task.due_at).toLocaleDateString(undefined, { weekday: "short" })}`
							: null,
					]
						.filter(Boolean)
						.join(" · ")}
				</span>
			</div>

			{task.body ? (
				<p className="shrink-0 whitespace-pre-wrap px-3 text-base text-foreground">
					{task.body}
				</p>
			) : null}
			{task.acceptance ? (
				<p className="shrink-0 px-3 pt-1.5 text-base text-muted-foreground">
					<span className="font-medium text-foreground">Accepts when</span>{" "}
					{task.acceptance}
				</p>
			) : null}

			<Tabs
				size="sm"
				value={tab}
				onValueChange={(v) => setTab(v as TaskTab)}
				className="flex min-h-0 flex-1 flex-col"
			>
				<TabsList className="w-full justify-start gap-1 px-3">
					<TabsTrigger value="work">Work</TabsTrigger>
					<TabsTrigger value="activity">Activity</TabsTrigger>
					<TabsTrigger value="runs">
						Thoughts ({task.run_ids.length})
					</TabsTrigger>
				</TabsList>

				{/* ── Work ──────────────────────────────────────────────────────── */}
				<TabsContent
					value="work"
					className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-2.5"
				>
					{task.status === "needs_input" && task.blocked_reason ? (
						<div className="rounded-sm border border-amber-500/40 p-2 text-base">
							<div className="font-medium text-amber-600 dark:text-amber-400">
								Waiting on you
							</div>
							<p className="mt-0.5 text-muted-foreground">
								{task.blocked_reason}
							</p>
						</div>
					) : null}

					{task.result?.summary ? (
						<ResultBlock task={task} />
					) : (
						<p className="text-base text-muted-foreground">
							Nothing has come back yet.
							{task.assignee_kind === "agent"
								? " The agent posts a result here, and it stays in review until you accept it."
								: " Assign it to an agent and it starts itself."}
						</p>
					)}

					{/* The assignee picker. An agent assignment *is* the trigger — it
					    opens exactly one run, and the task starts itself. */}
					{reassigning || !task.assignee_id ? (
						<label className="block text-base text-muted-foreground">
							Assignee
							<select
								value={task.assignee_id ?? ""}
								onChange={(e) => {
									mutations.update.mutate({
										id: task.id,
										data: e.target.value
											? { assignee_kind: "agent", assignee_id: e.target.value }
											: { assignee_kind: "none" },
									});
									setReassigning(false);
								}}
								className="mt-1 w-full rounded-sm border bg-background px-2 py-1.5 text-base text-foreground"
							>
								<option value="">Unassigned</option>
								{agents.map((a) => (
									<option
										key={a.id}
										value={a.id}
										disabled={a.status !== "active"}
									>
										{a.name}
										{a.status !== "active" ? ` (${a.status})` : ""}
									</option>
								))}
							</select>
						</label>
					) : null}

					{rejecting ? (
						<form
							className="space-y-1.5"
							onSubmit={(e) => {
								e.preventDefault();
								mutations.reject.mutate({ id: task.id, note });
								setNote("");
								setRejecting(false);
							}}
						>
							<textarea
								value={note}
								onChange={(e) => setNote(e.target.value)}
								rows={2}
								placeholder="What needs to change? This becomes a new round on the same task."
								className="w-full resize-none rounded-sm border bg-background px-2 py-1.5 text-base"
							/>
							<div className="flex gap-1.5">
								<Button type="submit" size="sm" className="h-7 text-base">
									Send back
								</Button>
								<Button
									type="button"
									size="sm"
									variant="ghost"
									className="h-7 text-base"
									onClick={() => setRejecting(false)}
								>
									Cancel
								</Button>
							</div>
						</form>
					) : null}
				</TabsContent>

				{/* ── Activity ──────────────────────────────────────────────────── */}
				<TabsContent
					value="activity"
					className="min-h-0 flex-1 overflow-y-auto"
				>
					{activity.isLoading ? (
						<div className="px-3 py-4">
							<Spinner />
						</div>
					) : (
						<TaskActivityTree
							nodes={activity.data?.nodes ?? []}
							onOpenRule={onOpenRule}
						/>
					)}
				</TabsContent>

				{/* ── Thoughts ──────────────────────────────────────────────────── */}
				<TabsContent
					value="runs"
					className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-2.5"
				>
					{runs.isLoading ? (
						<div className="px-3 py-4">
							<Spinner />
						</div>
					) : !runs.data?.length ? (
						<p className="text-base text-muted-foreground">
							No run has opened on this task yet. Assigning it to an agent opens
							exactly one.
						</p>
					) : (
						runs.data.map((run) => (
							<ThoughtBlock
								key={run.id}
								workflowKey={run.workflowKey}
								steps={run.steps}
							/>
						))
					)}
				</TabsContent>
			</Tabs>

			<DetailBlock title="State" subtitle={task.project_key ?? "No project"}>
				<PropertyRow label="status">
					<DetailStatus tone={taskTone(task.status)}>
						{humanStatus(task.status)}
					</DetailStatus>
					{task.status === "review" ? (
						<DetailProse>a person has to accept it</DetailProse>
					) : null}
					{task.blocked_reason && task.status === "blocked" ? (
						<DetailProse>{task.blocked_reason}</DetailProse>
					) : null}
				</PropertyRow>
				<PropertyRow label="assignee">
					{task.assignee_name ?? "unassigned"}
				</PropertyRow>
				<PropertyRow label="depends on">
					{task.depends_on.length
						? `${task.depends_on.length} task${task.depends_on.length === 1 ? "" : "s"}`
						: "nothing"}
				</PropertyRow>
				<PropertyRow label="blocks">
					{task.blocks.length
						? `${task.blocks.length} task${task.blocks.length === 1 ? "" : "s"}`
						: "nothing"}
				</PropertyRow>
				{task.sub_task_ids.length ? (
					<PropertyRow label="sub-tasks">
						{task.sub_task_ids.length}
						<DetailProse>
							this task cannot go to review while one is open
						</DetailProse>
					</PropertyRow>
				) : null}
			</DetailBlock>

			<CardFooter className="shrink-0 flex-wrap gap-2 border-t">
				{canAccept ? (
					<>
						<Button size="sm" onClick={() => mutations.accept.mutate(task.id)}>
							<Check /> Accept
						</Button>
						<Button
							size="sm"
							variant="outline"
							onClick={() => {
								setTab("work");
								setRejecting(true);
							}}
						>
							<Undo2 /> Reject with note
						</Button>
					</>
				) : null}
				{task.status !== "done" && task.status !== "cancelled" ? (
					<>
						<span className="flex-1" />
						<Button
							size="sm"
							variant="ghost"
							onClick={() => {
								setTab("work");
								setReassigning(true);
							}}
						>
							<UserCog /> Reassign
						</Button>
					</>
				) : null}
			</CardFooter>

			<PanelStatusBar
				left={
					<>
						<StatusCrumb active={tab === "work"} onClick={() => setTab("work")}>
							Work
						</StatusCrumb>
						<StatusCrumb active={tab === "runs"} onClick={() => setTab("runs")}>
							Steps ({stepCount})
						</StatusCrumb>
					</>
				}
				middle={
					canAccept
						? [
								<StatusCount key="await" tone="warning">
									awaiting your acceptance
								</StatusCount>,
							]
						: []
				}
				right={canAccept ? "⌘↵ accept" : undefined}
			/>
		</div>
	);
}

/**
 * One run, folded to its summary line with the steps under it — the same shape
 * a settled reply keeps in the session thread (`✻ Ask for 6.2s · 9 of 9
 * steps`), so the two surfaces read as one record seen from two ends.
 */
function ThoughtBlock({
	workflowKey,
	steps,
}: {
	workflowKey: string;
	steps: RunNode[];
}) {
	const [open, setOpen] = useState(true);
	const done = steps.filter((s) => s.status === "succeeded").length;
	const total = new Set(steps.map((s) => s.seq)).size;
	const tokensIn = steps.reduce((n, s) => n + (s.tokensIn ?? 0), 0);
	const tokensOut = steps.reduce((n, s) => n + (s.tokensOut ?? 0), 0);

	return (
		<div className="flex flex-col gap-1">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="flex items-center gap-2 text-left text-base text-muted-foreground hover:text-foreground"
			>
				<span className="select-none text-border" aria-hidden>
					✻
				</span>
				<span className="min-w-0 truncate">
					Ask for {formatDuration(totalDuration(steps))} · {done} of {total}{" "}
					step{total === 1 ? "" : "s"}
					{tokensIn || tokensOut
						? ` · ${tokensIn.toLocaleString()} + ${tokensOut.toLocaleString()} tok`
						: ""}
				</span>
				<span className="shrink-0 text-muted-foreground/70" aria-hidden>
					{open ? "▾" : "▸"}
				</span>
			</button>
			{open ? (
				<>
					<StepList steps={steps} className="pl-3.5" />
					<span className="pl-3.5 font-mono text-base text-muted-foreground">
						{workflowKey}
					</span>
				</>
			) : null}
		</div>
	);
}

/**
 * What came back. The summary is prose, but any number the result carries is
 * lifted into a tile — a reviewer checks the figure first and reads the
 * sentence second, and a paragraph makes them hunt.
 */
function ResultBlock({ task }: { task: Task }) {
	const emitted = task.result?.emitted ?? [];
	const kinds = [...new Set(emitted.map((e) => e.kind))];
	return (
		<div className="space-y-2">
			<div className="flex items-start gap-2 text-base">
				<span className="shrink-0 text-muted-foreground" aria-hidden>
					└
				</span>
				<p className="min-w-0 text-foreground">{task.result?.summary}</p>
			</div>
			{kinds.length ? (
				<div className="flex flex-wrap gap-2">
					{kinds.map((kind) => (
						<MetricTile
							key={kind}
							label={kind}
							value={emitted.filter((e) => e.kind === kind).length}
						/>
					))}
				</div>
			) : null}
		</div>
	);
}

export { DetailPlaceholder };
