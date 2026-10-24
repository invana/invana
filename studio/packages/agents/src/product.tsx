/**
 * `agents` — the Agents product's `ProductDefinition`: build, tune and watch
 * the agents that do the legwork (agent-fabric.md, the-agents-shell.md).
 *
 * A rail and a workbook, with no leftSection. Every rail item is a section
 * page that opens as a tab of the workbook; a section with tabs gives each
 * one a path under it:
 *
 * | Rail | Path | Tabs |
 * |---|---|---|
 * | Home | `/agents/home` | — the workbook with nothing open |
 * | Fleet | `/agents/fleet` | Overview · `map` · `table` |
 * | Performance | `/agents/performance` | Agents · `skills` · `plans` · `llms` |
 * | Agents | `/agents/agents` | — |
 * | Skills | `/agents/skills` | — |
 * | Functions | `/agents/functions` | Functions · `plans` · `generated` · `templates` · `plugins` |
 * | Connections | `/agents/connections/mcp` | MCP servers |
 * | LLMs | `/agents/llms[/:provider]` | — an endpoint opens in a modal |
 * | Settings | `/agents/settings` | — |
 *
 * A tab is not a level of the trail, so only a section and an endpoint carry
 * a crumb. The page itself is the app's product host, which composes every
 * graph product's regions, so the route's element is whatever the app puts in
 * `AgentsSlotsContext`.
 */
import type { ProductDefinition } from "@invana-studio/core";
import { ErrorPage, type ShellRouteHandle } from "@invana-studio/shell";
import type { Params, RouteObject } from "react-router-dom";
import { useAgentsSlots } from "./AgentsSlots";
import { searchAgents } from "./search";
import { SECTIONS } from "./sections/spec";

function AgentsRoute() {
	const { Page } = useAgentsSlots();
	return <Page />;
}

/** A section's level of the trail; its tabs and drill-in sit under it. */
function level(
	path: string,
	crumb?: string | ((params: Params) => string | undefined),
	children?: RouteObject[],
): RouteObject {
	const handle: ShellRouteHandle | undefined = crumb ? { crumb } : undefined;
	return children
		? { path, handle, children: [{ index: true }, ...children] }
		: { path, handle };
}

/** A section's tabs — levels with no crumb of their own. */
const tabs = (...paths: string[]) => paths.map((p) => level(p));

const rail = (id: keyof typeof SECTIONS) => ({
	id,
	label: SECTIONS[id].label,
	icon: SECTIONS[id].icon,
	to: id === "concurrency" ? "settings" : id,
});

export const agents: ProductDefinition = {
	id: "agents",
	name: "Agents",
	tagline: "Build, tune, watch",
	icon: SECTIONS.agents.icon,
	scope: "graph",
	landing: "home",
	nav: {
		groups: [
			[rail("home")],
			[rail("fleet"), rail("performance")],
			[
				rail("agents"),
				rail("skills"),
				rail("functions"),
				rail("connections"),
				rail("llms"),
			],
		],
		bottom: [rail("concurrency")],
	},
	search: searchAgents,
	commands: [
		{
			id: "templates",
			label: "Templates",
			keywords: ["projection", "answer"],
			to: "functions/templates",
		},
		{
			id: "plugins",
			label: "Plugins",
			keywords: ["registry", "tools"],
			to: "functions/plugins",
		},
		{
			id: "mcp-servers",
			label: "MCP servers",
			keywords: ["connections", "mcp", "tools"],
			to: "connections/mcp",
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
				level("home"),
				level("fleet", "Fleet", tabs("map", "table")),
				level(
					"performance",
					"Performance",
					tabs("skills", "plans", "llms"),
				),
				level("agents", "Agents"),
				level("skills", "Skills"),
				level(
					"functions",
					"Functions",
					tabs("plans", "generated", "templates", "plugins"),
				),
				level("connections", "Connections", tabs("mcp")),
				level("llms", "LLMs", [level(":provider", (p) => p.provider)]),
				level("settings", "Settings"),
			],
		},
	],
};
