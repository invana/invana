import { useStackSections } from "@/pages/graphs-detail/shell/useStackSections";
import { useCallback } from "react";

// **Projects owns Todos** (projects-and-tasks.md PT7). A Todo without its
// project is a to-do list, and the project is the thing it is for — so the
// panel is a stack of two sections, `Projects` over `Todos`, the same shape the
// Tasks panel takes (G33). With no project selected the Todos section is every
// Todo in the Graph, which is the *No project* bucket: a Todo nobody filed is
// still work somebody wrote.
//
// The rail's **Tasks** icon is execution only — `TaskRun`s, `TaskPlan`s and the
// catalogue, never Todos (PT7 · SR3).
export type ProjectsSectionKey = "projects" | "todos";

export const PROJECTS_SECTION_KEYS: readonly ProjectsSectionKey[] = [
	"projects",
	"todos",
];

const PROJECTS_DETAIL_PARAM: Record<ProjectsSectionKey, string> = {
	projects: "project",
	todos: "todo",
};

/**
 * URL-backed state for the Projects panel's two sections.
 *
 * - `sectionKey` — which section holds the height. Defaults to `projects`.
 * - `projectKey` · `todoId` — what is drilled into, per section.
 * - `openProject` / `openTodo` — drill in; `null` goes back to the list.
 */
export function useProjectsViewPanel() {
	const stack = useStackSections<ProjectsSectionKey>({
		sectionKeys: PROJECTS_SECTION_KEYS,
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
		sectionKey: stack.sectionKey,
		focus: stack.focus,
		projectKey: stack.detail.projects,
		todoId: stack.detail.todos,
		openProject,
		openTodo,
	};
}
