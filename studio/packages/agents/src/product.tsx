/**
 * `agents` — the Agents product's `ProductDefinition`: build, tune and watch
 * the agents that do the legwork (agents.md).
 *
 * The rail is three groups — the fleet, what it runs on, and its settings at
 * the bottom:
 *
 * | Rail | Path | Draws |
 * |---|---|---|
 * | Overview | `/agents/overview` | page: what broke, waits, slowed or changed |
 * | Agents | `/agents/agents[/:agent]` | the Agents panel |
 * | Skills | `/agents/skills` | the skills an agent may be offered |
 * | Library | `/agents/library[/:plan]` · `/agents/library/templates[/:template]` | Plans over Templates |
 * | Plugins | `/agents/plugins[/tasks/:entry]` | the plugin registry over the task catalogue |
 * | LLMs | `/agents/llms[/:provider]` | page: the model versions offered and who pins them; an endpoint in a sheet |
 * | Performance | `/agents/performance` | page: speed, success and tokens against each one's baseline |
 * | Settings | `/agents/settings` | how much may run at once, pool by pool |
 *
 * A *page* fills the main area and opens no panel. The product lands on
 * Overview, the first rail item.
 * The levels under the product's route have no element of their own, so
 * moving along the rail never remounts the page. The page itself is the app's
 * product host, which composes every graph product's regions, so the route's
 * element is whatever the app puts in `AgentsSlotsContext`.
 */
import type { ProductDefinition } from "@invana-studio/core";
import { ErrorPage, type ShellRouteHandle } from "@invana-studio/shell";
import {
	Bot,
	BrainCircuit,
	Gauge,
	LayoutGrid,
	Library,
	Puzzle,
	Settings,
	Wand2,
} from "lucide-react";
import type { Params, RouteObject } from "react-router-dom";
import { useAgentsSlots } from "./AgentsSlots";
import { searchAgents } from "./search";

function AgentsRoute() {
	const { Page } = useAgentsSlots();
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

/** A section whose records drill in one level down: `llms` › `<provider>`. */
const drillable = (path: string, label: string, param: string) =>
	level(path, label, [level(`:${param}`, (p) => p[param])]);

export const agents: ProductDefinition = {
	id: "agents",
	name: "Agents",
	tagline: "Build, tune, watch",
	icon: Bot,
	scope: "graph",
	landing: "overview",
	nav: {
		groups: [
			[
				{
					id: "overview",
					label: "Overview",
					icon: LayoutGrid,
					to: "overview",
				},
				{ id: "agents", label: "Agents", icon: Bot, to: "agents" },
				{ id: "skills", label: "Skills", icon: Wand2, to: "skills" },
			],
			[
				{ id: "library", label: "Library", icon: Library, to: "library" },
				{ id: "plugins", label: "Plugins", icon: Puzzle, to: "plugins" },
				{ id: "llms", label: "LLMs", icon: BrainCircuit, to: "llms" },
				{
					id: "performance",
					label: "Performance",
					icon: Gauge,
					to: "performance",
				},
			],
		],
		bottom: [
			{ id: "settings", label: "Settings", icon: Settings, to: "settings" },
		],
	},
	search: searchAgents,
	commands: [
		{
			id: "templates",
			label: "Templates",
			keywords: ["projection", "library"],
			to: "library/templates",
		},
		{
			id: "task-catalogue",
			label: "Task catalogue",
			keywords: ["tasks", "plugins"],
			to: "plugins/tasks",
		},
	],
	routes: [
		{
			path: "u/:username/:graphSlug/agents",
			// No crumb: the wordmark already reads `Invana Agents`.
			handle: { ownsRegions: true } satisfies ShellRouteHandle,
			element: <AgentsRoute />,
			errorElement: <ErrorPage />,
			children: [
				{ index: true },
				level("overview", "Overview"),
				drillable("agents", "Agents", "agent"),
				level("skills", "Skills"),
				// Templates is Library's second section, so it sits under Library's
				// path and its rail item stays lit; a plan is Library's drill-in.
				level("library", "Library", [
					drillable("templates", "Templates", "template"),
					level(":plan", (p) => p.plan),
				]),
				level("plugins", "Plugins", [drillable("tasks", "Tasks", "entry")]),
				drillable("llms", "LLMs", "provider"),
				level("performance", "Performance"),
				level("settings", "Settings"),
			],
		},
	],
};
