/**
 * A plan's tasks and their edges, laid out by ELK, drawn as **Circles** or
 * **Cards** ([task-flow-canvas.md](../../../../docs/for-developers/building-studio/task-flow-canvas.md)).
 *
 * The canvas Storybook's `usecases/by-casestudies/workflow/WorkflowPlan`, minus
 * its layout switcher and theme toggle (TF3 · TF7). The data, the settings and
 * the templates are all props (TF2): a caller imports `settings.json` and
 * `templates.json` from this folder and passes them in with its own data.
 */

import { renderTaskEdge, renderTaskNode } from "@/canvases/taskflow/preview";
import type {
	Detail,
	TaskFlowData,
	TaskFlowTemplates,
} from "@/canvases/taskflow/types";
import { useStudioCanvasTheme } from "@/canvases/theme";
import type { CanvasConfig } from "@invana/canvas";
import {
	BackgroundLayer,
	ClickSelectBehaviour,
	DragNodeBehaviour,
	DragPanBehaviour,
	ElkLayout,
	GraphLayer,
	HoverActivateBehaviour,
	HoverElementPreviewBehaviour,
	TextLODBehaviour,
	TextResolutionLODBehaviour,
	ThemeBehaviour,
	WheelZoomBehaviour,
} from "@invana/canvas-react";
import {
	CanvasMessageBar,
	CanvasSettingsEditorPanel,
	GraphCanvasApp,
	GraphControlsToolbar,
	GraphStatusBar,
	ToolbarItems,
	useSidePanels,
} from "@invana/canvas-ui";
import type {
	ClickSelectBehaviour as ClickSelect,
	GraphCanvas,
	GraphData,
	GraphLayer as GraphLayerEngine,
} from "@invana/graph";
import ElkWorker from "elkjs/lib/elk-worker.min.js?worker";
import { Settings } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const LAYOUT = "elk";
const FIT = { fitCamera: { padding: 60 } };

export interface TaskFlowCanvasProps {
	data: TaskFlowData;
	settings: CanvasConfig;
	templates: TaskFlowTemplates;
	title?: string;
	/** Shown once in the message bar when the canvas is ready. */
	message?: string;
	/** Must match what `settings` starts on; `circles` for `settings.json`. */
	initialDetail?: Detail;
	/** The node drawn selected — a ring, no drag handles (SR52). */
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
	const [detail, setDetail] = useState<Detail>(initialDetail);
	const [canvas, setCanvas] = useState<GraphCanvas | null>(null);
	useStudioCanvasTheme(canvas);
	const applied = useRef(initialDetail);
	const openRef = useRef(onOpenNode);
	openRef.current = onOpenNode;
	const selectedRef = useRef(selectedId);
	selectedRef.current = selectedId;

	// A caller that rebuilds equal data on every render (a dashboard spec does)
	// must not re-seed the graph and re-run the layout each time.
	const signature = JSON.stringify(data);
	const stable = useRef({ signature, data });
	if (stable.current.signature !== signature)
		stable.current = { signature, data };
	const graph = stable.current.data as unknown as GraphData;

	const dock = useSidePanels(
		[
			{
				id: "settings",
				icon: Settings,
				label: "Settings",
				render: (c) => (
					<CanvasSettingsEditorPanel
						canvas={c}
						className="border-0 bg-transparent shadow-none"
					/>
				),
			},
		],
		{ section: { defaultSize: "380px", maxSize: "520px" } },
	);

	const onReady = useCallback(
		(c: GraphCanvas | null) => {
			setCanvas(c);
			if (message) c?.showMessage(message);
		},
		[message],
	);

	// Lay out whatever arrives — `activeLayout` alone does not run on a graph
	// seeded before the layout registers. **Redraw on settle**: a
	// solve that lands in the same beat as the data flush leaves the viewport
	// empty while the store holds the graph — `redraw()` is a pure render pass
	// over the store (ME25).
	useEffect(() => {
		if (!canvas) return;
		return canvas.events.on("layout:run:end", (e) => {
			if (e.id !== LAYOUT) return;
			canvas.layers.get<GraphLayerEngine>("graph")?.redraw();
			// A fit frames a five-step plan at 2x on a wide page; nothing reads
			// better larger than it was drawn, so the fit never zooms past 100%.
			requestAnimationFrame(() => {
				if (canvas.camera.scale > 1) canvas.camera.setZoom(1);
			});
		});
	}, [canvas]);

	useEffect(() => {
		if (!canvas || graph.nodes.length === 0) return;
		canvas.stopLayout();
		void canvas.runLayout(LAYOUT, FIT);
	}, [canvas, graph]);

	// A switch patches the template, and a new node size needs new positions.
	useEffect(() => {
		if (!canvas || applied.current === detail) return;
		applied.current = detail;
		canvas.stopLayout();
		canvas.update(templates[detail]);
		void canvas.runLayout(LAYOUT, FIT);
	}, [canvas, detail, templates]);

	// One node clicked is one node opened — not the one already open, which is
	// also what drawing `selectedId` fires.
	useEffect(() => {
		const select = canvas?.behaviours.get<ClickSelect>("click-select");
		if (!select) return;
		return select.events.on("selection:change", (snapshot) => {
			const [id] = snapshot.shapeIds;
			if (snapshot.shapeIds.length === 1 && id !== selectedRef.current)
				openRef.current?.(id);
		});
	}, [canvas]);

	useEffect(() => {
		const select = canvas?.behaviours.get<ClickSelect>("click-select");
		if (!select) return;
		if (selectedId) select.select(selectedId);
		else select.clearSelection();
	}, [canvas, selectedId]);

	return (
		<GraphCanvasApp
			data={graph}
			config={settings}
			onReady={onReady}
			bundle={false}
			height={height}
			header={{
				// The kit's bar height, the tab strip's; canvas-ui's own is 40px.
				className: "!h-[30px]",
				title,
				// Read-only (SR52): no undo, edge-routing or erase — which is also
				// what lets Detail and Settings fit at section width.
				center: (
					<GraphControlsToolbar
						sections={{
							layout: false,
							history: false,
							style: false,
							edit: false,
							grid: false,
						}}
					/>
				),
				right: () => (
					<ToolbarItems
						orientation="horizontal"
						items={[
							{
								type: "select",
								key: "detail",
								label: "Detail",
								value: detail,
								options: { circles: "Circles", cards: "Cards" },
								onChange: (v) => setDetail(v as Detail),
							},
							...dock.items,
						]}
					/>
				),
			}}
			footer={{ left: <GraphStatusBar />, right: <CanvasMessageBar /> }}
			right={dock.region}
		>
			<BackgroundLayer id="background" />
			<GraphLayer id="graph" data={graph} />
			<ThemeBehaviour id="theme" />
			<DragPanBehaviour id="pan" />
			<WheelZoomBehaviour id="wheel" />
			<DragNodeBehaviour id="drag-node" targetLayerId="graph" />
			<HoverActivateBehaviour id="hover" targetLayerId="graph" />
			<ClickSelectBehaviour id="click-select" targetLayerId="graph" />
			<ElkLayout
				id={LAYOUT}
				targetLayerId="graph"
				fitPadding={60}
				// elkjs' worker must go through Vite's `?worker`, or it 404s.
				options={{ workerFactory: () => new ElkWorker() }}
			/>
			<TextResolutionLODBehaviour id="label-resolution" targetLayerId="graph" />
			<TextLODBehaviour id="text-lod" targetLayerId="graph" />
			<HoverElementPreviewBehaviour
				targetLayerId="graph"
				renderNode={renderTaskNode}
				renderEdge={renderTaskEdge}
			/>
		</GraphCanvasApp>
	);
}
