/**
 * Fleet › **Map** — how the fleet is wired: agents → the skills they are
 * offered → the function namespaces those skills' plans call, on the
 * {@link LayeredCanvas} (the-agents-shell.md › Fleet).
 *
 * Three columns, read left to right:
 *
 * - **Agents** — the authored and seeded agents the Agents list holds (spawned
 *   helpers live in their runs), toned by status.
 * - **Skills** — every skill an agent is bound to, by `skill_ids`; *uses*.
 * - **Namespaces** — a function's dotted prefix (`graph.read.query` →
 *   `graph.read.*`), from each published skill's offered plan; *needs*.
 *
 * The legend floats over the map: what each colour and line means, how many
 * of each the map draws, and a switch per type that hides it. A click on an
 * agent or a skill opens its page as a workbook tab. A draft skill is offered
 * nothing, and a plan of only human steps calls no function, so neither
 * reaches a namespace. Pools join the map when Workers holds them.
 */

import { Eyebrow, FloatingPanel, Legend, LegendItem } from "@invana/ui";
import {
	LayeredCanvas,
	type LayeredEdge,
	type LayeredNode,
} from "@invana-studio/canvases";
import { useMemo, useState } from "react";
import { useAgentsQuery } from "../agents/queries";
import type { Agent } from "../agents/types";
import { PAGE } from "../lists";
import { useAgentsOpen } from "../open";
import { FleetReadState } from "../overview/fleetParts";
import { useSkillPlaybooksQuery, useSkillsQuery } from "../skills/queries";
import type { Skill, SkillPlaybookRead } from "../skills/types";

const LIST = { limit: PAGE };

/** A node id's prefix — the column it sits in. */
type Column = "agent" | "skill" | "ns";

const COLUMNS: { kind: Column; label: string; color: string }[] = [
	{ kind: "agent", label: "Agent", color: "var(--color-success)" },
	{ kind: "skill", label: "Skill", color: "var(--color-success)" },
	{ kind: "ns", label: "Namespace", color: "var(--color-muted-foreground)" },
];

/** `graph.read.query` → `graph.read`; a key with no dot is its own namespace. */
const namespaceOf = (key: string) =>
	key.includes(".") ? key.slice(0, key.lastIndexOf(".")) : key;

export function FleetMap({
	username,
	graphSlug,
}: {
	username: string;
	graphSlug: string;
}) {
	const open = useAgentsOpen();
	const agents = useAgentsQuery(username, graphSlug, LIST);
	const skills = useSkillsQuery(username, graphSlug, LIST);
	const skillRows = useMemo(() => skills.data?.items ?? [], [skills.data]);
	const { plans } = useSkillPlaybooksQuery(username, graphSlug, skillRows);
	const [hidden, setHidden] = useState<ReadonlySet<Column>>(new Set());
	const [folded, setFolded] = useState(false);

	const graph = useMemo(
		() => fleetGraph(agents.data?.items ?? [], skillRows, plans),
		[agents.data, skillRows, plans],
	);
	const shown = useMemo(() => withoutHidden(graph, hidden), [graph, hidden]);

	const error = agents.error ?? skills.error;
	if (agents.isLoading || skills.isLoading || error)
		return (
			<div className="p-3">
				<FleetReadState
					loading={agents.isLoading || skills.isLoading}
					error={error}
					what="the fleet"
				/>
			</div>
		);

	const toggle = (kind: Column) =>
		setHidden((prev) => {
			const next = new Set(prev);
			if (next.has(kind)) next.delete(kind);
			else next.add(kind);
			return next;
		});

	return (
		<div className="relative h-full min-h-0">
			<LayeredCanvas
				kind="data"
				// Three piles in reading order; layering moves them for no reason.
				layout="fixed"
				nodes={shown.nodes}
				edges={shown.edges}
				selectedNodeId={null}
				onSelectNode={(_, node) => {
					const [kind, id] = splitId(node?.id);
					if (kind === "agent") open.agent(id);
					else if (kind === "skill") open.skill(id);
				}}
				emptyHint={
					graph.nodes.length
						? "Every type is hidden — show one in the legend."
						: "No agents yet — an agent and the skills it is offered draw here."
				}
			/>
			{graph.nodes.length ? (
				<FloatingPanel
					className="absolute top-3 right-3 w-64"
					bodyClassName="px-3 py-2"
					title="Legend"
					aside={
						<span className="text-muted-foreground">
							{COLUMNS.length + 2} types
						</span>
					}
					collapsed={folded}
					onCollapsedChange={setFolded}
					footer={
						<span className="text-muted-foreground">
							Click a type to hide it on the map.
						</span>
					}
				>
					<MapLegend graph={graph} hidden={hidden} onToggle={toggle} />
				</FloatingPanel>
			) : null}
		</div>
	);
}

/** What the map draws, by type and by line, with a switch on each type. */
function MapLegend({
	graph,
	hidden,
	onToggle,
}: {
	graph: FleetGraph;
	hidden: ReadonlySet<Column>;
	onToggle: (kind: Column) => void;
}) {
	// What the canvas draws right now, not a figure of the fleet's.
	const count = (kind: Column) =>
		graph.nodes.filter((n) => splitId(n.id)[0] === kind).length;
	const lines = (label: string) =>
		graph.edges.filter((e) => e.label === label).length;
	return (
		<div className="flex flex-col gap-2">
			<Eyebrow>Nodes</Eyebrow>
			<Legend orientation="column">
				{COLUMNS.map((c) => (
					<LegendItem
						key={c.kind}
						kind="dot"
						color={c.color}
						label={c.label}
						count={count(c.kind)}
						pressed={!hidden.has(c.kind)}
						onToggle={() => onToggle(c.kind)}
					/>
				))}
			</Legend>
			<Eyebrow>States</Eyebrow>
			<Legend orientation="column">
				<LegendItem
					kind="dot"
					color="var(--color-warning)"
					label="agent · paused"
				/>
				<LegendItem
					kind="dot"
					color="var(--color-muted-foreground)"
					label="agent · retired · skill · draft"
				/>
			</Legend>
			<Eyebrow>Relationships</Eyebrow>
			<Legend orientation="column">
				<LegendItem
					kind="line"
					color="var(--color-muted-foreground)"
					label="uses"
					count={lines("uses")}
				/>
				<LegendItem
					kind="dashed"
					color="var(--color-muted-foreground)"
					label="needs"
					count={lines("needs")}
				/>
			</Legend>
		</div>
	);
}

/** A node id is `<column kind>:<record id>`. */
function splitId(nodeId: string | undefined): [string, string] {
	if (!nodeId) return ["", ""];
	const at = nodeId.indexOf(":");
	return [nodeId.slice(0, at), nodeId.slice(at + 1)];
}

function agentTone(status: Agent["status"]): LayeredNode["tone"] {
	return status === "active"
		? "success"
		: status === "paused"
			? "warning"
			: "muted";
}

interface FleetGraph {
	nodes: LayeredNode[];
	edges: LayeredEdge[];
}

/** The map without the hidden types, and without the lines that reached them. */
function withoutHidden(
	graph: FleetGraph,
	hidden: ReadonlySet<Column>,
): FleetGraph {
	if (!hidden.size) return graph;
	const nodes = graph.nodes.filter(
		(n) => !hidden.has(splitId(n.id)[0] as Column),
	);
	const kept = new Set(nodes.map((n) => n.id));
	return {
		nodes,
		edges: graph.edges.filter((e) => kept.has(e.source) && kept.has(e.target)),
	};
}

/** The three columns and the two kinds of edge between them. */
function fleetGraph(
	agents: Agent[],
	skills: Skill[],
	plans: Map<string, SkillPlaybookRead>,
): FleetGraph {
	const skillById = new Map(skills.map((s) => [s.id, s]));
	const nodes: LayeredNode[] = [];
	const edges: LayeredEdge[] = [];
	const bound = new Set<string>();

	for (const agent of agents) {
		nodes.push({
			id: `agent:${agent.id}`,
			label: agent.name,
			sub: `${agent.kind} · ${agent.status}`,
			column: 0,
			tone: agentTone(agent.status),
		});
		for (const skillId of agent.skill_ids) {
			if (!skillById.has(skillId)) continue;
			bound.add(skillId);
			edges.push({
				id: `uses:${agent.id}:${skillId}`,
				source: `agent:${agent.id}`,
				target: `skill:${skillId}`,
				label: "uses",
			});
		}
	}

	// The functions each namespace is reached for, in first-seen order.
	const namespaces = new Map<string, Set<string>>();
	for (const skill of skills) {
		if (!bound.has(skill.id)) continue;
		nodes.push({
			id: `skill:${skill.id}`,
			label: skill.name,
			sub: skill.is_draft ? "draft" : `v${skill.version}`,
			column: 1,
			tone: skill.is_draft ? "muted" : "success",
		});
		const reached = new Set<string>();
		for (const node of plans.get(skill.id)?.nodes ?? []) {
			if (!node.task) continue;
			const ns = namespaceOf(node.task);
			const fns = namespaces.get(ns) ?? new Set<string>();
			fns.add(node.task.slice(ns.length + 1) || node.task);
			namespaces.set(ns, fns);
			reached.add(ns);
		}
		for (const ns of reached)
			edges.push({
				id: `needs:${skill.id}:${ns}`,
				source: `skill:${skill.id}`,
				target: `ns:${ns}`,
				label: "needs",
				dashed: true,
			});
	}

	for (const [ns, fns] of namespaces)
		nodes.push({
			id: `ns:${ns}`,
			label: `${ns}.*`,
			sub: [...fns].join(" · "),
			column: 2,
			tone: "muted",
		});

	return { nodes, edges };
}
