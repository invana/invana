/**
 * An agent › **Flow** (board `agents.agent.flow`): what starts it, the agent,
 * the skills it is offered and the agents it has spawned, on the
 * {@link LayeredCanvas}, with *From the instructions* and *Who it can talk to*
 * beside it.
 *
 * Drawn from records, never from a model call:
 *
 * - **Triggers** — whether a Todo may name it (`policy.can_be_assigned`) and
 *   whether it may run with nobody to ask (`policy.unattended`).
 * - **Skills** — its bindings, each with its offered plan's step count.
 * - **Spawned** — the lineage's `spawned` edges out of this agent.
 *
 * *From the instructions* lists each line of `instructions.md` that names a
 * bound skill or a spawned agent. Delegation targets join with delegation;
 * outside callers with this Graph's MCP server.
 */

import {
	Badge,
	Button,
	Item,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemTitle,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import {
	LayeredCanvas,
	type LayeredEdge,
	type LayeredNode,
} from "@invana-studio/canvases";
import { PanelSection } from "@invana-studio/ui";
import { Pencil } from "lucide-react";
import { useMemo } from "react";
import { EVERY } from "../lists";
import { useSkillsQuery } from "../skills/queries";
import type { Skill } from "../skills/types";
import { versionName } from "./agentParts";
import { useAgentLineageQuery } from "./queries";
import type { Agent, AgentLineage } from "./types";

interface FlowModel {
	nodes: LayeredNode[];
	edges: LayeredEdge[];
	/** Instruction lines that name a bound skill or a spawned agent. */
	lines: { n: number; text: string; names: string[] }[];
	spawned: { id: string; label: string }[];
}

export function AgentFlowTab({
	username,
	graphSlug,
	agent,
	onOpenLineage,
	onOpenSkill,
}: {
	username: string;
	graphSlug: string;
	agent: Agent;
	onOpenLineage: () => void;
	onOpenSkill?: (id: string) => void;
}) {
	const skills = useSkillsQuery(username, graphSlug, EVERY);
	const lineage = useAgentLineageQuery(username, graphSlug, agent.id);
	const flow = useMemo(
		() => flowModel(agent, skills.data?.items ?? [], lineage.data),
		[agent, skills.data, lineage.data],
	);

	return (
		<div className="grid h-full min-h-0 gap-2.5 p-3.5 @[760px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
			<div className="flex min-h-96 min-w-0 flex-col border bg-card">
				<div className="relative min-h-0 flex-1">
					<LayeredCanvas
						kind="data"
						layout="fixed"
						nodes={flow.nodes}
						edges={flow.edges}
						onSelectNode={(id) => {
							if (id?.startsWith("skill:") && onOpenSkill)
								onOpenSkill(id.slice("skill:".length));
						}}
						emptyHint="Nothing starts this agent yet."
					/>
				</div>
				<p className="flex items-center gap-1.5 border-t px-3 py-2 text-sm text-muted-foreground">
					<Pencil className="size-3.5 shrink-0" />
					Drawn from {agent.name}'s instructions and skills. A run may replan
					within them — who it may spawn never widens.
				</p>
			</div>

			<div className="flex min-w-0 flex-col gap-2.5">
				<PanelSection
					card
					title="From the instructions"
					action={
						<span className="text-sm text-muted-foreground">
							instructions.md
						</span>
					}
				>
					{flow.lines.length ? (
						<ItemGroup>
							{flow.lines.map((l) => (
								<Item key={l.n} size="xs">
									<Badge
										variant="outline"
										tone="muted"
										size="xs"
										className="font-mono font-normal"
									>
										line {l.n}
									</Badge>
									<ItemContent>
										<ItemTitle className="font-normal">{l.text}</ItemTitle>
										<ItemDescription>{l.names.join(" · ")}</ItemDescription>
									</ItemContent>
								</Item>
							))}
						</ItemGroup>
					) : (
						<p className="text-muted-foreground">
							No line of its instructions names a bound skill or a spawned
							agent.
						</p>
					)}
				</PanelSection>

				<PanelSection
					card
					title="Who it can talk to"
					action={
						<Button size="sm" variant="ghost" onClick={onOpenLineage}>
							Open lineage
						</Button>
					}
				>
					{flow.spawned.length ? (
						<Table bordered={false} density="compact">
							<TableHeader>
								<TableRow>
									<TableHead>Agent</TableHead>
									<TableHead>How</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{flow.spawned.map((s) => (
									<TableRow key={s.id}>
										<TableCell className="font-medium">{s.label}</TableCell>
										<TableCell className="text-muted-foreground">
											spawns
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					) : (
						<p className="text-muted-foreground">
							{agent.policy.can_spawn !== true
								? "It may not create helpers."
								: "It has spawned no agent yet."}
						</p>
					)}
				</PanelSection>
			</div>
		</div>
	);
}

function flowModel(
	agent: Agent,
	skills: Skill[],
	lineage: AgentLineage | undefined,
): FlowModel {
	const nodes: LayeredNode[] = [];
	const edges: LayeredEdge[] = [];
	const self = `agent:${agent.id}`;
	const model = versionName(agent.model_pin);

	const triggers: { id: string; label: string; sub: string }[] = [];
	if (agent.policy.can_be_assigned)
		triggers.push({
			id: "trigger:assigned",
			label: "A Todo assigned to it",
			sub: "trigger",
		});
	if (agent.policy.unattended)
		triggers.push({
			id: "trigger:unattended",
			label: "Unattended",
			sub: "runs with nobody to ask",
		});
	for (const t of triggers) {
		nodes.push({ ...t, column: 0, tone: "muted" });
		edges.push({
			id: `${t.id}->self`,
			source: t.id,
			target: self,
			label: "triggers",
		});
	}

	nodes.push({
		id: self,
		label: agent.name,
		sub: [agent.status, model].filter(Boolean).join(" · "),
		column: 1,
		tone: agent.status === "active" ? "success" : "muted",
	});

	const byId = new Map(skills.map((s) => [s.id, s]));
	const bound = agent.skill_ids.flatMap((id) => byId.get(id) ?? []);
	for (const s of bound) {
		const steps = s.plan?.step_count;
		nodes.push({
			id: `skill:${s.id}`,
			label: s.name,
			sub:
				steps != null
					? `${steps} step${steps === 1 ? "" : "s"}`
					: s.is_draft
						? "draft"
						: `v${s.version}`,
			column: 2,
			tone: s.is_draft ? "muted" : "info",
		});
		edges.push({
			id: `uses:${s.id}`,
			source: self,
			target: `skill:${s.id}`,
			label: "uses",
		});
	}

	const label = new Map((lineage?.nodes ?? []).map((n) => [n.id, n.label]));
	const spawned = (lineage?.edges ?? [])
		.filter((e) => e.kind === "spawned" && e.source === agent.id)
		.map((e) => ({ id: e.target, label: label.get(e.target) ?? e.target }));
	const seen = new Set<string>();
	for (const s of spawned) {
		if (seen.has(s.id)) continue;
		seen.add(s.id);
		nodes.push({
			id: `spawned:${s.id}`,
			label: s.label,
			sub: "spawned",
			column: 3,
			tone: "success",
		});
		edges.push({
			id: `spawns:${s.id}`,
			source: self,
			target: `spawned:${s.id}`,
			label: "spawns",
			dashed: true,
		});
	}

	const names = [
		...bound.map((s) => s.name),
		...[...seen].map((id) => label.get(id) ?? id),
	].filter((x) => x.trim());
	const lines = agent.instructions
		.split("\n")
		.map((text, i) => ({
			n: i + 1,
			text: text.trim(),
			names: names.filter((nm) =>
				text.toLowerCase().includes(nm.toLowerCase()),
			),
		}))
		.filter((l) => l.names.length);

	return {
		nodes,
		edges,
		lines,
		spawned: spawned.filter(
			(s, i) => spawned.findIndex((x) => x.id === s.id) === i,
		),
	};
}
