/**
 * **Projects** — one icon, one panel, two sections (projects-and-tasks.md PT7).
 *
 * `Projects` over `Todos`. **Projects owns Todos; there is no Todos icon**: a
 * Todo without its project is a to-do list, and the project is the thing it is
 * for. With no project drilled into, the Todos section is every Todo in the
 * Graph — which *is* the **No project** bucket, because a Todo nobody filed is
 * still work somebody wrote. Drill into a project and the section narrows to its
 * Todos, while the projects list keeps its place above (G33).
 *
 * The rail's **Tasks** icon is execution only — `TaskRun`s, `TaskPlan`s and the
 * catalogue, never Todos (PT7 · SR3).
 */

import { useProjectsQuery, useTasksQuery } from "@/hooks/queries/useWork";
import { ProjectsSectionBody } from "@/pages/graphs-detail/features/projects/ProjectsSection";
import { TodosSectionBody } from "@/pages/graphs-detail/features/projects/TodosSection";
import {
	stackSection,
	useStackSectionUi,
} from "@/pages/graphs-detail/shared/StackSection";
import { useProjectsViewPanel } from "@/pages/graphs-detail/shell/useProjectsViewPanel";
import { PanelStack, type PanelStackHandle } from "@invana/ui";
import { FolderOpen, ListTodo, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface ProjectsViewPanelProps {
	username: string;
	graphSlug: string;
	onOpenAgent?: (agentId: string) => void;
	/** A statement on a step row opens that rule's board (RU12). */
	onOpenRule?: (ruleId: string) => void;
	/** Opening the Plan tab is what draws the `plan` canvas (PT13). */
	onOpenPlanCanvas?: (projectKey: string) => void;
	onProjectChange?: (key: string | null) => void;
}

export function ProjectsViewPanel({
	username,
	graphSlug,
	onOpenAgent,
	onOpenRule,
	onOpenPlanCanvas,
	onProjectChange,
}: ProjectsViewPanelProps) {
	const projects = useProjectsViewPanel();
	const ui = useStackSectionUi();
	const [creatingProject, setCreatingProject] = useState(false);
	const [creatingTodo, setCreatingTodo] = useState(false);

	// `PanelStack` reads `defaultSize` at **mount**, so this is the opening split
	// only — after that the column's shape belongs to whoever dragged it (G35).
	const size = (d: "projects" | "todos") =>
		projects.sectionKey === d ? "60%" : "40%";

	// A drill-in is the one thing allowed to override that drag: opening a Todo
	// from a run's trace, or a project from a breadcrumb, has to bring its section
	// back if the reader had collapsed it — otherwise the row lands in a shut
	// section and nothing appears to happen. Watching the drilled-into id as well
	// as the focus is what catches the case where `?section=` never moves and only
	// `&todo=` does (G35).
	const stackRef = useRef<PanelStackHandle>(null);
	const focused =
		projects.sectionKey === "projects" ? projects.projectKey : projects.todoId;
	// `focused` is a trigger, not a value: the effect re-runs when the drill-in
	// moves but never reads it. Dropping it is the bug this wiring exists to fix.
	// biome-ignore lint/correctness/useExhaustiveDependencies: see above.
	useEffect(() => {
		stackRef.current?.expand(projects.sectionKey);
	}, [projects.sectionKey, focused]);

	return (
		<PanelStack
			withHandle
			stackRef={stackRef}
			className="h-full"
			headerHeight={30}
			sections={[
				stackSection(
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
							<ProjectsSectionBody
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
				stackSection(
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
							<TodosSectionBody
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
								onOpenRule={onOpenRule}
							/>
						),
					},
					ui,
				),
			]}
		/>
	);
}

/** `6 projects` — the count the section header carries beside its label. */
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
