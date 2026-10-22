/**
 * A plan's tasks and their edges, laid out by ELK, drawn as **Circles** or
 * **Cards** ([task-flow-canvas.md](../../../../docs/for-developers/building-studio/task-flow-canvas.md)).
 *
 * canvas-ui's `LayeredDagBoard` on this folder's config: the data, the
 * settings and the templates are all props — a caller imports `settings.json`
 * and `templates.json` from this folder and passes them in with its own data.
 */

import type { CanvasConfig } from "@invana/canvas";
import {
	type DagBoardSelection,
	type DetailTemplates,
	LayeredDagBoard,
} from "@invana/canvas-ui";
import type { GraphData } from "@invana/graph";
import { SIDE_SECTION } from "@invana-studio/core";
import { useMemo } from "react";
import { renderTaskEdge, renderTaskNode } from "./preview";
import type { Detail, TaskFlowData, TaskFlowTemplates } from "./types";

const DETAIL_OPTIONS: Record<Detail, string> = {
	circles: "Circles",
	cards: "Cards",
};

export interface TaskFlowCanvasProps {
	data: TaskFlowData;
	settings: CanvasConfig;
	templates: TaskFlowTemplates;
	title?: string;
	/** Shown once in the message bar when the canvas is ready. */
	message?: string;
	/** Must match what `settings` starts on; `circles` for `settings.json`. */
	initialDetail?: Detail;
	/** The node drawn selected — a ring, no drag handles. */
	selectedId?: string | null;
	/** A click on one node. Left out, a click only selects. */
	onOpenNode?: (id: string) => void;
	/** For a host that gives no height of its own; default fills the parent. */
	height?: number;
}

export function TaskFlowCanvas({
	data,
	settings,
	templates,
	title = "Flow",
	message,
	initialDetail = "circles",
	selectedId,
	onOpenNode,
	height,
}: TaskFlowCanvasProps) {
	const detail = useMemo<DetailTemplates>(
		() => ({ templates, options: DETAIL_OPTIONS, initial: initialDetail }),
		[templates, initialDetail],
	);
	const selected: DagBoardSelection = selectedId
		? { kind: "node", id: selectedId }
		: null;
	// One node clicked is one node opened — not the one already open, which is
	// also what drawing `selectedId` fires.
	const onSelect = (next: DagBoardSelection) => {
		if (next?.kind === "node" && next.id !== selectedId) onOpenNode?.(next.id);
	};

	return (
		<LayeredDagBoard
			data={data as unknown as GraphData}
			config={settings}
			detail={detail}
			title={title}
			{...(message ? { message } : {})}
			{...(height !== undefined ? { height } : {})}
			selected={selected}
			onSelect={onSelect}
			renderNode={renderTaskNode}
			renderEdge={renderTaskEdge}
			// The palette is Studio's own tokens, under any theme.
			theme="tokens"
			dockSection={SIDE_SECTION}
			// The kit's bar height, the tab strip's; canvas-ui's own is 40px.
			headerClassName="!h-[30px]"
		/>
	);
}
