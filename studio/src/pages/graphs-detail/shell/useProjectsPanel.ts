import { useDrawerStack } from "@/pages/graphs-detail/shell/useDrawerStack";
import { useCallback } from "react";

// **Projects owns Todos** (projects-and-tasks.md PT7). A Todo without its
// project is a to-do list, and the project is the thing it is for — so the
// panel is a stack of two drawers, `Projects` over `Todos`, the same shape the
// Tasks panel takes (G33). With no project selected the Todos drawer is every
// Todo in the Graph, which is the *No project* bucket: a Todo nobody filed is
// still work somebody wrote.
//
// The rail's **Tasks** icon is execution only — `TaskRun`s, `TaskPlan`s and the
// catalogue, never Todos (PT7 · SR3).
export type ProjectsDrawer = "projects" | "todos";

export const PROJECTS_DRAWERS: readonly ProjectsDrawer[] = [
	"projects",
	"todos",
];

const PROJECTS_DETAIL_PARAM: Record<ProjectsDrawer, string> = {
	projects: "project",
	todos: "todo",
};

/**
 * URL-backed state for the Projects panel's two drawers.
 *
 * - `drawer` — which drawer holds the height. Defaults to `projects`.
 * - `projectKey` · `todoId` — what is drilled into, per drawer.
 * - `openProject` / `openTodo` — drill in; `null` goes back to the list.
 */
export function useProjectsPanel() {
	const stack = useDrawerStack<ProjectsDrawer>({
		drawers: PROJECTS_DRAWERS,
		detailParam: PROJECTS_DETAIL_PARAM,
	});

	const openProject = useCallback(
		(key: string | null) => stack.open("projects", key),
		[stack.open],
	);
	const openTodo = useCallback(
		(id: string | null) => stack.open("todos", id),
		[stack.open],
	);

	return {
		drawer: stack.drawer,
		focus: stack.focus,
		projectKey: stack.detail.projects,
		todoId: stack.detail.todos,
		openProject,
		openTodo,
	};
}
