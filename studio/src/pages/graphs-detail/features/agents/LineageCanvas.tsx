/**
 * An agent's lineage on the {@link LayeredCanvas}: columns by **causal depth** —
 * people, then agents, then tasks — with authored, spawned and assigned edges.
 * Selecting an agent selects it in the agents list; selecting a task opens it.
 */

import {
	LayeredCanvas,
	type LayeredEdge,
	type LayeredNode,
} from "@/canvases/layered/LayeredCanvas";
import { useAgentLineageQuery } from "@/hooks/queries/useWork";
import type { AgentEdge } from "@/types/work";
import { useMemo } from "react";

interface Scope {
	username: string;
	graphSlug: string;
}

export function LineageCanvas({
	username,
	graphSlug,
	agentId,
	selectedNodeId,
	selectedEdgeId,
	onSelectAgent,
	onSelectEdge,
	onOpenTask,
}: Scope & {
	agentId: string;
	selectedNodeId: string | null;
	selectedEdgeId: string | null;
	onSelectAgent: (id: string | null) => void;
	onSelectEdge: (edge: AgentEdge | null) => void;
	onOpenTask: (taskId: string) => void;
}) {
	const lineage = useAgentLineageQuery(username, graphSlug, agentId);

	const { nodes, edges } = useMemo(() => {
		const raw = lineage.data;
		if (!raw) return { nodes: [] as LayeredNode[], edges: [] as LayeredEdge[] };

		// Causal depth: people authored, agents were authored or spawned, tasks
		// were assigned. Three columns is the whole story.
		const column = (kind: string) =>
			kind === "user" ? 0 : kind === "agent" ? 1 : 2;

		return {
			nodes: raw.nodes.map(
				(node): LayeredNode => ({
					id: node.id,
					label: node.label,
					sub:
						node.kind === "agent"
							? [
									node.agent_kind,
									node.lifetime === "ephemeral" ? "ephemeral" : null,
								]
									.filter(Boolean)
									.join(" · ")
							: node.kind === "task"
								? (node.status ?? "task")
								: "person",
					column: column(node.kind),
					tone:
						node.kind === "agent"
							? node.status === "retired"
								? "muted"
								: node.status === "paused"
									? "warning"
									: "success"
							: "muted",
					nodeKind: node.kind,
				}),
			),
			edges: raw.edges.map(
				(edge): LayeredEdge => ({
					id: edge.id,
					source: edge.source,
					target: edge.target,
					label: edge.label,
					dashed: edge.kind === "assigned",
				}),
			),
		};
	}, [lineage.data]);

	return (
		<LayeredCanvas
			kind="lineage"
			nodes={nodes}
			edges={edges}
			selectedNodeId={selectedNodeId}
			selectedEdgeId={selectedEdgeId}
			onSelectNode={(id, node) => {
				// **The per-node-kind branch** (docs/for-developers/modules/explore/features/selection-and-the-panel.md). An agent selects into
				// the agents list; a task navigates, because the Agents panel has no row
				// for one; a person is inert — MVP has no person surface, so there
				// is nowhere to go and nothing to state.
				if (node?.nodeKind === "agent") {
					onSelectAgent(id === selectedNodeId ? null : id);
					onSelectEdge(null);
				} else if (node?.nodeKind === "task" && id) {
					onOpenTask(id);
				}
			}}
			onSelectEdge={(id) => {
				const edge = lineage.data?.edges.find((e) => e.id === id) ?? null;
				// Selecting an edge clears the agents list's selected row: an edge is
				// selected, not an agent.
				onSelectEdge(id === selectedEdgeId ? null : edge);
				if (id && id !== selectedEdgeId) onSelectAgent(null);
			}}
			emptyHint="Pick an agent to draw who created it and what it has worked on."
		/>
	);
}
