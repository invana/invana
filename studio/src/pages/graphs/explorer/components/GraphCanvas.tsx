// TEMP: the previous implementation imported @invana/canvas-core and
// @invana/layouts-d3-force, neither of which is published. The sibling
// @invana/canvas package exposes a different (redesigned) API surface, so the
// old plugin-based Canvas can't just be re-pointed. Until the new canvas
// integration lands, render a placeholder that still surfaces query results
// numerically so the rest of the Explorer (query panel, status bar, inspector)
// is usable.

import type { QueryResultItem } from "../../../../types/query";

export interface GraphCanvasProps {
	data: QueryResultItem[];
	onSelectionChange: (item: QueryResultItem | null) => void;
}

export function GraphCanvas({ data }: GraphCanvasProps) {
	const nodeCount = data.filter((d) => d.type === "vertex").length;
	const edgeCount = data.filter((d) => d.type === "edge").length;

	return (
		<div className="relative w-full h-full">
			<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="40"
					height="40"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="1"
					strokeLinecap="round"
					strokeLinejoin="round"
					className="opacity-30"
				>
					<title>Graph</title>
					<circle cx="12" cy="5" r="2" />
					<circle cx="5" cy="19" r="2" />
					<circle cx="19" cy="19" r="2" />
					<line x1="12" y1="7" x2="5" y2="17" />
					<line x1="12" y1="7" x2="19" y2="17" />
				</svg>
				{data.length === 0 ? (
					<span>Run a query to explore the graph</span>
				) : (
					<div className="text-center">
						<p>
							{nodeCount} node{nodeCount === 1 ? "" : "s"} · {edgeCount} edge
							{edgeCount === 1 ? "" : "s"}
						</p>
						<p className="opacity-60 mt-1">
							Canvas rendering is being reworked — results visible in the
							panels.
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
