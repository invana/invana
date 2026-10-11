/**
 * `projects` — the Projects product's `ProductDefinition`: pursue a question
 * and decide it (projects.md).
 *
 * | Rail | Path | Draws |
 * |---|---|---|
 * | Projects | `/projects[/:project]` | the Projects stack on Projects |
 * | My todos | `/projects/todos[/:todo]` | the Projects stack on Todos |
 * | Decisions | `/projects/decisions` | every decision across projects — empty until the engine records them |
 *
 * Projects is the product's root, so a project's key sits right under it, as
 * migration-plan §5 spells it. The levels under the product's route have no
 * element of their own, so moving along the rail never remounts the page. The
 * page itself still lives in the app (today's graph page, which draws every
 * region), so the route's element is whatever the app puts in
 * `ProjectsSlotsContext`.
 *
 * **Actions.** `projects.addFinding` is registered so other products can ask
 * for it by id, and is not available until findings exist — so the Explorer's
 * button stays hidden.
 */
import type { ProductDefinition } from "@invana-studio/core";
import { ErrorPage, type ShellRouteHandle } from "@invana-studio/shell";
import { FolderOpen, Gavel, ListTodo } from "lucide-react";
import type { Params, RouteObject } from "react-router-dom";
import { useProjectsSlots } from "./ProjectsSlots";

function ProjectsRoute() {
	const { Page } = useProjectsSlots();
	return <Page />;
}

/** A level of the trail: a fixed label, or the drill-in's id. */
function level(
	path: string,
	crumb: string | ((params: Params) => string | undefined),
	children?: RouteObject[],
): RouteObject {
	const handle: ShellRouteHandle = { crumb };
	return children
		? { path, handle, children: [{ index: true }, ...children] }
		: { path, handle };
}

export const projects: ProductDefinition = {
	id: "projects",
	name: "Projects",
	tagline: "Pursue and decide",
	icon: FolderOpen,
	scope: "graph",
	landing: "",
	nav: {
		groups: [
			[
				{ id: "projects", label: "Projects", icon: FolderOpen, to: "" },
				{ id: "todos", label: "My todos", icon: ListTodo, to: "todos" },
				{ id: "decisions", label: "Decisions", icon: Gavel, to: "decisions" },
			],
		],
		bottom: [],
	},
	routes: [
		{
			path: "u/:username/:graphSlug/projects",
			// No crumb: the wordmark already reads `Invana Projects`.
			handle: { ownsRegions: true } satisfies ShellRouteHandle,
			element: <ProjectsRoute />,
			errorElement: <ErrorPage />,
			children: [
				{ index: true },
				level("todos", "My todos", [level(":todo", (p) => p.todo)]),
				level("decisions", "Decisions"),
				level(":project", (p) => p.project),
			],
		},
	],
	actions: {
		"projects.addFinding": {
			label: "Add finding",
			available: false,
			// Never invoked while unavailable: `useAction` hands callers nothing.
			run: () => {},
		},
	},
};
