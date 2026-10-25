/**
 * Home's tiles — one per built section, under the assistant's composer: the
 * section's rail icon, its name, and one line with the number that says how
 * big it is (the-agents-shell.md › Home).
 *
 * Every number on a tile is a list's `total` or a field the engine returned —
 * a list is asked for one row, and only its counts are read. A section with no
 * such number names itself in words. A tile opens its section as a tab.
 *
 * Runs, Approvals and Ledger read the queries their rail badges and pages
 * read — the runs live now, the asks waiting for the reader, the acts today —
 * so a tile and its page share one cache entry. A count the reader may not
 * read (a member's ledger tiles) falls back to the section's words.
 */

import {
	Eyebrow,
	Item,
	ItemContent,
	ItemDescription,
	ItemTitle,
} from "@invana/ui";
import { type ListQuery, useGraphQuery } from "@invana-studio/core";
import type { ReactNode } from "react";
import { useAgentsQuery } from "../agents/queries";
import { useAsksQuery } from "../approvals/queries";
import { useFleetPerformanceQuery } from "../fleet/queries";
import { useLedgerStatsQuery } from "../ledger/queries";
import { useLLMProvidersQuery } from "../llms/queries";
import { useAgentsOpen } from "../open";
import { useCatalogueQuery } from "../plans/queries";
import { usePluginsQuery } from "../plugins/queries";
import { useRunsTilesQuery } from "../runs/queries";
import { type AgentsSectionKey, SECTIONS } from "../sections/spec";
import { useSkillsQuery } from "../skills/queries";

/** A list asked only for its counts. */
const COUNT: ListQuery = { limit: 1 };
const MCP: ListQuery = { filters: { kind: ["mcp"] }, limit: 1 };
const FOR_YOU: ListQuery = { filters: { view: ["for_you"] }, limit: 1 };

const plural = (n: number, one: string, many = `${one}s`) =>
	`${n.toLocaleString()} ${n === 1 ? one : many}`;

/** The tiles, in the rail's order. */
const ORDER: Exclude<AgentsSectionKey, "home">[] = [
	"fleet",
	"performance",
	"agents",
	"skills",
	"functions",
	"connections",
	"llms",
	"runs",
	"approvals",
	"ledger",
	"concurrency",
];

export function HomeTiles({
	username,
	graphSlug,
}: {
	username: string;
	graphSlug: string;
}) {
	const lines = useTileLines(username, graphSlug);
	return (
		<div className="flex w-full max-w-5xl flex-col gap-3">
			<Eyebrow className="justify-center">Or open a section</Eyebrow>
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{ORDER.map((key) => (
					<Tile key={key} section={key} line={lines[key]} />
				))}
			</div>
		</div>
	);
}

function Tile({
	section,
	line,
}: {
	section: Exclude<AgentsSectionKey, "home">;
	line: ReactNode;
}) {
	const open = useAgentsOpen();
	const spec = SECTIONS[section];
	const Icon = spec.icon;
	const go = () => open.section(section);
	return (
		// The icon sits in the title row, and the tile reads from the top, so a
		// one-line description and a two-line one start their titles level.
		<Item variant="outline" size="sm" className="items-start" asChild>
			<button type="button" onClick={go}>
				<ItemContent>
					<ItemTitle>
						<Icon className="size-4" />
						{spec.label}
					</ItemTitle>
					<ItemDescription>{line}</ItemDescription>
				</ItemContent>
			</button>
		</Item>
	);
}

/** Each tile's line, from the engine's counts; `…` while a count is read. */
function useTileLines(
	username: string,
	graphSlug: string,
): Record<Exclude<AgentsSectionKey, "home">, ReactNode> {
	const agents = useAgentsQuery(username, graphSlug, COUNT).data;
	const skills = useSkillsQuery(username, graphSlug, COUNT).data;
	const functions = useCatalogueQuery(username, graphSlug, COUNT).data;
	const mcp = usePluginsQuery(MCP).data;
	const llms = useLLMProvidersQuery(username, graphSlug, COUNT).data;
	const perf = useFleetPerformanceQuery(username, graphSlug, "7d").data;
	const graph = useGraphQuery(username, graphSlug).data;
	const runs = useRunsTilesQuery(username, graphSlug);
	const asks = useAsksQuery(username, graphSlug, FOR_YOU);
	const ledger = useLedgerStatsQuery(username, graphSlug);
	const reading = "…";

	return {
		fleet: "agents, skills, functions",
		runs: runs.data
			? `${plural(runs.data.live, "run")} live`
			: runs.error
				? "every run, any size"
				: reading,
		approvals: asks.data
			? `${plural(asks.data.for_you, "ask")} waiting for you`
			: asks.error
				? "asks waiting on a person"
				: reading,
		ledger: ledger.data
			? `${plural(ledger.data.acts, "act")} today`
			: ledger.error
				? "every act, allowed or refused"
				: reading,
		performance: perf
			? `${perf.tiles.degraded} degraded against its baseline`
			: reading,
		agents: agents
			? `${plural(agents.persistent, "agent")} · ${plural(agents.ephemeral, "spawned helper")}`
			: reading,
		skills: skills ? plural(skills.total, "skill") : reading,
		functions: functions ? plural(functions.total, "function") : reading,
		connections: mcp ? plural(mcp.total, "MCP server") : reading,
		llms: llms ? plural(llms.total, "endpoint") : reading,
		concurrency: graph
			? `${plural(graph.max_concurrent_runs, "run")} at once · ${graph.concurrency_policy}`
			: reading,
	};
}
