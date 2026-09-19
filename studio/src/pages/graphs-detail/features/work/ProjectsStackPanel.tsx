/**
 * **Projects** — one icon, one panel, two drawers (projects-and-tasks.md PT7).
 *
 * `Projects` over `Todos`. **Projects owns Todos; there is no Todos icon**: a
 * Todo without its project is a to-do list, and the project is the thing it is
 * for. With no project drilled into, the Todos drawer is every Todo in the
 * Graph — which *is* the **No project** bucket, because a Todo nobody filed is
 * still work somebody wrote. Drill into a project and the drawer narrows to its
 * Todos, while the projects list keeps its place above (G33).
 *
 * The rail's **Tasks** icon is execution only — `TaskRun`s, `TaskPlan`s and the
 * catalogue, never Todos (PT7 · SR3).
 */

import { useProjectsQuery, useTasksQuery } from "@/hooks/queries/useWork";
import { ProjectsDrawerBody } from "@/pages/graphs-detail/features/work/ProjectsPanel";
import { TodosDrawerBody } from "@/pages/graphs-detail/features/work/TasksPanel";
import {
	taskDrawerSection,
	useTaskDrawerUi,
} from "@/pages/graphs-detail/shared/TaskDrawer";
import { useProjectsPanel } from "@/pages/graphs-detail/shell/useProjectsPanel";
import { PanelStack, type PanelStackHandle } from "@invana/ui";
import { FolderOpen, ListTodo, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface ProjectsStackPanelProps {
	username: string;
	graphSlug: string;
	onOpenAgent?: (agentId: string) => void;
	/** Opening the Plan tab is what draws the `plan` canvas (PT13). */
	onOpenPlanCanvas?: (projectKey: string) => void;
	onProjectChange?: (key: string | null) => void;
}

export function ProjectsStackPanel({
	username,
	graphSlug,
	onOpenAgent,
	onOpenPlanCanvas,
	onProjectChange,
}: ProjectsStackPanelProps) {
	const projects = useProjectsPanel();
	const ui = useTaskDrawerUi();
	const [creatingProject, setCreatingProject] = useState(false);
	const [creatingTodo, setCreatingTodo] = useState(false);

	// `PanelStack` reads `defaultSize` at **mount**, so this is the opening split
	// only — after that the column's shape belongs to whoever dragged it (G35).
	const size = (d: "projects" | "todos") =>
		projects.drawer === d ? "60%" : "40%";

	// A drill-in is the one thing allowed to override that drag: opening a Todo
	// from a run's trace, or a project from a breadcrumb, has to bring its drawer
	// back if the reader had collapsed it — otherwise the row lands in a shut
	// section and nothing appears to happen. Watching the drilled-into id as well
	// as the focus is what catches the case where `?drawer=` never moves and only
	// `&todo=` does (G35).
	const stackRef = useRef<PanelStackHandle>(null);
	const focused =
		projects.drawer === "projects" ? projects.projectKey : projects.todoId;
	// `focused` is a trigger, not a value: the effect re-runs when the drill-in
	// moves but never reads it. Dropping it is the bug this wiring exists to fix.
	// biome-ignore lint/correctness/useExhaustiveDependencies: see above.
	useEffect(() => {
		stackRef.current?.expand(projects.drawer);
	}, [projects.drawer, focused]);

	return (
		<PanelStack
			withHandle
			stackRef={stackRef}
			className="h-full"
			headerHeight={30}
			sections={[
				taskDrawerSection(
					{
						id: "projects",
						label: "Projects",
						icon: FolderOpen,
						count: <ProjectsCount username={username} graphSlug={graphSlug} />,
						trail: projects.projectKey ?? undefined,
						onBack: () => {
							projects.openProject(null);
							onProjectChange?.(null);
						},
						searchable: true,
						searchPlaceholder: "Search projects",
						headerActions: [
							{
								key: "new",
								name: "New project",
								icon: Plus,
								onClick: () => setCreatingProject((v) => !v),
							},
						],
						defaultSize: size("projects"),
						children: ({ search }) => (
							<ProjectsDrawerBody
								username={username}
								graphSlug={graphSlug}
								search={search}
								creating={creatingProject}
								onCreating={setCreatingProject}
								selectedProjectKey={projects.projectKey}
								onSelectProject={(key) => {
									projects.openProject(key);
									onProjectChange?.(key);
								}}
								selectedTaskId={projects.todoId}
								onSelectTask={projects.openTodo}
								onOpenTask={projects.openTodo}
								onOpenAgent={onOpenAgent}
								onTabChange={(tab) => {
									if (tab === "plan" && projects.projectKey)
										onOpenPlanCanvas?.(projects.projectKey);
								}}
							/>
						),
					},
					ui,
				),
				taskDrawerSection(
					{
						id: "todos",
						label: "Todos",
						icon: ListTodo,
						count: (
							<TodosCount
								username={username}
								graphSlug={graphSlug}
								projectKey={projects.projectKey}
							/>
						),
						trail: projects.todoId ?? undefined,
						onBack: () => projects.openTodo(null),
						searchable: true,
						searchPlaceholder: "Search todos",
						headerActions: [
							{
								key: "new",
								name: "New todo",
								icon: Plus,
								onClick: () => setCreatingTodo((v) => !v),
							},
						],
						defaultSize: size("todos"),
						children: ({ search }) => (
							<TodosDrawerBody
								username={username}
								graphSlug={graphSlug}
								search={search}
								creating={creatingTodo}
								onCreating={setCreatingTodo}
								selectedTaskId={projects.todoId}
								onSelectTask={projects.openTodo}
								projectKey={projects.projectKey}
								onProjectContext={onProjectChange}
								onOpenAgent={onOpenAgent}
							/>
						),
					},
					ui,
				),
			]}
		/>
	);
}

/** `6 projects` — the count the drawer header carries beside its label. */
function ProjectsCount({
	username,
	graphSlug,
}: {
	username: string;
	graphSlug: string;
}) {
	const list = useProjectsQuery(username, graphSlug);
	const n = list.data?.items?.length ?? 0;
	if (!n) return null;
	return <>{n}</>;
}

/**
 * `12 · 3 in review`. With no project drilled into this counts every Todo in
 * the Graph — the *No project* bucket included (PT7).
 */
function TodosCount({
	username,
	graphSlug,
	projectKey,
}: {
	username: string;
	graphSlug: string;
	projectKey: string | null;
}) {
	const list = useTasksQuery(username, graphSlug, {
		project: projectKey ?? undefined,
	});
	const items = list.data?.items ?? [];
	if (items.length === 0) return null;
	const review = items.filter((t) => t.status === "review").length;
	return <>{review ? `${items.length} · ${review} in review` : items.length}</>;
}
