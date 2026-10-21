/**
 * The Explorer's data board — canvas-ui's `GraphBoard` with what only Studio
 * knows.
 *
 * The board itself — its modes, rows, dock, menus, rail, layout and editing —
 * is canvas's (docs/products/explorer.md; the canvas story
 * `canvas-demos/tools/CanvasExplorer` renders the same component). This file
 * supplies the seams:
 *
 * | Seam | Studio's |
 * |---|---|
 * | theme | `'tokens'` — the board wears Studio's own CSS tokens, and a type's colour is its design-kit data slot, the same one the type lists show |
 * | `onLayoutStart` / `onLayoutEnd` | the query run's telemetry spans: `explorer.layout`, then a one-frame `explorer.render`, then the run's root closes |
 * | `onSlowLayout` | a loading toast with *Cancel* |
 *
 * Everything else the page passes straight through: the host's menu entries,
 * its panels and their options, the expansion and the styling.
 */

import {
	BOARD_IDS,
	type BoardMenuExtras,
	type BoardPanelSpec,
	type DefaultBoardPanelsOptions,
	GraphBoard,
	type GraphBoardLayoutRun,
	type GraphBoardProps,
} from "@invana/canvas-ui";
import type { GraphCanvas, GraphData } from "@invana/graph";
import type { CanvasBackend } from "@invana-studio/canvases";
import {
	endInteraction,
	type InteractionRef,
	startChild,
} from "@invana-studio/core";
import type { CanvasStyling } from "@invana-studio/shell";
import { type ReactNode, useCallback, useRef } from "react";
import { toast } from "sonner";
import type { ExpandRequest } from "./types";

/** Schema slice that drives the node-expand dialog (docs/for-developers/modules/explore/features/graph-canvas.md). */
export interface ExpandMenuSchema {
	nodeTypes: string[];
	edgeTypes: {
		name: string;
		source_node_types: string[];
		target_node_types: string[];
	}[];
}

/** Node-expand handlers: the engine's expansion, and the fine-tune dialog. */
export interface ExpandMenuHandlers {
	schema?: ExpandMenuSchema | null;
	onExpand?: (req: ExpandRequest) => void;
	onOpenFineTune?: (vertexId: string) => void;
}

/** The board's active layout — re-run by an expand that seeds new neighbours. */
export const ACTIVE_LAYOUT_ID = BOARD_IDS.layout;

const LAYOUT_TOAST_ID = "explorer-layout";

interface ExplorerCanvasProps {
	data: GraphData;
	/** Receives the live engine once every piece has registered. */
	onReady: (canvas: GraphCanvas | null) => void;
	/** The clicked element's id, or null. */
	onViewTargetChange: (id: string | null) => void;
	/** On → hover lights up the node's 1st-degree neighbours; off → node only. */
	magnet: boolean;
	/** Telemetry root for the in-flight query run (docs/for-developers/modules/platform/features/telemetry.md). */
	interactionRef?: InteractionRef;
	/** Render backend. Switching it remounts the board. */
	backend: CanvasBackend;
	/** Per-type styling, kept on the board's record. */
	styling: CanvasStyling;
	onStylingChange: (next: CanvasStyling) => void;
	/** Expand the selected nodes' neighbours. */
	onExpand?: (nodeIds: string[]) => void;
	/** Studio's own right-click entries. */
	menus?: BoardMenuExtras;
	/** Studio's options for the rail's panels. */
	panelOptions?: Omit<DefaultBoardPanelsOptions, "styling" | "onStylingChange">;
	/** Studio's own panels, placed into the rail. */
	panels?: (defaults: BoardPanelSpec[]) => BoardPanelSpec[];
	/** The graph's annotations and who is looking (4.8). */
	annotations?: Pick<
		GraphBoardProps,
		| "annotations"
		| "onAnnotationCreate"
		| "onAnnotationUpdate"
		| "onAnnotationDelete"
		| "annotationActor"
	>;
	children?: ReactNode;
}

export function ExplorerCanvas({
	data,
	onReady,
	onViewTargetChange,
	magnet,
	interactionRef,
	backend,
	styling,
	onStylingChange,
	onExpand,
	menus,
	panelOptions,
	panels,
	annotations,
	children,
}: ExplorerCanvasProps) {
	// The annotation view rides on the board's styling record, but the board
	// paints type styling and the view separately.
	const { annotations: annotationView, ...typeStyling } = styling;
	const onAnnotationViewChange = useCallback(
		(next: NonNullable<CanvasStyling["annotations"]>) =>
			onStylingChange({ ...styling, annotations: next }),
		[styling, onStylingChange],
	);
	const onTypeStylingChange = useCallback(
		(next: CanvasStyling) =>
			onStylingChange({
				...next,
				...(annotationView ? { annotations: annotationView } : {}),
			}),
		[annotationView, onStylingChange],
	);
	const telemetry = useLayoutTelemetry(interactionRef, data.edges.length);
	const expand = useCallback(
		(nodeIds: string[]) => onExpand?.(nodeIds),
		[onExpand],
	);
	return (
		<GraphBoard
			data={data}
			preference={backend}
			theme="tokens"
			sizeByConnections
			styling={typeStyling}
			onStylingChange={onTypeStylingChange}
			{...(annotations ?? {})}
			{...(annotationView ? { annotationView } : {})}
			onAnnotationViewChange={onAnnotationViewChange}
			hoverDegree={magnet ? 1 : 0}
			{...(onExpand ? { onExpand: expand } : {})}
			{...(menus ? { menus } : {})}
			{...(panelOptions ? { panelOptions } : {})}
			{...(panels ? { panels } : {})}
			onReady={onReady}
			onViewTargetChange={onViewTargetChange}
			onLayoutStart={telemetry.start}
			onLayoutEnd={telemetry.end}
			onSlowLayout={slowLayoutToast}
		>
			{children}
		</GraphBoard>
	);
}

/**
 * The query run's spans around the board's layout: `explorer.layout` while it
 * solves, then a one-frame `explorer.render`, then the run's root span closes.
 * A layout with no run in flight (a theme repaint, a restore) records nothing.
 */
function useLayoutTelemetry(
	interactionRef: InteractionRef | undefined,
	edgeCount: number,
) {
	const span = useRef<ReturnType<typeof startChild> | null>(null);
	const start = useCallback(
		(run: GraphBoardLayoutRun) => {
			const interaction = interactionRef?.current;
			if (!interaction) return;
			span.current = startChild(interaction, "explorer.layout", {
				"explorer.node_count": run.nodeCount,
				"explorer.edge_count": edgeCount,
			});
		},
		[interactionRef, edgeCount],
	);
	const end = useCallback(() => {
		const interaction = interactionRef?.current;
		const layout = span.current;
		span.current = null;
		if (!interaction || !layout) return;
		layout.end();
		const render = startChild(interaction, "explorer.render");
		requestAnimationFrame(() => {
			render.end();
			// Closes the root span and clears the ref, so later calls are not
			// parented to a finished run.
			if (interactionRef) endInteraction(interactionRef, interaction);
			else interaction.span.end();
		});
	}, [interactionRef]);
	return { start, end };
}

/** A slow solve raises one loading toast that names the wait and offers *Cancel*. */
function slowLayoutToast(run: GraphBoardLayoutRun & { cancel: () => void }) {
	toast.loading(`Arranging ${run.nodeCount} nodes`, {
		id: LAYOUT_TOAST_ID,
		description: "The graph appears when the layout settles.",
		action: { label: "Cancel", onClick: run.cancel },
	});
	return () => toast.dismiss(LAYOUT_TOAST_ID);
}
