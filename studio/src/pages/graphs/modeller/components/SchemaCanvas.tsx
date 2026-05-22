import { useMemo } from "react";
import {
	GraphCanvas,
	type GraphCanvasEdge,
	type GraphCanvasNode,
} from "../../../../components/canvas/GraphCanvas";
import type {
	EdgeTypeResponse,
	NodeTypeResponse,
} from "../../../../types/schemas";
import type { SelectedItem } from "./DetailPanel";

interface SchemaCanvasProps {
	nodeTypes: NodeTypeResponse[];
	edgeTypes: EdgeTypeResponse[];
	selected: SelectedItem;
	onSelect: (item: SelectedItem) => void;
}

export function SchemaCanvas({ nodeTypes, edgeTypes }: SchemaCanvasProps) {
	// Adapt schema types into the shared canvas's node/edge shape. Node-type
	// names are the canonical ids on the modeller side, so we key everything
	// by name. Edge types fan out to one canvas edge per (source, target)
	// pair — a single schema edge type can connect multiple node-type pairs.
	const { nodes, edges } = useMemo(() => {
		const nodeNames = new Set(nodeTypes.map((n) => n.name));
		const canvasNodes: GraphCanvasNode[] = nodeTypes.map((n) => ({
			id: n.name,
			label: n.name,
		}));
		const canvasEdges: GraphCanvasEdge[] = [];
		for (const e of edgeTypes) {
			const sources = e.source_node_types.length ? e.source_node_types : [];
			const targets = e.target_node_types.length ? e.target_node_types : [];
			for (const src of sources) {
				for (const tgt of targets) {
					if (!nodeNames.has(src) || !nodeNames.has(tgt)) continue;
					canvasEdges.push({
						id: `${e.id}:${src}->${tgt}`,
						source: src,
						target: tgt,
						label: e.name,
					});
				}
			}
		}
		return { nodes: canvasNodes, edges: canvasEdges };
	}, [nodeTypes, edgeTypes]);

	const empty = nodes.length === 0;

	if (empty) {
		return (
			<div className="w-full h-full relative bg-background flex items-center justify-center text-muted-foreground">
				<span>
					No schema loaded — run Introspect to discover your database schema.
				</span>
			</div>
		);
	}

	return (
		<div className="w-full h-full relative bg-background">
			<GraphCanvas nodes={nodes} edges={edges} />
		</div>
	);
}
