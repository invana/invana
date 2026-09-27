import {
	MODEL_EMPTY_TYPE,
	MODEL_FRAME_TYPE,
	type ModelEdgeData,
	type ModelTypeData,
} from "@/canvases/model/types";
import {
	EdgePreviewCard,
	NodePreviewCard,
	type PreviewCardRow,
} from "@invana/canvas-ui";
import type { GraphEdge, GraphNode } from "@invana/graph";

/** A type's hover card — its description and one row per property. */
export function renderModelNode(node: GraphNode) {
	if (node.type === MODEL_FRAME_TYPE || node.type === MODEL_EMPTY_TYPE)
		return null;
	const d = node.data as unknown as ModelTypeData;
	// The card keys its rows by label, so the label is the unique name.
	const rows: PreviewCardRow[] = d.properties.map((p) => ({
		label: p.name,
		value: [p.type, p.identity ? "key" : "", ...(p.stitches ?? [])]
			.filter(Boolean)
			.join(" · "),
		mono: true,
	}));
	return (
		<NodePreviewCard
			title={d.label}
			subtitle={d.description || undefined}
			tags={d.frame ? [d.frame] : undefined}
			rows={rows}
		/>
	);
}

/** An edge's hover card — what kind it is, and a stitch's rule. */
export function renderModelEdge(edge: GraphEdge) {
	const d = edge.data as unknown as ModelEdgeData;
	const rows: PreviewCardRow[] = [
		{
			label: "kind",
			value:
				d.kind === "edge"
					? d.model
						? `${d.model} edge type`
						: "edge type"
					: d.kind,
		},
		...(d.staged ? [{ label: "status", value: "staged" }] : []),
		...(d.rule ? [{ label: "rule", value: d.rule, mono: true }] : []),
		...(d.match ? [{ label: "match", value: d.match }] : []),
	];
	return (
		<EdgePreviewCard
			badge={edge.type}
			title={d.title}
			subtitle={d.description || undefined}
			rows={rows}
		/>
	);
}
