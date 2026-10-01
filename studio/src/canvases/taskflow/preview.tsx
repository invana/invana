import { EdgePreviewCard, NodePreviewCard } from "@invana/canvas-ui";
import type { GraphEdge, GraphNode } from "@invana/graph";
import type { TaskEdgeData, TaskNodeData } from "@/canvases/taskflow/types";

export function renderTaskNode(node: GraphNode) {
	const d = node.data as unknown as TaskNodeData;
	return (
		<NodePreviewCard
			title={d.title}
			subtitle={d.summary}
			tags={[node.id]}
			rows={[
				{ label: "step", value: d.stepKey, mono: true },
				{ label: "bound", value: d.bound },
				...d.rows,
			]}
		/>
	);
}

export function renderTaskEdge(edge: GraphEdge) {
	const d = edge.data as unknown as TaskEdgeData;
	return (
		<EdgePreviewCard
			badge={d.kind}
			title={`${edge.source} → ${edge.target}`}
			subtitle={d.description}
		/>
	);
}
