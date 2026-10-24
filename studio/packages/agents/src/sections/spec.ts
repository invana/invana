/**
 * The Agents sections — what the rail names, what each page holds, and its
 * tabs. One table, read by the rail (`product.tsx`), the section frame
 * (`SectionPage`), the workbook's tabs and Home's tiles, so a section's name
 * and icon cannot differ between them.
 *
 * A tab's key is the path's last segment; the first tab is the section's own
 * path (`/agents/fleet` is Overview).
 */

import {
	Bot,
	BrainCircuit,
	Gauge,
	House,
	Network,
	Pencil,
	Plug,
	Settings,
	SquareFunction,
} from "lucide-react";
import type { ProductIcon } from "@invana-studio/core";

export type AgentsSectionKey =
	| "home"
	| "fleet"
	| "performance"
	| "agents"
	| "skills"
	| "functions"
	| "connections"
	| "llms"
	| "concurrency";

export interface SectionTab {
	key: string;
	label: string;
}

export interface SectionSpec {
	label: string;
	icon: ProductIcon;
	/** One line under the page's name: what it holds. */
	description: string;
	tabs: SectionTab[];
}

export const SECTIONS: Record<AgentsSectionKey, SectionSpec> = {
	home: {
		label: "Home",
		icon: House,
		description: "Ask, or open a section",
		tabs: [],
	},
	fleet: {
		label: "Fleet",
		icon: Network,
		description:
			"Every agent in this Graph — how it is doing, what it needs from you, how it is wired",
		tabs: [
			{ key: "overview", label: "Overview" },
			{ key: "map", label: "Map" },
			{ key: "table", label: "Table" },
		],
	},
	performance: {
		label: "Performance",
		icon: Gauge,
		description:
			"Speed, success and tokens for every agent, skill, plan and model version, against its own baseline",
		tabs: [
			{ key: "agents", label: "Agents" },
			{ key: "skills", label: "Skills" },
			{ key: "plans", label: "Plans" },
			{ key: "llms", label: "LLMs" },
		],
	},
	agents: {
		label: "Agents",
		icon: Bot,
		description:
			"Authored agents and their deployment — spawned helpers live in their runs",
		tabs: [],
	},
	skills: {
		label: "Skills",
		icon: Pencil,
		description:
			"Instructions in Markdown, the functions each needs, evals — plans are generated from them",
		tabs: [],
	},
	functions: {
		label: "Functions",
		icon: SquareFunction,
		description:
			"Every function agents may call, the plans made of them, the templates that shape answers and the plugins they come from",
		tabs: [
			{ key: "functions", label: "Functions" },
			{ key: "plans", label: "Packaged plans" },
			{ key: "generated", label: "Generated plans" },
			{ key: "templates", label: "Templates" },
			{ key: "plugins", label: "Plugins" },
		],
	},
	connections: {
		label: "Connections",
		icon: Plug,
		description:
			"Where this Graph meets the outside — the MCP servers whose tools it calls",
		tabs: [{ key: "mcp", label: "MCP servers" }],
	},
	llms: {
		label: "LLMs",
		icon: BrainCircuit,
		description:
			"Every model by its exact version name — a run records the version it used; moving an agent is a change, with evals",
		tabs: [],
	},
	concurrency: {
		label: "Settings",
		icon: Settings,
		description:
			"This Graph's agent settings — how many runs at once, and what happens at the ceiling",
		tabs: [],
	},
};

/** The tab a section opens on when the path names none. */
export const firstTab = (key: AgentsSectionKey): string | null =>
	SECTIONS[key].tabs[0]?.key ?? null;

/** What every section page takes from the host. */
export interface SectionPageProps {
	username: string;
	graphSlug: string;
	/** The open tab — the path's last segment, else the section's first tab. */
	tab: string;
	/** Move to another tab of this section; it lands in the path. */
	onTab: (tab: string) => void;
	/** LLMs: the endpoint open in its modal, from the path. Null elsewhere. */
	detail: string | null;
	/** Open or close that endpoint's modal. */
	onDetail: (id: string | null) => void;
}
