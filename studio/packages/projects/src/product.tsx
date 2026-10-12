/**
 * `projects` — the Projects product's `ProductDefinition`: pursue a question
 * and decide it (projects.md).
 *
 * | Rail | Path | Draws |
 * |---|---|---|
 * | Projects | `/projects[/:project]` | the Projects stack on Projects |
 * | My todos | `/projects/todos[/:todo]` | the Projects stack on Todos |
 * | Decisions | `/projects/decisions` | every decision across projects, as a page in `mainSection` with no left column |
 *
 * Projects is the product's root, so a project's key sits right under it, as
 * migration-plan §5 spells it. The levels under the product's route have no
 * element of their own, so moving along the rail never remounts the page. The
 * page itself is the app's product host, which composes every graph product's
 * regions, so the route's element is whatever the app puts in
 * `ProjectsSlotsContext`.
 *
 * **Actions.** `projects.addFinding` keeps an answer as a finding: it opens
 * *Add a finding* with the project and branch to pick, the answer's sentence
 * as the statement and its run as the cite (explorer.md EX-12). Other products
 * ask for it by id and never import this one.
 */
import type { ProductDefinition } from "@invana-studio/core";
import { ErrorPage, type ShellRouteHandle } from "@invana-studio/shell";
import { FolderOpen, Gavel, ListTodo } from "lucide-react";
import type { Params, RouteObject } from "react-router-dom";
import { useProjectsSlots } from "./ProjectsSlots";
import { AddFindingDialog } from "./project/AddFindingDialog";
import { searchProjects } from "./search";

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
	search: searchProjects,
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
			label: "Add to a project",
			run: ({ args, openDialog }) => {
				const { username, graphSlug, runId, statement } = args as {
					username: string;
					graphSlug: string;
					runId: string;
					statement: string;
				};
				openDialog((close) => (
					<AddFindingDialog
						open
						onClose={close}
						username={username}
						graphSlug={graphSlug}
						from="from this answer"
						initial={{ statement, cites: [{ kind: "run", ref: runId }] }}
						evidence={`It keeps this answer's evidence: the run ${runId.slice(0, 8)}, with its query and the records it read.`}
					/>
				));
			},
		},
	},
};
