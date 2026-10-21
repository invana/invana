import { EdgePreviewCard, type PreviewCardRow } from "@invana/canvas-ui";
import type { GraphEdge } from "@invana/graph";
import type { ModelEdgeData } from "./types";

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
