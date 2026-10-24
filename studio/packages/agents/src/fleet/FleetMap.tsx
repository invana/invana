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
 * A click on an agent or a skill opens its page as a workbook tab. A skill
 * never published is offered nothing, so it reaches no namespace. Pools join
 * the map when Workers holds them.
 */

import {
	LayeredCanvas,
	type LayeredEdge,
	type LayeredNode,
} from "@invana-studio/canvases";
import { useMemo } from "react";
import { useAgentsQuery } from "../agents/queries";
import type { Agent } from "../agents/types";
import { PAGE } from "../lists";
import { useAgentsOpen } from "../open";
import { FleetReadState } from "../overview/fleetParts";
import { useSkillPlaybooksQuery, useSkillsQuery } from "../skills/queries";
import type { Skill, SkillPlaybookRead } from "../skills/types";

const LIST = { limit: PAGE };

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

	const { nodes, edges } = useMemo(
		() => fleetGraph(agents.data?.items ?? [], skillRows, plans),
		[agents.data, skillRows, plans],
	);

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

	return (
		<div className="h-full min-h-0">
			<LayeredCanvas
				kind="data"
				// Three piles in reading order; layering moves them for no reason.
				layout="fixed"
				nodes={nodes}
				edges={edges}
				selectedNodeId={null}
				onSelectNode={(_, node) => {
					const [kind, id] = splitId(node?.id);
					if (kind === "agent") open.agent(id);
					else if (kind === "skill") open.skill(id);
				}}
				emptyHint="No agents yet — an agent and the skills it is offered draw here."
			/>
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

/** The three columns and the two kinds of edge between them. */
function fleetGraph(
	agents: Agent[],
	skills: Skill[],
	plans: Map<string, SkillPlaybookRead>,
): { nodes: LayeredNode[]; edges: LayeredEdge[] } {
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
			tone: skill.is_draft ? "muted" : "info",
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
