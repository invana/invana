import {
	Canvas as CanvasRoot,
	D3ForceLayout,
	DragPanBehaviour,
	GraphLayer,
	WheelZoomBehaviour,
} from "@invana/canvas-react";
import type { GraphData } from "@invana/graph";
import { useMemo, useRef } from "react";

// Stable surface for studio pages. We deliberately do NOT re-export canvas
// types — `@invana/canvas` is in active development and breaking changes are
// expected. Pages adapt their own data into this shape; if canvas-react's
// shape shifts, only this file changes.
export interface GraphCanvasNode {
	id: string;
	label?: string;
}

export interface GraphCanvasEdge {
	id: string;
	source: string;
	target: string;
	label?: string;
}

export interface GraphCanvasProps {
	nodes: GraphCanvasNode[];
	edges: GraphCanvasEdge[];
}

// Shared canvas-engine wrapper for the Explorer (query results) and Modeller
// (schema). Mounts an `@invana/canvas` root via the canvas-react bindings:
// drag-pan + wheel-zoom + a single GraphLayer + a D3 force layout.
//
// Selection / hover / brush behaviours aren't wrapped by canvas-react yet —
// add them here once they land, so pages don't need to know about it.
export function GraphCanvas({ nodes, edges }: GraphCanvasProps) {
	// `setData` runs whenever the GraphData reference changes. Memoise on the
	// input arrays so unchanged data doesn't restart the layout sim.
	const data = useMemo<GraphData>(
		() => ({
			nodes: nodes.map((n) => ({ id: n.id })),
			edges: edges.map((e) => ({
				id: e.id,
				source: e.source,
				target: e.target,
			})),
		}),
		[nodes, edges],
	);

	// `<D3ForceLayout>` is init-only — it runs the sim once on mount and
	// doesn't react to data changes. We force a remount whenever `data`
	// flips reference so the new node set gets positioned. The counter
	// increments inline during render; the prev-ref check keeps it
	// idempotent under StrictMode's double-render.
	const layoutKeyRef = useRef(0);
	const prevDataRef = useRef<GraphData | null>(null);
	if (prevDataRef.current !== data) {
		prevDataRef.current = data;
		layoutKeyRef.current += 1;
	}
	const graphLayerId = "graph";

	return (
		<CanvasRoot autoResize>
			<DragPanBehaviour />
			<WheelZoomBehaviour />
			<GraphLayer
				id={graphLayerId}
				data={data}
				node={{
					style: {
						shape: { kind: "circle", radius: 10 },
						bgFill: 0x6366f1,
					},
				}}
				edge={{
					style: { strokeColor: 0x94a3b8, strokeWidth: 1 },
				}}
			/>
			{nodes.length > 0 && (
				<D3ForceLayout
					key={layoutKeyRef.current}
					targetLayerId={graphLayerId}
					options={{
						// d3-force only adds a force when its option is set, so every
						// force we want must be listed here. Empty objects accept d3's
						// own defaults.
						charge: { strength: -300 },
						link: { distance: 80 },
						center: { x: 0, y: 0 },
						collide: { radius: 14 },
					}}
				/>
			)}
		</CanvasRoot>
	);
}
