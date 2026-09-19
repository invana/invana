/**
 * Projects, and the **Plan** tab (docs/for-developers/modules/work/spec.md, § 6.2a — journeys J1 and J1a).
 *
 * The Plan tab is the panel half of the `plan` canvas: the same one call feeds
 * both, because a list and a DAG disagreeing about what comes next is worse
 * than either alone.
 *
 * **Order is derived, never typed.** There is no rank field and no
 * drag-to-reorder in the list — two sources of order disagree, and the
 * dependency graph is the one the agents obey. What the row shows instead is
 * the *reason* for its position: `after #1`, `waits on #4, #5`.
 *
 * The project detail is four tabs, and each answers a different question about
 * the same six tasks: **Tasks** what is there, **Plan** what order it goes in,
 * **Activity** what has happened, **Details** what the project *is* — and the
 * only place it is acted on. They are tabs rather than four panels because
 * switching between them is how a project is read.
 *
 * *Who is on it* is not among them: the Staffed strip under the Todos answers
 * that beside the assignments it is derived from (PT14). Nor is there a footer
 * — a row of buttons acting on four things the tab above was not showing. Each
 * lives where its subject is now (PT13).
 *
 * Above the tabs sits the heading — the name, who wrote it and when, and the
 * purpose clamped to three lines. There is no second `← Projects` row: the
 * panel breadcrumb is the only way back, and the row it replaced cost the
 * project its title (PT8 · PT9, docs/for-developers/modules/work/features/projects-and-tasks.md).
 */

import {
	useProjectMutations,
	useProjectPlanQuery,
	useProjectsQuery,
	useRunsQuery,
	useTasksQuery,
} from "@/hooks/queries/useWork";
import {
	DetailBlock,
	DetailPlaceholder,
	DetailProse,
	DetailStatus,
} from "@/pages/graphs-detail/shared/DetailRows";
import { ListRow } from "@/pages/graphs-detail/shared/ListPanel";
import { WorkRow } from "@/pages/graphs-detail/shared/WorkRow";
import { humanStatus, taskTone } from "@/pages/graphs-detail/shared/statusTone";
import type {
	PlanTask,
	Project,
	ProjectUpdate,
	Task,
	TaskRunSummary,
} from "@/types/work";
import { ClampedText } from "@/ui/ClampedText";
import { FilterSelect } from "@/ui/FilterSelect";
import { PanelStatusBar, StatusCount, StatusCrumb } from "@/ui/PanelStatusBar";
import { PrincipalChip } from "@/ui/PrincipalChip";
import { Input, Label, Textarea } from "@invana/forms";
import {
	Button,
	FilterBar,
	PropertyList,
	PropertyRow,
	Spinner,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	cn,
} from "@invana/ui";
import { Archive, ArchiveRestore, Pencil } from "lucide-react";
import { useMemo, useState } from "react";

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

interface Props {
	username: string;
	graphSlug: string;
	/** The drawer header's live search string (G33) — this body owns no chrome. */
	search: string;
	/** Opens the new-project form, which the drawer header's `+` toggles. */
	creating: boolean;
	onCreating: (v: boolean) => void;
	selectedProjectKey: string | null;
	onSelectProject: (key: string | null) => void;
	/** The task selected on the Plan canvas, or in the list. */
	selectedTaskId: string | null;
	onSelectTask: (id: string | null) => void;
	onOpenTask?: (taskId: string) => void;
	/** Open an agent's own surface from a `Staffed` chip. */
	onOpenAgent?: (agentId: string) => void;
	/** Which tab the canvas half is showing — mirrored in the status bar. */
	onTabChange?: (tab: ProjectTab) => void;
}

export type ProjectTab = "tasks" | "plan" | "activity" | "details";

export function ProjectsDrawerBody({
	username,
	graphSlug,
	search,
	creating,
	onCreating,
	selectedProjectKey,
	onSelectProject,
	selectedTaskId,
	onSelectTask,
	onOpenTask,
	onOpenAgent,
	onTabChange,
}: Props) {
	const [name, setName] = useState("");

	const projects = useProjectsQuery(username, graphSlug);
	const mutations = useProjectMutations(username, graphSlug);
	const plan = useProjectPlanQuery(
		username,
		graphSlug,
		selectedProjectKey ?? undefined,
	);
	// The Tasks tab needs the full task rows — assignee kind, sub-tasks, the
	// blocked reason — which the plan projection deliberately drops.
	const tasks = useTasksQuery(username, graphSlug, {
		project: selectedProjectKey ?? undefined,
		enabled: selectedProjectKey !== null,
	});
	// Where each task's run has got to — `Execute 5/7`. One list for the whole
	// graph, indexed by task, rather than a request per row.
	const runs = useRunsQuery(
		username,
		graphSlug,
		{ limit: 200 },
		selectedProjectKey !== null,
	);

	const items = projects.data?.items ?? [];
	const selected = items.find((p) => p.key === selectedProjectKey) ?? null;
	// Newest run per task: the endpoint returns newest-first, so the first hit
	// wins and a rethink does not resurrect the previous run's position.
	const runByTask = useMemo(() => {
		const byTask = new Map<string, TaskRunSummary>();
		for (const run of runs.data?.items ?? [])
			if (run.task_id && !byTask.has(run.task_id)) byTask.set(run.task_id, run);
		return byTask;
	}, [runs.data]);
	const planTask =
		plan.data?.tasks.find((t) => t.id === selectedTaskId) ?? null;

	return (
		<div className="flex h-full min-h-0 flex-col">
			{creating && !selected ? (
				<form
					className="flex gap-1.5 border-b p-2"
					onSubmit={(e) => {
						e.preventDefault();
						if (!name.trim()) return;
						mutations.create.mutate(
							{ name: name.trim() },
							{
								onSuccess: (project) => {
									setName("");
									onCreating(false);
									onSelectProject(project.key);
								},
							},
						);
					}}
				>
					<input
						ref={focusOnMount}
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="Project name"
						className="min-w-0 flex-1 rounded-sm border bg-background px-2 py-1.5 text-sm"
					/>
					<Button type="submit" size="sm" className="h-7 text-sm">
						Create
					</Button>
				</form>
			) : null}

			{selected ? (
				<ProjectDetail
					project={selected}
					onUpdate={(data, onDone) =>
						mutations.update.mutate(
							{ key: selected.key, data },
							{ onSuccess: () => onDone?.() },
						)
					}
					isSaving={mutations.update.isPending}
					plan={plan.data}
					tasks={tasks.data?.items ?? []}
					isLoading={plan.isLoading}
					selectedTaskId={selectedTaskId}
					onSelectTask={onSelectTask}
					onOpenTask={onOpenTask}
					onOpenAgent={onOpenAgent}
					runByTask={runByTask}
					onTabChange={onTabChange}
					planTask={planTask}
					onArchive={() =>
						mutations.update.mutate({
							key: selected.key,
							data: { status: "archived" },
						})
					}
					onUnarchive={() =>
						mutations.update.mutate({
							key: selected.key,
							data: { status: "active" },
						})
					}
				/>
			) : (
				<>
					<div className="flex-1 overflow-y-auto">
						{projects.isLoading ? (
							<div className="p-4">
								<Spinner />
							</div>
						) : items.length === 0 ? (
							<p className="p-4 text-sm text-muted-foreground">
								No projects yet. A task can live without one — a project is how
								related work is organised, not a requirement.
							</p>
						) : (
							items
								.filter((p) =>
									p.name.toLowerCase().includes(search.toLowerCase()),
								)
								.map((project) => (
									<ListRow
										key={project.id}
										active={project.key === selectedProjectKey}
										onClick={() => onSelectProject(project.key)}
										// Archived rides on the name, not in the counts (PT12):
										// it is the fact that changes what the row means, and a
										// state folded into a sentence of counts is read last.
										title={
											project.status === "archived" ? (
												<span className="flex min-w-0 items-center gap-1.5">
													<span className="truncate">{project.name}</span>
													<DetailStatus className="shrink-0">
														archived
													</DetailStatus>
												</span>
											) : (
												project.name
											)
										}
										subtitle={
											<span>
												{project.open_task_count} open of {project.task_count}{" "}
												task
												{project.task_count === 1 ? "" : "s"}
											</span>
										}
									/>
								))
						)}
					</div>
					<PanelStatusBar
						left={<StatusCrumb active>Projects</StatusCrumb>}
						middle={[`${items.length} project${items.length === 1 ? "" : "s"}`]}
						right="⌘N new project"
					/>
				</>
			)}
		</div>
	);
}

function ProjectDetail({
	project,
	plan,
	tasks,
	isLoading,
	selectedTaskId,
	planTask,
	runByTask,
	onSelectTask,
	onOpenTask,
	onOpenAgent,
	onArchive,
	onUnarchive,
	onUpdate,
	isSaving,
	onTabChange,
}: {
	project: Project;
	plan:
		| {
				tasks: PlanTask[];
				critical_path: string[];
				edges?: { source: string; target: string }[];
		  }
		| undefined;
	tasks: Task[];
	isLoading: boolean;
	selectedTaskId: string | null;
	planTask: PlanTask | null;
	runByTask: Map<string, TaskRunSummary>;
	onSelectTask: (id: string | null) => void;
	onOpenTask?: (id: string) => void;
	onOpenAgent?: (id: string) => void;
	onArchive: () => void;
	onUnarchive: () => void;
	onUpdate: (data: ProjectUpdate, onDone?: () => void) => void;
	isSaving: boolean;
	onTabChange?: (tab: ProjectTab) => void;
}) {
	const [tab, setTab] = useState<ProjectTab>("tasks");
	const [statusFilter, setStatusFilter] = useState("");
	const [assigneeFilter, setAssigneeFilter] = useState("");

	const planTasks = plan?.tasks ?? [];
	const byId = useMemo(
		() => new Map(planTasks.map((t) => [t.id, t])),
		[planTasks],
	);
	const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

	/**
	 * Everyone with a task here, agents first. This feeds the `Staffed` strip and
	 * the assignee filter — one derivation, because "who is on this project" must
	 * not disagree between two places on the same screen.
	 */
	const staff = useMemo(() => {
		const seen = new Map<
			string,
			{ id: string; name: string; kind: "agent" | "user"; taskIds: string[] }
		>();
		for (const task of planTasks) {
			if (!task.assignee_id || !task.assignee_kind) continue;
			const entry = seen.get(task.assignee_id) ?? {
				id: task.assignee_id,
				name: task.assignee_name ?? task.assignee_id,
				kind: task.assignee_kind,
				taskIds: [],
			};
			entry.taskIds.push(task.id);
			seen.set(task.assignee_id, entry);
		}
		return [...seen.values()].sort((a, b) =>
			a.kind === b.kind
				? a.name.localeCompare(b.name)
				: a.kind === "agent"
					? -1
					: 1,
		);
	}, [planTasks]);

	const assigneeOptions = staff.map((s) => ({ value: s.id, label: s.name }));

	const visible = planTasks.filter(
		(t) =>
			(!statusFilter || t.status === statusFilter) &&
			(!assigneeFilter || t.assignee_id === assigneeFilter),
	);

	const running = planTasks.filter((t) => t.status === "in_progress").length;
	// Counted apart, because they need different things from you: `needs_input`
	// is an agent waiting on an answer, `blocked` is a dependency that has not
	// landed. Folding them into one number would send you looking for a question
	// nobody asked.
	const asking = planTasks.filter((t) => t.status === "needs_input").length;
	const blocked = planTasks.filter((t) => t.status === "blocked").length;
	const reviewing = planTasks.filter((t) => t.status === "review").length;
	const critical = plan?.critical_path.length ?? 0;

	const setTabAndNotify = (next: ProjectTab) => {
		setTab(next);
		onTabChange?.(next);
	};

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			{/*
			 * The heading: the project, not the way back (PT8). The panel
			 * breadcrumb above already says `Projects › hey` and is clickable, so a
			 * second `← Projects` row spent the one line the title wanted.
			 */}
			<div className="shrink-0 border-b px-3 pb-2 pt-2">
				<div className="flex items-start gap-2">
					<h2 className="min-w-0 flex-1 text-base font-semibold leading-tight text-foreground">
						{project.name}
					</h2>
					{project.status === "archived" ? (
						<DetailStatus>archived</DetailStatus>
					) : null}
				</div>
				<div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
					<span>created by</span>
					<PrincipalChip
						name={project.created_by_name ?? "unknown"}
						kind={project.created_by_kind === "agent" ? "agent" : "user"}
					/>
					<span title={new Date(project.created_at).toLocaleString()}>
						· {new Date(project.created_at).toLocaleDateString()}
					</span>
				</div>
				{/* The goal, in the author's words — the thing every agent on this
				    project plans from, so it sits above the tabs rather than inside
				    one, and clamped so the Todos under it survive (PT9). */}
				{project.description ? (
					<ClampedText className="mt-1.5 text-sm text-foreground">
						{project.description}
					</ClampedText>
				) : (
					<button
						type="button"
						onClick={() => setTabAndNotify("details")}
						className="mt-1.5 text-sm text-muted-foreground underline-offset-2 hover:underline"
					>
						No purpose written yet — add one
					</button>
				)}
			</div>

			<Tabs
				size="sm"
				value={tab}
				onValueChange={(v) => setTabAndNotify(v as ProjectTab)}
				className="flex min-h-0 flex-1 flex-col"
			>
				<TabsList className="w-full justify-start gap-1 overflow-x-auto px-3">
					<TabsTrigger value="tasks">Tasks ({planTasks.length})</TabsTrigger>
					<TabsTrigger value="plan">Plan</TabsTrigger>
					<TabsTrigger value="activity">Activity</TabsTrigger>
					<TabsTrigger value="details">Details</TabsTrigger>
				</TabsList>

				{/* ── Tasks ─────────────────────────────────────────────────────── */}
				<TabsContent
					value="tasks"
					className="flex min-h-0 flex-1 flex-col overflow-hidden"
				>
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

					<div className="min-h-0 flex-1 overflow-y-auto">
						{isLoading ? (
							<div className="p-4">
								<Spinner />
							</div>
						) : visible.length === 0 ? (
							<p className="p-4 text-sm text-muted-foreground">
								{planTasks.length
									? "No task matches those filters."
									: "No tasks in this project yet."}
							</p>
						) : (
							visible.map((task) => {
								const full = taskById.get(task.id);
								return (
									<WorkRow
										key={task.id}
										active={task.id === selectedTaskId}
										onClick={() =>
											onSelectTask(task.id === selectedTaskId ? null : task.id)
										}
										tone={taskTone(task.status)}
										live={task.status === "in_progress"}
										indent={full?.parent_id ? 1 : 0}
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
												<span className="truncate">
													{taskProgress(full, task, runByTask.get(task.id))}
												</span>
											</>
										}
									/>
								);
							})
						)}
					</div>

					{staff.length ? (
						<div className="flex shrink-0 flex-wrap items-center gap-1.5 border-t px-4 py-2">
							<span className="text-sm text-muted-foreground">Staffed</span>
							{staff.map((s) => (
								<PrincipalChip
									key={s.id}
									name={s.name}
									kind={s.kind}
									title={`${s.taskIds.length} task${s.taskIds.length === 1 ? "" : "s"}`}
									onClick={
										s.kind === "agent" && onOpenAgent
											? () => onOpenAgent(s.id)
											: undefined
									}
								/>
							))}
						</div>
					) : null}
				</TabsContent>

				{/* ── Plan ──────────────────────────────────────────────────────── */}
				<TabsContent
					value="plan"
					className="flex min-h-0 flex-1 flex-col overflow-hidden"
				>
					{/*
					 * The order control states the rule rather than offering a choice
					 * that does not exist: dependencies first, then due date. Anything
					 * else would put the list and the agents' own order in conflict.
					 */}
					<FilterBar
						summary={critical ? `critical path: ${critical}` : undefined}
					>
						<span className="inline-flex h-[22px] items-center rounded-full border border-border px-2.5 text-sm text-muted-foreground">
							order: dependencies
						</span>
						<span className="text-sm text-muted-foreground/80">
							then due date
						</span>
					</FilterBar>

					<div className="min-h-0 flex-1 overflow-y-auto">
						{isLoading ? (
							<div className="p-4">
								<Spinner />
							</div>
						) : planTasks.length === 0 ? (
							<p className="p-4 text-sm text-muted-foreground">
								No tasks in this project yet.
							</p>
						) : (
							<ol>
								{planTasks.map((task) => (
									<li key={task.id}>
										<button
											type="button"
											onClick={() =>
												onSelectTask(
													task.id === selectedTaskId ? null : task.id,
												)
											}
											className={cn(
												"flex w-full items-start gap-2 px-3 py-1.5 text-left hover:bg-accent",
												task.id === selectedTaskId && "bg-accent",
											)}
										>
											{/* The wave number in the gutter: tasks sharing one can
											    run in parallel, and waves run left to right. */}
											<span
												className="mt-px w-5 shrink-0 text-right text-sm tabular-nums text-muted-foreground"
												title={`Wave ${task.wave}`}
											>
												{task.wave}
											</span>
											<span className="min-w-0 flex-1">
												<span className="flex items-center gap-1.5">
													<span className="truncate text-sm">{task.title}</span>
													{task.critical ? (
														<span
															className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
															title="On the critical path"
														/>
													) : null}
												</span>
												<span className="block truncate text-sm text-muted-foreground">
													{subline(task, byId)}
												</span>
											</span>
											<DetailStatus tone={taskTone(task.status)}>
												{humanStatus(task.status)}
											</DetailStatus>
										</button>
									</li>
								))}
							</ol>
						)}
					</div>
				</TabsContent>

				{/* ── Activity ──────────────────────────────────────────────────── */}
				<TabsContent
					value="activity"
					className="min-h-0 flex-1 overflow-y-auto"
				>
					{/*
					 * A project's activity is its tasks' state changes in time order.
					 * Per-step detail belongs to one task, and lives in that task's own
					 * Activity tab — repeating it here would be a log dump, not a
					 * project's story.
					 */}
					{planTasks.length === 0 ? (
						<p className="p-4 text-sm text-muted-foreground">
							Nothing has happened on this project yet.
						</p>
					) : (
						[...tasks]
							.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
							.map((task) => (
								<WorkRow
									key={task.id}
									tone={taskTone(task.status)}
									live={task.status === "in_progress"}
									onClick={onOpenTask ? () => onOpenTask(task.id) : undefined}
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
											) : null}
											<span className="truncate">
												{new Date(task.updated_at).toLocaleString()}
											</span>
										</>
									}
								/>
							))
					)}
				</TabsContent>

				{/* ── Details ───────────────────────────────────────────────────── */}
				<TabsContent value="details" className="min-h-0 flex-1 overflow-y-auto">
					<ProjectDetailsTab
						project={project}
						onUpdate={onUpdate}
						onArchive={onArchive}
						onUnarchive={onUnarchive}
						isSaving={isSaving}
					/>
				</TabsContent>
			</Tabs>

			{planTask ? (
				<PlanTaskDetail task={planTask} plan={plan} onOpenTask={onOpenTask} />
			) : (
				<DetailPlaceholder hint="Pick a task — here or on the Plan canvas — to see what it waits on and what it blocks." />
			)}

			<PanelStatusBar
				left={
					<>
						<StatusCrumb
							active={tab === "tasks"}
							onClick={() => setTabAndNotify("tasks")}
						>
							Tasks
						</StatusCrumb>
						<StatusCrumb
							active={tab === "plan"}
							onClick={() => setTabAndNotify("plan")}
						>
							Plan
						</StatusCrumb>
					</>
				}
				middle={[
					...(running
						? [
								<StatusCount key="r" tone="info">
									{running} running
								</StatusCount>,
							]
						: []),
					...(asking
						? [
								<StatusCount key="a" tone="warning">
									{asking} needs input
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
					...(blocked
						? [
								<StatusCount key="b" tone="warning">
									{blocked} blocked
								</StatusCount>,
							]
						: []),
				]}
				// No `⌘N new task` here any more: the footer that offered it is gone,
				// and a hint for a control the panel does not have is worse than none.
				right={tab === "plan" ? "drag to link" : undefined}
			/>
		</div>
	);
}

/**
 * **Details** — what the project *is*, and the only place it is edited (PT10).
 *
 * Read mode is the detail grammar: labelled rows of fact, no containers, so
 * nothing reads as a disabled form. `Edit` swaps the two fields that are
 * *authored* — name and purpose — for real inputs; key, creator and the
 * timestamps stay rows, because they are records of what happened and there is
 * nothing to type into them.
 *
 * In place rather than in a dialog: a modal over a 400px panel covers the thing
 * being edited, and the purpose is written while looking at the Todos it is
 * meant to explain.
 */
function ProjectDetailsTab({
	project,
	onUpdate,
	onArchive,
	onUnarchive,
	isSaving,
}: {
	project: Project;
	onUpdate: (data: ProjectUpdate, onDone?: () => void) => void;
	onArchive: () => void;
	onUnarchive: () => void;
	isSaving: boolean;
}) {
	const [editing, setEditing] = useState(false);
	const [name, setName] = useState(project.name);
	const [description, setDescription] = useState(project.description);

	const start = () => {
		setName(project.name);
		setDescription(project.description);
		setEditing(true);
	};

	if (editing) {
		return (
			<form
				className="flex flex-col gap-3 p-3"
				onSubmit={(e) => {
					e.preventDefault();
					if (!name.trim()) return;
					onUpdate({ name: name.trim(), description: description.trim() }, () =>
						setEditing(false),
					);
				}}
			>
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="project-name">Name</Label>
					<Input
						id="project-name"
						ref={focusOnMount}
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="Project name"
					/>
				</div>
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="project-purpose">Purpose</Label>
					<Textarea
						id="project-purpose"
						rows={6}
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						placeholder="What this project is for — the goal every agent on it plans from."
					/>
				</div>
				<div className="flex items-center gap-2">
					<Button type="submit" size="sm" disabled={isSaving || !name.trim()}>
						{isSaving ? "Saving…" : "Save"}
					</Button>
					<Button
						type="button"
						size="sm"
						variant="ghost"
						onClick={() => setEditing(false)}
					>
						Cancel
					</Button>
				</div>
			</form>
		);
	}

	return (
		<div className="flex flex-col gap-2.5 p-3">
			<PropertyList labelWidth={92}>
				<PropertyRow label="key" mono>
					{project.key}
				</PropertyRow>
				<PropertyRow label="purpose">
					{project.description ? (
						<span className="whitespace-pre-line">{project.description}</span>
					) : (
						<span className="text-muted-foreground">
							No purpose written yet
						</span>
					)}
				</PropertyRow>
				<PropertyRow label="status">
					<DetailStatus tone={project.status === "archived" ? "muted" : "info"}>
						{project.status}
					</DetailStatus>
					{project.status === "archived" ? (
						<DetailProse>
							its tasks are read-only until it is unarchived
						</DetailProse>
					) : null}
				</PropertyRow>
				<PropertyRow label="created by">
					<PrincipalChip
						name={project.created_by_name ?? "unknown"}
						kind={project.created_by_kind === "agent" ? "agent" : "user"}
					/>
				</PropertyRow>
				<PropertyRow label="created">
					{new Date(project.created_at).toLocaleString()}
				</PropertyRow>
				<PropertyRow label="updated">
					{new Date(project.updated_at).toLocaleString()}
				</PropertyRow>
				<PropertyRow label="tasks">
					{project.open_task_count} open of {project.task_count}
				</PropertyRow>
			</PropertyList>
			{/*
			 * The project's own actions, with the project's own state (PT13). They
			 * were a footer under every tab, acting on something the tab above was
			 * not showing.
			 */}
			<div className="flex flex-wrap items-center gap-2">
				<Button
					size="sm"
					variant="outline"
					disabled={project.status === "archived"}
					title={
						project.status === "archived"
							? "An archived project is frozen — unarchive it to edit its name and purpose"
							: "Edit the name and purpose"
					}
					onClick={start}
				>
					<Pencil /> Edit
				</Button>
				{project.status === "archived" ? (
					<Button
						size="sm"
						variant="ghost"
						title="Move it back to active — its tasks become writable again"
						onClick={onUnarchive}
					>
						<ArchiveRestore /> Unarchive
					</Button>
				) : (
					<Button
						size="sm"
						variant="ghost"
						title="Freeze it — its tasks become read-only, and it keeps its place in the list"
						onClick={onArchive}
					>
						<Archive /> Archive
					</Button>
				)}
			</div>
		</div>
	);
}

/**
 * The subline that says *how far along*. A task an agent is running shows the
 * step it is on; anything else shows the fact that explains its status. It is
 * never a percentage — a plan can replan, and a bar that goes backwards is
 * worse than no bar.
 */
function taskProgress(
	full: Task | undefined,
	task: PlanTask,
	run: TaskRunSummary | undefined,
): string {
	const bits: string[] = [];
	// A running task says where its plan has got to — the hi-fi's `Execute 5/7`.
	// A *position*, never a percentage: a plan can replan, and a bar that goes
	// backwards is worse than no bar.
	if (run?.step_label && run.steps_total)
		bits.push(`${run.step_label} ${run.steps_done}/${run.steps_total}`);
	if (task.status === "needs_input" && full?.blocked_reason)
		bits.push(`asked: ${full.blocked_reason}`);
	else if (task.status === "blocked" && full?.blocked_reason)
		bits.push(full.blocked_reason);
	else if (task.status === "review") bits.push("served · awaiting acceptance");
	else if (task.status === "open") bits.push("not started");
	else if (task.due_at)
		bits.push(`due ${new Date(task.due_at).toLocaleDateString()}`);
	if (full?.sub_task_ids.length)
		bits.push(
			`${full.sub_task_ids.length} child${full.sub_task_ids.length === 1 ? "" : "ren"}`,
		);
	return bits.length ? `· ${bits.join(" · ")}` : "";
}

/**
 * `after #1` / `waits on #4, #5` — the reason for the row's position.
 *
 * The two are **different facts**, and the hi-fi is careful about which it
 * shows: `after #1` is provenance — the dependency is satisfied and this task
 * is free to run — while `waits on #4, #5` is a state, and the task is stuck.
 * Naming the wave instead ("after wave 1") answers neither: it tells you the
 * column the card is in, which you can already see.
 */
function subline(task: PlanTask, byId: Map<string, PlanTask>): string {
	const bits: string[] = [];
	if (task.assignee_name) bits.push(task.assignee_name);
	if (task.due_at)
		bits.push(
			new Date(task.due_at).toLocaleDateString(undefined, { weekday: "short" }),
		);

	const deps = task.blocked_by
		.map((id) => byId.get(id))
		.filter(Boolean) as PlanTask[];
	const numbers = deps.map((d) => `#${d.order}`).join(", ");
	const unmet = deps.filter(
		(d) => d.status !== "done" && d.status !== "cancelled",
	);

	if (!deps.length) bits.push(task.wave > 1 ? "ready" : "no dependencies");
	else if (unmet.length)
		bits.push(`waits on ${unmet.map((d) => `#${d.order}`).join(", ")}`);
	else bits.push(`after ${numbers}`);

	// The one thing that outranks position on this row: an agent is holding,
	// and the hold is yours to clear.
	if (task.status === "needs_input") bits.push("asked a question");
	return bits.join(" · ");
}

function PlanTaskDetail({
	task,
	plan,
	onOpenTask,
}: {
	task: PlanTask;
	plan:
		| { tasks: PlanTask[]; edges?: { source: string; target: string }[] }
		| undefined;
	onOpenTask?: (id: string) => void;
}) {
	const byId = new Map((plan?.tasks ?? []).map((t) => [t.id, t]));
	const blocks = (plan?.edges ?? [])
		.filter((e) => e.source === task.id)
		.map((e) => byId.get(e.target))
		.filter(Boolean) as PlanTask[];

	return (
		<DetailBlock title={task.title} subtitle={`wave ${task.wave}`}>
			<PropertyRow label="status">
				<DetailStatus tone={taskTone(task.status)}>
					{humanStatus(task.status)}
				</DetailStatus>
			</PropertyRow>
			<PropertyRow label="assignee">
				{task.assignee_name ?? "unassigned"}
				{task.assignee_kind === "agent" ? (
					<DetailProse>an agent</DetailProse>
				) : null}
			</PropertyRow>
			<PropertyRow label="depends on">
				{task.blocked_by.length
					? task.blocked_by
							.map((id) => {
								const dep = byId.get(id);
								if (!dep) return id;
								return `#${dep.order} ${dep.title}${dep.status === "done" ? " ✓" : ""}`;
							})
							.join(", ")
					: "nothing"}
			</PropertyRow>
			<PropertyRow label="blocks">
				{blocks.length
					? blocks.map((b) => `#${b.order} ${b.title}`).join(", ")
					: "nothing"}
			</PropertyRow>
			<PropertyRow label="when done">
				{blocks.length ? (
					<>
						{blocks.map((b) => `#${b.order}`).join(" and ")} start
						{blocks.length === 1 ? "s" : ""} automatically
						<DetailProse>
							their agents are assigned and waiting, and the trace says why
						</DetailProse>
					</>
				) : (
					<>nothing waits on it</>
				)}
			</PropertyRow>
			{task.critical ? (
				<PropertyRow label="critical">
					on the longest chain
					<DetailProse>slipping this slips the project</DetailProse>
				</PropertyRow>
			) : null}
			{onOpenTask ? (
				<Button
					size="sm"
					variant="outline"
					className="mt-2.5 h-7 text-sm"
					onClick={() => onOpenTask(task.id)}
				>
					Open
				</Button>
			) : null}
		</DetailBlock>
	);
}
