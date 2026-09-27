/**
 * Models drawn as frames of node types, with the stitches between them
 * ([graph-model-canvas.md](../../../../docs/for-developers/building-studio/graph-model-canvas.md)).
 *
 * The canvas Storybook's `usecases/by-casestudies/global-model/GlobalModel`,
 * copied: the same behaviours, header, footer, Detail switcher, settings and
 * templates (GM1) — laid out by ELK alone, opening on circles (GM3 · GM4). What is Studio's own: the JSON names
 * no model and no type, so it is filled in against the data and the live theme
 * (GM5–GM7); the colours are Studio's palette, and a frame wears its model's
 * hue (GM8); a stitch is dashed (GM9) and, where the host asks for it, declared
 * by a drag (GM12). A host reads and drives the selection, and adds nothing
 * else.
 */

import {
	type LiveColors,
	detailPatch,
	initialConfig,
	readLiveColors,
} from "@/canvases/model/config";
import { renderModelEdge, renderModelNode } from "@/canvases/model/preview";
import { decorate } from "@/canvases/model/style";
import type {
	Detail,
	GraphModelTemplates,
	ModelCanvasSelection,
	ModelGraphData,
} from "@/canvases/model/types";
import type { CanvasConfig } from "@invana/canvas";
import {
	BackgroundLayer,
	CanvasThemeSync,
	ClickSelectBehaviour,
	CollapseExpandBehaviour,
	DragNodeBehaviour,
	DragPanBehaviour,
	DrawEdgeBehaviour,
	ElkLayout,
	GraphLayer,
	HoverActivateBehaviour,
	HoverElementPreviewBehaviour,
	type RenderPreference,
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
	GraphLayer as GraphLayerEngine,
} from "@invana/graph";
import { useTheme } from "@invana/themes";
import ElkWorker from "elkjs/lib/elk-worker.min.js?worker";
import { Link2, Moon, Settings, Sun } from "lucide-react";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

export const MODEL_LAYER_ID = "graph";
const FIT = { fitCamera: { padding: 60 } };
/** The one layout every modeller canvas runs (GM3). */
const LAYOUT = "elk";

export interface GraphModelCanvasProps {
	data: ModelGraphData;
	settings: CanvasConfig;
	templates: GraphModelTemplates;
	title?: string;
	/** Shown once in the message bar when the canvas is ready. */
	message?: string;
	/** The Detail the canvas opens on — circles, on every modeller canvas (GM4). */
	initialDetail?: Detail;
	/** The node or edge drawn selected. */
	selected?: ModelCanvasSelection;
	/** A click on one node or edge, or on nothing. */
	onSelect?: (selection: ModelCanvasSelection) => void;
	/** For a host that gives no height of its own; default fills the parent. */
	height?: number;
	/** Declare a stitch by dragging a type onto another (GM12). Left out, the canvas has no Stitch tool. */
	stitching?: GraphModelStitching;
	/**
	 * The page's render backend (GM13). Fixed at init, so a change remounts the
	 * canvas. Left out, the canvas picks WebGPU where it can.
	 */
	backend?: RenderPreference;
}

/**
 * The stitch gesture (GM12): the Stitch tool in the header toolbar arms a drag
 * from one type to another, and the declare card docks on the right.
 */
export interface GraphModelStitching {
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

const STITCH_PANEL = "stitch";

/** The theme's colours, re-read one frame after the theme class lands. */
function useLiveColors(): LiveColors {
	const { variantId, isDark } = useTheme();
	const [colors, setColors] = useState(readLiveColors);
	// biome-ignore lint/correctness/useExhaustiveDependencies: variantId/isDark are trigger-only — the read is of the live DOM tokens
	useEffect(() => {
		// Same colours, same object — a new one would re-seed the drawing.
		const id = requestAnimationFrame(() => {
			const next = readLiveColors();
			setColors((prev) =>
				JSON.stringify(prev) === JSON.stringify(next) ? prev : next,
			);
		});
		return () => cancelAnimationFrame(id);
	}, [variantId, isDark]);
	return colors;
}

const sameSelection = (a: ModelCanvasSelection, b: ModelCanvasSelection) =>
	a?.kind === b?.kind && a?.id === b?.id;

export function GraphModelCanvas({
	data,
	settings,
	templates,
	title = "Global model",
	message = "Hover an edge for its stitch rule — only stitches cross a model frame",
	initialDetail = "high",
	selected = null,
	onSelect,
	height,
	stitching,
	backend,
}: GraphModelCanvasProps) {
	// `select` drags a type; `stitch` drags a crossing. Both start on node
	// pointer-down, so only one is ever on. A drag moves a type, as in the story;
	// **Shift**-drag stitches, and the Stitch toggle makes that sticky (GM12).
	const [tool, setTool] = useState<"select" | "stitch">("select");
	const [shift, setShift] = useState(false);
	useEffect(() => {
		if (!stitching) return;
		const down = (e: KeyboardEvent) => e.key === "Shift" && setShift(true);
		const up = (e: KeyboardEvent) => e.key === "Shift" && setShift(false);
		const blur = () => setShift(false);
		window.addEventListener("keydown", down);
		window.addEventListener("keyup", up);
		window.addEventListener("blur", blur);
		return () => {
			window.removeEventListener("keydown", down);
			window.removeEventListener("keyup", up);
			window.removeEventListener("blur", blur);
		};
	}, [stitching]);
	const stitchingNow = !!stitching && (tool === "stitch" || shift);
	const stitchRef = useRef(stitching);
	stitchRef.current = stitching;
	const [detail, setDetail] = useState<Detail>(initialDetail);
	const [canvas, setCanvas] = useState<GraphCanvas | null>(null);
	const colors = useLiveColors();
	const selectRef = useRef(onSelect);
	selectRef.current = onSelect;
	const selectedRef = useRef(selected);
	selectedRef.current = selected;

	// A caller that rebuilds equal data on every render must not re-seed the
	// graph and re-run the layout each time.
	const signature = JSON.stringify(data);
	const stable = useRef({ signature, data });
	if (stable.current.signature !== signature)
		stable.current = { signature, data };
	const model = stable.current.data;

	const drawn = useMemo(() => decorate(model, colors), [model, colors]);

	// The config the canvas mounts on; every later change is an `update`.
	const [config] = useState(() =>
		initialConfig(
			settings,
			detailPatch(settings, templates, initialDetail, model, colors.hues),
		),
	);

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
			...(stitching
				? [
						{
							id: STITCH_PANEL,
							icon: Link2,
							label: "Declare a stitch",
							// Opened by an accepted drag only — its toggle is kept out of the
							// header, so the Stitch tool is the one link icon (GM12).
							render: () => stitchRef.current?.panel ?? null,
						},
					]
				: []),
		],
		{ section: { defaultSize: "380px", maxSize: "520px" } },
	);

	// A drag that is accepted opens the dock on the card, and the card closing
	// itself (staged, or cancelled) closes the dock; closing the dock from its
	// toggle closes the card.
	const hasPanel = !!stitching?.panel;
	const { open: openDock, openId } = dock;
	const hadPanel = useRef(false);
	const openIdRef = useRef(dock.openId);
	openIdRef.current = dock.openId;
	useEffect(() => {
		if (hasPanel) openDock(STITCH_PANEL);
		else if (hadPanel.current && openIdRef.current === STITCH_PANEL)
			openDock(null);
		hadPanel.current = hasPanel;
	}, [hasPanel, openDock]);
	const wasOpen = useRef(false);
	useEffect(() => {
		const isOpen = openId === STITCH_PANEL;
		if (wasOpen.current && !isOpen) stitchRef.current?.onClosePanel();
		wasOpen.current = isOpen;
	}, [openId]);

	/**
	 * The drag names both ends. It always returns `null` — the store must not
	 * gain an edge, because a stitch is a declared row, not a drawing.
	 */
	const canvasRef = useRef(canvas);
	canvasRef.current = canvas;
	const createEdge = useCallback((source: string, target: string) => {
		const refusal = stitchRef.current?.onStitch(source, target) ?? null;
		if (refusal) canvasRef.current?.showMessage(refusal);
		return null;
	}, []);

	const onReady = useCallback(
		(c: GraphCanvas | null) => {
			setCanvas(c);
			if (message) c?.showMessage(message);
		},
		[message],
	);

	// The mount config again, once the canvas is ready. Under React StrictMode
	// the engine is created, destroyed and created again, and on the second one
	// the behaviours register after the root applied `config` — they keep their
	// constructor defaults, so `collapse-expand` never re-lays out, `hover`
	// loses its degree and `text-lod` its band. The definition holds the right
	// config; this hands it to the live instances (GM14).
	useEffect(() => {
		if (canvas) canvas.update(config);
	}, [canvas, config]);

	// Redraw on settle: a solve that lands in the same beat as the data flush
	// leaves the viewport empty while the store holds the graph (ME25).
	useEffect(() => {
		if (!canvas) return;
		return canvas.events.on("layout:run:end", (e) => {
			if (e.id === LAYOUT)
				canvas.layers.get<GraphLayerEngine>(MODEL_LAYER_ID)?.redraw();
		});
	}, [canvas]);

	// A theme change writes the palette's card and divider colours over every
	// group node's own style (`GraphLayer.applyTheme`), which would leave each
	// frame white. Its hue goes back on after the layer's pass — this listener
	// subscribes after the layer's, so it runs second (GM8).
	useEffect(() => {
		if (!canvas) return;
		const rehue = () => {
			const store = canvas.layers.get<GraphLayerEngine>(MODEL_LAYER_ID)?.store;
			if (!store) return;
			for (const n of drawn.nodes)
				if (n.style) store.updateNode(n.id, { style: n.style });
		};
		rehue();
		return canvas.events.on("theme:change", rehue);
	}, [canvas, drawn]);

	// New data, a Detail switch, or a new theme: patch the template, then
	// re-run ELK — a new node size needs new positions. `fitCamera`
	// moves the camera with the nodes' glide, as the story does.
	useEffect(() => {
		if (!canvas || drawn.nodes.length === 0) return;
		canvas.stopLayout();
		canvas.update({
			...detailPatch(settings, templates, detail, model, colors.hues),
			activeLayout: LAYOUT,
		});
		void canvas.runLayout(LAYOUT, FIT);
	}, [canvas, drawn, model, detail, settings, templates, colors.hues]);

	// `settings.json` switches node drag on, as the story's does — so the tool
	// re-asserts itself after the config lands: while stitching a drag draws, it
	// never moves the type (GM12).
	useEffect(() => {
		const drag = canvas?.behaviours.get("drag-node");
		if (!drag) return;
		if (stitchingNow) drag.disable();
		else drag.enable();
	}, [canvas, stitchingNow]);

	// One element clicked is one element selected; an empty click clears it.
	useEffect(() => {
		const select = canvas?.behaviours.get<ClickSelect>("click-select");
		if (!select) return;
		return select.events.on("selection:change", (snapshot) => {
			const [node] = snapshot.shapeIds;
			const [edge] = snapshot.connectorIds;
			const next: ModelCanvasSelection =
				snapshot.shapeIds.length + snapshot.connectorIds.length !== 1
					? null
					: node
						? { kind: "node", id: node }
						: { kind: "edge", id: edge as string };
			if (!sameSelection(next, selectedRef.current)) selectRef.current?.(next);
		});
	}, [canvas]);

	useEffect(() => {
		const select = canvas?.behaviours.get<ClickSelect>("click-select");
		if (!select) return;
		if (!selected) select.clearSelection();
		else
			select.select(
				selected.id,
				selected.kind === "node" ? "shape" : "connector",
			);
	}, [canvas, selected]);

	return (
		<GraphCanvasApp
			data={drawn}
			config={config}
			onReady={onReady}
			bundle={false}
			preference={backend}
			instanceKey={backend}
			height={height}
			header={{
				title,
				center: (
					<GraphControlsToolbar
						sections={{ layout: false }}
						extraItems={
							stitching
								? [
										{
											key: "stitch",
											type: "toggle",
											icon: Link2,
											label:
												"Stitch mode — drag a type onto a type in another model (or hold Shift)",
											active: stitchingNow,
											onToggle: () =>
												setTool((t) => (t === "stitch" ? "select" : "stitch")),
										},
									]
								: undefined
						}
					/>
				),
				right: (ctx) => (
					<ToolbarItems
						orientation="horizontal"
						items={[
							{
								type: "select",
								key: "detail",
								label: "Detail",
								value: detail,
								options: {
									high: "High — circles",
									medium: "Medium — cards",
									low: "Low — schema cards",
								},
								onChange: (v) => setDetail(v as Detail),
							},
							...dock.items.filter((item) => item.key !== STITCH_PANEL),
							{
								type: "toggle",
								key: "theme",
								icon: Sun,
								activeIcon: Moon,
								label: "Switch to dark theme",
								activeLabel: "Switch to light theme",
								active: ctx.themeKind === "dark",
								onToggle: ctx.toggleTheme,
							},
						]}
					/>
				),
			}}
			footer={{ left: <GraphStatusBar />, right: <CanvasMessageBar /> }}
			right={dock.region}
		>
			<BackgroundLayer id="background" />
			<GraphLayer id={MODEL_LAYER_ID} data={drawn} />
			<ThemeBehaviour id="theme" />
			<CanvasThemeSync />
			<DragPanBehaviour id="pan" />
			<WheelZoomBehaviour id="wheel" />
			<DragNodeBehaviour
				id="drag-node"
				targetLayerId={MODEL_LAYER_ID}
				enabled={!stitchingNow}
			/>
			{stitching ? (
				<DrawEdgeBehaviour
					id="draw-edge"
					targetLayerId={MODEL_LAYER_ID}
					enabled={stitchingNow}
					createEdge={createEdge}
				/>
			) : null}
			<HoverActivateBehaviour id="hover" targetLayerId={MODEL_LAYER_ID} />
			<ClickSelectBehaviour id="click-select" targetLayerId={MODEL_LAYER_ID} />
			{/* ELK, and only ELK (GM3). */}
			<ElkLayout
				id={LAYOUT}
				targetLayerId={MODEL_LAYER_ID}
				fitPadding={60}
				// elkjs' worker must go through Vite's `?worker`, or it 404s.
				options={{ workerFactory: () => new ElkWorker() }}
			/>
			<CollapseExpandBehaviour
				id="collapse-expand"
				targetLayerId={MODEL_LAYER_ID}
				enabled
			/>
			<TextResolutionLODBehaviour
				id="label-resolution"
				targetLayerId={MODEL_LAYER_ID}
			/>
			{/* Card text is unreadable below 40% zoom — drop it (band lives in `settings.json`). */}
			<TextLODBehaviour id="text-lod" targetLayerId={MODEL_LAYER_ID} />
			<HoverElementPreviewBehaviour
				targetLayerId={MODEL_LAYER_ID}
				renderNode={renderModelNode}
				renderEdge={renderModelEdge}
			/>
		</GraphCanvasApp>
	);
}
