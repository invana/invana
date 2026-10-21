/**
 * Models drawn as frames of node types, with the stitches between them
 * ([graph-model-canvas.md](../../../../docs/for-developers/building-studio/graph-model-canvas.md)).
 *
 * The board is canvas's `SchemaBoard` — its config, Detail levels, schema
 * cards, hover cards and connect gesture. What is Studio's own is the stitch:
 * a crossing is dashed, a staged one wears the success colour, its hover card
 * reads the rule, a type's card counts its stitches, and a drag from a type
 * onto a type declares one through the host's veto and declare card.
 */

import type { RenderPreference } from "@invana/canvas-react";
import { SchemaBoard, type SchemaBoardConnect } from "@invana/canvas-ui";
import type { SchemaTypeData } from "@invana/graph";
import { SIDE_SECTION } from "@invana-studio/core";
import { type ReactNode, useMemo } from "react";
import { renderModelEdge } from "./preview";
import { decorate, useSuccessColor } from "./style";
import type { Detail, ModelCanvasSelection, ModelGraphData } from "./types";

export interface GraphModelCanvasProps {
	data: ModelGraphData;
	/** Left out, the header carries no title — a page that names the model already. */
	title?: string;
	/** Shown once in the message bar when the canvas is ready. */
	message?: string;
	/** The Detail the canvas opens on — circles for All models, cards for one model. */
	initialDetail?: Detail;
	/** The node or edge drawn selected. */
	selected?: ModelCanvasSelection;
	/** A click on one node or edge, or on nothing. */
	onSelect?: (selection: ModelCanvasSelection) => void;
	/** For a host that gives no height of its own; default fills the parent. */
	height?: number;
	/** Declare a stitch by dragging a type onto another. Left out, the canvas has no Stitch tool. */
	stitching?: GraphModelStitching;
	/**
	 * The page's render backend. Fixed at init, so a change remounts the
	 * canvas. Left out, the canvas picks WebGPU where it can.
	 */
	backend?: RenderPreference;
}

/**
 * The stitch gesture: the Stitch tool in the header toolbar arms a drag
 * from one type to another, and the declare card docks on the right.
 */
interface GraphModelStitching {
	/**
	 * A drag landed on `targetId` from `sourceId` — node ids. Return the reason
	 * it is refused, which the message bar says; `null` accepts it, and the host
	 * then sets {@link panel}.
	 */
	onStitch: (sourceId: string, targetId: string) => string | null;
	/** The declare card while a stitch is being declared; `null` when none is. */
	panel: ReactNode | null;
	/** The dock was closed from its header toggle. */
	onClosePanel: () => void;
}

/** A type's card names its model and counts the stitches on it. */
const schemaCard = (d: SchemaTypeData) => ({
	subtitle: d.frame
		? "{data.frame} · {data.stitchCount} stitches"
		: "{data.stitchCount} stitches",
});

export function GraphModelCanvas({
	data,
	title,
	message = "Hover an edge for its stitch rule — only stitches cross a model frame",
	initialDetail = "high",
	selected = null,
	onSelect,
	height,
	stitching,
	backend,
}: GraphModelCanvasProps) {
	const success = useSuccessColor();
	const drawn = useMemo(() => decorate(data, success), [data, success]);
	const connect: SchemaBoardConnect | undefined = stitching
		? {
				onConnect: stitching.onStitch,
				label:
					"Stitch mode — drag a type onto a type in another model (or hold Shift)",
				panel: stitching.panel,
				panelLabel: "Declare a stitch",
				onClosePanel: stitching.onClosePanel,
			}
		: undefined;

	return (
		<SchemaBoard
			data={drawn}
			initialDetail={initialDetail}
			schemaCard={schemaCard}
			{...(title ? { title } : {})}
			message={message}
			selected={selected}
			{...(onSelect ? { onSelect } : {})}
			{...(connect ? { connect } : {})}
			renderEdge={renderModelEdge}
			theme="tokens"
			{...(backend ? { preference: backend } : {})}
			dockSection={SIDE_SECTION}
			// The kit's bar height, the tab strip's; canvas-ui's own is 40px.
			headerClassName="!h-[30px]"
			{...(height !== undefined ? { height } : {})}
		/>
	);
}
