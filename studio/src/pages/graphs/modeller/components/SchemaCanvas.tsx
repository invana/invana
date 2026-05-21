// TEMP: the previous implementation imported @invana/canvas-core and
// @invana/layouts-d3-force, neither of which is published. The sibling
// @invana/canvas package exposes a redesigned API surface that the old
// plugin code can't be retargeted to mechanically. Until the new canvas
// integration lands, render a placeholder that summarises the schema; the
// rest of Modeller (nav + detail panel) still works.

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
	const empty = nodeTypes.length === 0 && edgeTypes.length === 0;
	return (
		<div className="w-full h-full relative bg-background flex items-center justify-center text-muted-foreground">
			{empty ? (
				<span>
					No schema loaded — run Introspect to discover your database schema.
				</span>
			) : (
				<div className="text-center">
					<p>
						{nodeTypes.length} node type{nodeTypes.length === 1 ? "" : "s"} ·{" "}
						{edgeTypes.length} edge type{edgeTypes.length === 1 ? "" : "s"}
					</p>
					<p className="opacity-60 mt-1">
						Canvas rendering is being reworked — use the left panel to browse.
					</p>
				</div>
			)}
		</div>
	);
}
