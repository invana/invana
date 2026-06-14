// Explorer graph visualiser — the read-capable canvas for query results.
//
// Modeled on the canvas-react `GraphVisualiserApp` story: a full set of
// behaviours (pan / drag-node / wheel / pinch / hover / select / view) plus a
// section-hook-driven toolbar surfaced in the app header (see
// `ExplorerHeaderToolbar`). The header lives outside the `<Canvas>` subtree (in
// GraphDetail's header), so ExplorerPage lifts a `CanvasContext.Provider` above
// the shell and feeds it the live engine published by `<CanvasBridge>` (the last
// child here). Every header / inspector control then resolves the same instance.
//
// Distinct from the Modeller's `SchemaCanvas.tsx`, which wires the same
// `@invana/canvas-react` bindings into a tool-driven schema editor.

import {
	BackgroundLayer,
	BrushSelectBehaviour,
	type CanvasProps,
	Canvas as CanvasRoot,
	ClickSelectBehaviour,
	ClickViewBehaviour,
	ColorByLabelBehaviour,
	D3ForceLayout,
	DragNodeBehaviour,
	DragPanBehaviour,
	GraphBackgroundContextMenu,
	type GraphBackgroundMenuContext,
	GraphClipboardProvider,
	GraphEdgeContextMenu,
	type GraphEdgeMenuContext,
	GraphHistoryProvider,
	GraphLayer,
	GraphNodeContextMenu,
	type GraphNodeMenuContext,
	HoverActivateBehaviour,
	LabelResolutionLODBehaviour,
	LassoSelectBehaviour,
	type LayoutFactory,
	MiniMapLayer,
	PinchZoomBehaviour,
	type ToolbarItem,
	ToolbarItems,
	type UseClipboardResult,
	WheelZoomBehaviour,
	useCanvas,
	useClipboard,
	useGraphCanvas,
	useGraphCanvasUpdate,
	useGrid,
	useHistorySection,
	useLayout,
	useSelectMode,
	useStyleEditorSection,
	useViewContext,
	useViewSection,
} from "@invana/canvas-react";
import type {
	GraphCanvas as GraphCanvasEngine,
	GraphData,
	GraphNode,
} from "@invana/graph";
import type * as graph from "@invana/graph";
import { D3ForceLayout as D3ForceLayoutEngine } from "@invana/graph-layout-d3-force";
import { ElkLayout } from "@invana/graph-layout-elkjs";
import { useTheme } from "@invana/themes";
import {
	type MenuItem,
	RichSelect,
	type RichSelectOption,
	ToggleGroup,
	ToggleGroupItem,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@invana/ui";
import {
	Cable,
	CornerDownRight,
	Grid3x3,
	Lasso,
	Lock,
	LockOpen,
	type LucideIcon,
	Magnet,
	Maximize,
	Minus,
	MousePointer2,
	Network,
	Orbit,
	Play,
	Redo2,
	RefreshCw,
	Share2,
	Spline,
	SquareDashedMousePointer,
	Undo2,
	Waypoints,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import {
	type InteractionRef,
	endInteraction,
	startChild,
} from "../../../../services/telemetry/tracer";

// `CanvasConfig` isn't re-exported by canvas-react@0.0.4 — derive it from the
// `<Canvas config>` prop so the option objects stay precisely typed.
type CanvasConfig = NonNullable<CanvasProps["config"]>;

// PixiJS render backend. `@invana/canvas-react` defaults to `"webgpu"`; we default the
// Explorer to `"webgl"` (see ExplorerPage) because WebGPU intermittently crashes
// in PixiJS 8 — the header switcher lets a user flip between them at runtime.
export type CanvasBackend = "webgl" | "webgpu";
const BACKEND_LABEL: Record<CanvasBackend, string> = {
	webgl: "WebGL",
	webgpu: "WebGPU",
};

// "Focus on node" zooms in to at least this scale so the focused node is
// comfortably sized.
const FOCUS_ZOOM = 2;

// Distinct colour per node label (its graph-DB type). `ColorByLabelBehaviour`
// defaults `nodeLabel` to `node.type`, which our adapter stamps with the
// vertex/edge label.
const PALETTE = [
	0x9ca3af, 0xef4444, 0xf59e0b, 0xeab308, 0x10b981, 0x06b6d4, 0x3b82f6,
	0x8b5cf6, 0xec4899, 0x14b8a6, 0xa3e635,
] as const;

// Forces for the registered active layout (run on every query repaint by
// `<AutoLayoutBridge>`). `animate: true` (the d3-force default) writes positions
// back on every tick, so a fresh query's nodes fan out from the origin instead
// of snapping into place — the settling motion reads as "the graph loading".
const FORCE_OPTS = {
	animate: false,
	charge: { strength: -300 },
	link: { distance: 80 },
	center: { x: 0, y: 0 },
	collide: { radius: 14 },
};

// Id of the registered active layout — shared by the `<D3ForceLayout>` that
// registers it and the `<AutoLayoutBridge>` that runs it on data change.
const ACTIVE_LAYOUT_ID = "d3-force-active";

// Theme-independent settings, keyed by instance id. Theme-driven colours live in
// APP_LIGHT/APP_DARK and are pushed via `useGraphCanvasUpdate` by `<ThemeBridge>`.
// `activeLayout` points at the registered `<D3ForceLayout id="d3-force-active">`
// so the header's "Re-render" (`canvas.refresh()`) re-runs it; new query results
// are (re-)laid out by `<AutoLayoutBridge>`, which calls `runLayout` on the same
// id once the layer has ingested the data.
const APP_OPTIONS: CanvasConfig = {
	activeLayout: ACTIVE_LAYOUT_ID,
	layers: {
		background: { type: "pattern", patternType: "grid", alpha: 0.5 },
		graph: {
			node: {
				style: {
					shape: { kind: "circle", radius: 8 },
					bgStrokeWidth: 1.5,
					labelFontSize: 11,
					labelPlacement: "bottom",
					labelOffsetY: 4,
				},
			},
			edge: { style: { strokeWidth: 1, arrowTargetShape: "none" } },
		},
		minimap: { position: "bottom-left", margin: { x: 20 } },
	},
	behaviours: {
		pan: { enabled: true },
		"drag-node": { enabled: true },
		wheel: { enabled: true },
		pinch: { enabled: true },
		hover: { enabled: true },
		"click-select": { enabled: true },
		"brush-select": { enabled: false },
		"lasso-select": { enabled: false },
		"click-view": { enabled: true },
		"label-lod": { enabled: true },
	},
};

const APP_LIGHT: CanvasConfig = {
	layers: {
		background: { backgroundColor: "#f8fafc", color: "#e2e8f0" },
		graph: {
			node: { style: { labelColor: 0x334155, bgStrokeColor: 0xffffff } },
			edge: { style: { strokeColor: 0x475569, arrowTargetColor: 0x475569 } },
		},
		minimap: { backgroundColor: 0xf8fafc, borderColor: 0x94a3b8 },
	},
};
const APP_DARK: CanvasConfig = {
	layers: {
		background: { backgroundColor: "#0f172a", color: "#1e293b" },
		graph: {
			node: { style: { labelColor: 0xe2e8f0, bgStrokeColor: 0x0f172a } },
			edge: { style: { strokeColor: 0x64748b, arrowTargetColor: 0x64748b } },
		},
		minimap: { backgroundColor: 0x0f172a, borderColor: 0x334155 },
	},
};

// Layout factories for the header picker — each call yields a fresh instance.
// Module-level so the reference stays stable across renders (keeps `useLayout`'s
// `applyLayout` stable).
const LAYOUTS: Record<string, LayoutFactory> = {
	"d3-force": () =>
		new D3ForceLayoutEngine({
			charge: { strength: -160 },
			link: { distance: 56 },
			collide: { radius: 14 },
			animate: false,
		}),
	"elk-layered": () =>
		new ElkLayout({ algorithm: "layered", direction: "RIGHT" }),
	"elk-stress": () => new ElkLayout({ algorithm: "stress" }),
};
const LAYOUT_LABEL: Record<string, string> = {
	"d3-force": "Force (d3)",
	"elk-layered": "Layered (ELK)",
	"elk-stress": "Stress (ELK)",
};
const LAYOUT_ICON: Record<string, LucideIcon> = {
	"d3-force": Share2,
	"elk-layered": Network,
	"elk-stress": Orbit,
};

// Select-mode key → registered behaviour id. `useSelectMode` enables exactly one
// entry and disables the rest; click maps to an empty id (no drag-select armed).
const SELECT_MODE_IDS = {
	click: "",
	brush: "brush-select",
	lasso: "lasso-select",
};
const SELECT_LABEL: Record<string, string> = {
	click: "Click select",
	brush: "Brush select",
	lasso: "Lasso select",
};
const SELECT_ICONS = {
	click: MousePointer2,
	brush: SquareDashedMousePointer,
	lasso: Lasso,
};
// One-line hints shown under each mode in the header's `RichSelect` picker.
const SELECT_DESC: Record<string, string> = {
	click: "Click nodes to select; shift-click to add",
	brush: "Drag a rectangle to select everything inside",
	lasso: "Draw a freeform loop to select everything inside",
};
// Header select-mode picker rows, derived from the maps above (display order
// follows `SELECT_MODE_IDS`).
const SELECT_MODE_OPTIONS: RichSelectOption[] = Object.keys(
	SELECT_MODE_IDS,
).map((key) => ({
	value: key,
	label: SELECT_LABEL[key],
	description: SELECT_DESC[key],
	icon: SELECT_ICONS[key as keyof typeof SELECT_ICONS],
}));

// Property keys tried, in order, for a node's drawn label. Graph DBs hand back
// opaque internal ids (e.g. `4:24a7…:1555`), which overlap into an unreadable
// blob — so prefer a human-friendly property, then the node's label/type, and
// only fall back to the id. Tune the list to taste.
const NODE_LABEL_KEYS = [
	"name",
	"title",
	"label",
	"code",
	"desc",
	"description",
];

function nodeLabelText(n: GraphNode): string {
	const data = (n.data ?? {}) as Record<string, unknown>;
	for (const key of NODE_LABEL_KEYS) {
		const v = data[key];
		if (v != null && v !== "") return String(v);
	}
	if (n.type) return String(n.type);
	return String(n.id);
}

// Icon per edge routing type, shown on the edge-routing picker.
const EDGE_TYPE_ICONS = {
	straight: Minus,
	orth: CornerDownRight,
	bezier: Spline,
	rounded: Waypoints,
	smooth: Cable,
};

// ─────────────────────────────────────────────────────────────────────────────
// Right-click menu builders — navigation + selection + highlight + clipboard.
// Each is a single engine method off the `canvas` handed in on `ctx`; the
// clipboard ops (cut / copy / paste / delete) come from `useClipboard` and are
// threaded in by `<CanvasContextMenus>`. Cut / Copy / Delete act on the current
// selection, so a right-clicked element that isn't selected is selected first.
// ─────────────────────────────────────────────────────────────────────────────

function nodeItems(
	{ id, canvas }: GraphNodeMenuContext,
	clip: UseClipboardResult,
): MenuItem[] {
	const layer = canvas.layers.get<graph.GraphLayer>("graph");
	if (!layer) return [];
	const select =
		canvas.behaviours.get<graph.ClickSelectBehaviour>("click-select");
	const ensureSelected = () => {
		if (!select?.isSelected(id)) select?.select(id, "shape");
	};
	return [
		{
			id: "focus",
			label: "Focus on node",
			onClick: () => {
				select?.select(id, "shape");
				layer.focusNode(id, { zoom: FOCUS_ZOOM });
			},
		},
		{
			id: "select",
			label: "Select node",
			onClick: () => select?.select(id, "shape"),
		},
		{
			id: "select-hood",
			label: "Select neighbourhood",
			onClick: () => select?.selectNeighbourhood(id),
		},
		{
			id: "highlight",
			label: "Highlight neighbours",
			onClick: () => layer.highlightNeighbourhood(id),
		},
		{
			id: "cut",
			label: "Cut",
			shortcut: "⌘X",
			onClick: () => {
				ensureSelected();
				clip.cut();
			},
		},
		{
			id: "copy",
			label: "Copy",
			shortcut: "⌘C",
			onClick: () => {
				ensureSelected();
				clip.copy();
			},
		},
		{
			id: "paste",
			label: "Paste",
			shortcut: "⌘V",
			onClick: () => clip.paste(),
		},
		{
			id: "delete",
			label: "Delete",
			shortcut: "⌫",
			onClick: () => {
				ensureSelected();
				clip.remove();
			},
		},
	];
}

function edgeItems(
	{ id, canvas }: GraphEdgeMenuContext,
	clip: UseClipboardResult,
): MenuItem[] {
	const layer = canvas.layers.get<graph.GraphLayer>("graph");
	if (!layer) return [];
	const store = layer.store;
	const select =
		canvas.behaviours.get<graph.ClickSelectBehaviour>("click-select");
	const ensureSelected = () => {
		if (!select?.isSelected(id)) select?.select(id, "connector");
	};
	return [
		{
			id: "focus",
			label: "Focus on edge",
			onClick: () => {
				select?.select(id, "connector");
				layer.focusEdges([id]);
			},
		},
		{
			id: "select",
			label: "Select edge",
			onClick: () => select?.select(id, "connector"),
		},
		{
			id: "highlight",
			label: "Highlight edge",
			onClick: () => {
				// One batch → one flush → one paint.
				store.batch(() => {
					store.addEdgeState(id, "highlighted");
					const ed = store.getEdge(id);
					if (ed) {
						store.addNodeState(ed.source, "highlighted");
						store.addNodeState(ed.target, "highlighted");
					}
				});
			},
		},
		{
			id: "cut",
			label: "Cut",
			shortcut: "⌘X",
			onClick: () => {
				ensureSelected();
				clip.cut();
			},
		},
		{
			id: "copy",
			label: "Copy",
			shortcut: "⌘C",
			onClick: () => {
				ensureSelected();
				clip.copy();
			},
		},
		{
			id: "delete",
			label: "Delete",
			shortcut: "⌫",
			onClick: () => {
				ensureSelected();
				clip.remove();
			},
		},
	];
}

function backgroundItems(
	{ canvas }: GraphBackgroundMenuContext,
	clip: UseClipboardResult,
): MenuItem[] {
	const layer = canvas.layers.get<graph.GraphLayer>("graph");
	if (!layer) return [];
	const store = layer.store;
	const select =
		canvas.behaviours.get<graph.ClickSelectBehaviour>("click-select");
	return [
		// Selection mode (click / brush / lasso) lives in the header toolbar's
		// `RichSelect` picker — see `HeaderToolbarItems`.
		{
			id: "fit",
			label: "Fit to content",
			onClick: () => canvas.camera.fitContent(layer.getBounds(), 80),
		},
		{
			id: "paste",
			label: "Paste",
			shortcut: "⌘V",
			onClick: () => clip.paste(),
		},
		{
			id: "select-all",
			label: "Select all",
			shortcut: "⌘A",
			onClick: () => select?.selectAll(),
		},
		{
			id: "clear-sel",
			label: "Clear selection",
			onClick: () => select?.clearSelection(),
		},
		{
			id: "clear-hl",
			label: "Clear highlights",
			onClick: () => {
				store.clearNodeState("highlighted");
				store.clearEdgeState("highlighted");
			},
		},
	];
}

/**
 * The three right-click menus, wrapped so they can read the clipboard. The menu
 * `items` builders are plain functions (no hooks), so `useClipboard` is read
 * here and threaded into each via a memoised closure. Mounted inside a
 * `<GraphClipboardProvider>` so the buffer + selection wiring resolve.
 */
function CanvasContextMenus() {
	const clip = useClipboard();
	const node = useCallback(
		(ctx: GraphNodeMenuContext) => nodeItems(ctx, clip),
		[clip],
	);
	const edge = useCallback(
		(ctx: GraphEdgeMenuContext) => edgeItems(ctx, clip),
		[clip],
	);
	const background = useCallback(
		(ctx: GraphBackgroundMenuContext) => backgroundItems(ctx, clip),
		[clip],
	);
	return (
		<>
			<GraphNodeContextMenu items={node} />
			<GraphEdgeContextMenu items={edge} />
			<GraphBackgroundContextMenu items={background} />
		</>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Bridges (rendered inside <Canvas>, so the hooks resolve the live engine).
// ─────────────────────────────────────────────────────────────────────────────

/** Publishes the live engine to the lifted context — must be the LAST child. */
function CanvasBridge({
	onReady,
}: {
	onReady: (canvas: GraphCanvasEngine | null) => void;
}) {
	const canvas = useGraphCanvas();
	useEffect(() => {
		onReady(canvas);
		return () => onReady(null);
	}, [canvas, onReady]);
	return null;
}

/**
 * Runs the active layout whenever the query results change.
 *
 * canvas-react@0.0.4's config-first `<D3ForceLayout id>` only *registers* the
 * layout on `canvas.layouts` — it doesn't `apply()` it, and neither it nor the
 * engine re-runs the active layout on data/topology change (only an explicit
 * `canvas.refresh()` / `runLayout()` does). Without this, a fresh query's nodes
 * land at the store's default origin and pile up in the centre, unlaid-out.
 *
 * Mounted *after* `<GraphLayer>`, so on each new `data` reference this effect
 * fires after the layer's own `setData` effect (sibling effects run in mount
 * order) — the store already holds the new topology when we run the layout. The
 * registered layout's `end → camera.fitContent` (wired by `<D3ForceLayout>`)
 * then frames the result.
 */
function AutoLayoutBridge({
	data,
	interactionRef,
}: {
	data: GraphData;
	interactionRef?: InteractionRef;
}) {
	const canvas = useGraphCanvas();
	useEffect(() => {
		if (!canvas || data.nodes.length === 0) return;

		// Surface layout progress on the shared message channel — a sticky
		// "Laying out…" while d3-force settles, replaced by a "ready" that
		// auto-clears after 3s. This is what lights up <CanvasMessageBar> on every
		// query run (the only path that emits to the channel automatically).
		canvas.showMessage(`Laying out ${data.nodes.length} nodes…`);

		// No active query run → just lay out (e.g. theme repaint, session restore).
		const interaction = interactionRef?.current ?? null;
		if (!interaction) {
			void canvas
				.runLayout(ACTIVE_LAYOUT_ID)
				.finally(() => canvas.showMessage("Graph ready", 3000));
			return;
		}

		// `explorer.layout` span (RFC-025) — d3-force settle. runLayout resolves
		// when the layout settles; on settle we open a one-frame `explorer.render`
		// span (first painted frame) and then close the run's root span.
		const layoutSpan = startChild(interaction, "explorer.layout", {
			"explorer.node_count": data.nodes.length,
			"explorer.edge_count": data.edges.length,
		});
		let cancelled = false;
		void canvas.runLayout(ACTIVE_LAYOUT_ID).finally(() => {
			layoutSpan.end();
			if (cancelled) return;
			canvas.showMessage("Graph ready", 3000);
			const renderSpan = startChild(interaction, "explorer.render");
			requestAnimationFrame(() => {
				renderSpan.end();
				// Closes the root span and clears the ref + module-level active slot,
				// so post-run API calls aren't parented to a finished run.
				if (interactionRef) endInteraction(interactionRef, interaction);
				else interaction.span.end();
			});
		});
		return () => {
			cancelled = true;
		};
	}, [canvas, data, interactionRef]);
	return null;
}

/** Follows studio's theme: pushes the matching colour patch via `update()`. */
function ThemeBridge() {
	const { isDark } = useTheme();
	const update = useGraphCanvasUpdate();
	useEffect(() => {
		update(isDark ? APP_DARK : APP_LIGHT);
	}, [isDark, update]);
	return null;
}

/** Lifts the clicked element's id up to ExplorerPage to drive the Inspector. */
function InspectorSelectionBridge({
	onViewTargetChange,
}: {
	onViewTargetChange: (id: string | null) => void;
}) {
	const ctx = useViewContext();
	useEffect(() => {
		onViewTargetChange(ctx?.id ?? null);
	}, [ctx?.id, onViewTargetChange]);
	return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas
// ─────────────────────────────────────────────────────────────────────────────

interface ExplorerCanvasProps {
	data: GraphData;
	/** Receives the live engine once every layer/behaviour has registered. */
	onReady: (canvas: GraphCanvasEngine | null) => void;
	/** Receives the clicked node/edge id (or null) for the Inspector. */
	onViewTargetChange: (id: string | null) => void;
	/** On → hover lights up the node's 1st-degree neighbours; off → node only. */
	magnet: boolean;
	/** Telemetry root for the in-flight query run (RFC-025); layout/render spans
	 *  attach here, and the run's root span closes after the first painted frame. */
	interactionRef?: InteractionRef;
	/** PixiJS render backend. Switching it remounts the canvas (see `key` below),
	 *  since the renderer is chosen once at `Application.init`. */
	backend: CanvasBackend;
}

export function ExplorerCanvas({
	data,
	onReady,
	onViewTargetChange,
	magnet,
	interactionRef,
	backend,
}: ExplorerCanvasProps) {
	return (
		// `key={backend}`: the renderer backend is fixed at `Application.init`, so
		// flipping `preference` only takes effect on a fresh mount — keying on it
		// tears down and rebuilds the canvas (re-feeding `data` → re-layout). The
		// default is WebGL because WebGPU intermittently crashes in PixiJS 8's
		// `BindGroupSystem._createBindGroup` (null `gpuProgram.layout`).
		<CanvasRoot
			key={backend}
			autoResize
			preference={backend}
			config={APP_OPTIONS}
			className="w-full h-full"
		>
			<BackgroundLayer id="background" />
			<GraphLayer
				id="graph"
				data={data}
				node={{ style: { labelText: nodeLabelText } }}
			/>

			{/* Colour nodes by label (default `nodeLabel = node.type`). Edges keep
			    their theme stroke colour. */}
			<ColorByLabelBehaviour
				targetLayerId="graph"
				palette={PALETTE}
				colorEdges={false}
			/>

			{/* Registers the active layout under ACTIVE_LAYOUT_ID (config-first:
			    no auto-apply) and wires `end → fitContent`. <AutoLayoutBridge>
			    below runs it whenever new query results land. */}
			<D3ForceLayout
				id={ACTIVE_LAYOUT_ID}
				targetLayerId="graph"
				options={FORCE_OPTS}
			/>
			<AutoLayoutBridge data={data} interactionRef={interactionRef} />

			<ThemeBridge />

			{/* Camera + interaction. Enabled state comes from APP_OPTIONS; pan +
			    node-drag are what the view section's lock disables. */}
			<DragPanBehaviour id="pan" />
			<DragNodeBehaviour id="drag-node" targetLayerId="graph" />
			<WheelZoomBehaviour id="wheel" />
			<PinchZoomBehaviour id="pinch" />
			<HoverActivateBehaviour
				id="hover"
				targetLayerId="graph"
				degree={magnet ? 1 : 0}
				state="highlighted"
			/>

			{/* Selection — Shift+click selects; the canvas menu's "Select mode"
			    submenu arms exactly one of brush / lasso (both Shift+drag). */}
			<ClickSelectBehaviour id="click-select" targetLayerId="graph" multiple />
			<BrushSelectBehaviour id="brush-select" targetLayerId="graph" />
			<LassoSelectBehaviour id="lasso-select" targetLayerId="graph" />

			{/* Click-to-view — no `panel`; the bridge feeds the right-side
			    InspectorPanel instead of a floating viewer. */}
			<ClickViewBehaviour id="click-view" targetLayerId="graph" />

			<LabelResolutionLODBehaviour id="label-lod" targetLayerId="graph" />
			<MiniMapLayer id="minimap" graphLayerId="graph" />

			{/* Right-click menus — wrapped in the clipboard provider so their
			    Cut / Copy / Paste / Delete items resolve `useClipboard`. */}
			<GraphClipboardProvider layerId="graph">
				<CanvasContextMenus />
			</GraphClipboardProvider>

			<InspectorSelectionBridge onViewTargetChange={onViewTargetChange} />
			{/* Last child: publishes the engine only after everything registered. */}
			<CanvasBridge onReady={onReady} />
		</CanvasRoot>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Header toolbar
// ─────────────────────────────────────────────────────────────────────────────

interface ExplorerHeaderToolbarProps {
	magnet?: boolean;
	onToggleMagnet?: () => void;
	/** Show the magnet (hover-highlight-neighbours) toggle. Default true. The
	 *  read-only Modeller reuses this toolbar without it. */
	showMagnet?: boolean;
	/** Show the undo/redo history controls. Default true. Read-only viewers (the
	 *  Modeller's global/published models) have nothing to undo, so they hide it. */
	showHistory?: boolean;
	/** Show the click/brush/lasso select-mode picker. Default true. Read-only
	 *  viewers (the Modeller's static canvas) don't register the drag-select
	 *  behaviours, so they hide it. */
	showSelectMode?: boolean;
	/** Active render backend; the switcher select reflects + sets it. */
	backend: CanvasBackend;
	onBackendChange: (backend: CanvasBackend) => void;
}

/**
 * Canvas toolbar for the app header. The history section reads the history
 * provider, so item assembly lives in a child mounted *inside* it. ExplorerPage
 * only renders this once the engine (and thus the `'graph'` layer) is live, so
 * the provider + hooks resolve immediately. Clipboard ops (cut/copy/paste) live
 * in the canvas context menus, not here — so no clipboard provider is needed.
 *
 * Reused by the Modeller's read-only canvas via `showMagnet={false}` +
 * `showHistory={false}` (no neighbour-hover, nothing to undo on a static view).
 */
export function ExplorerHeaderToolbar({
	magnet,
	onToggleMagnet,
	showMagnet = true,
	showHistory = true,
	showSelectMode = true,
	backend,
	onBackendChange,
}: ExplorerHeaderToolbarProps) {
	return (
		// The provider is always mounted (so `useHistorySection` resolves) even when
		// the history items are hidden — keeping the hook call unconditional.
		<GraphHistoryProvider layerId="graph">
			<HeaderToolbarItems
				magnet={magnet}
				onToggleMagnet={onToggleMagnet}
				showMagnet={showMagnet}
				showHistory={showHistory}
				showSelectMode={showSelectMode}
				backend={backend}
				onBackendChange={onBackendChange}
			/>
		</GraphHistoryProvider>
	);
}

function HeaderToolbarItems({
	magnet,
	onToggleMagnet,
	showMagnet = true,
	showHistory = true,
	showSelectMode = true,
	backend,
	onBackendChange,
}: ExplorerHeaderToolbarProps) {
	// Live engine — the toolbar only renders once it's live, so this is non-null.
	const canvas = useCanvas();

	// Selection mode (click / brush / lasso). Single source of truth for the
	// canvas: picking one arms its drag-select behaviour and disables the others.
	// The hook arms `click` on mount.
	const selectMode = useSelectMode(SELECT_MODE_IDS, {
		labels: SELECT_LABEL,
		initial: "click",
	});

	const history = useHistorySection({ icons: { undo: Undo2, redo: Redo2 } });
	const { layout, layoutOptions, applyLayout, isRunning } = useLayout(LAYOUTS, {
		labels: LAYOUT_LABEL,
		initial: "d3-force",
		// The registered active layout already positions new data; let the user's
		// picker apply on demand instead of double-running on mount.
		applyInitial: false,
	});

	// Announce a header-picker layout run on the shared message channel: a sticky
	// "Running…" while it runs, then a "ready" that auto-clears after 3s. (Query
	// auto-layouts are announced separately by <AutoLayoutBridge>.)
	const wasRunning = useRef(false);
	useEffect(() => {
		const label = LAYOUT_LABEL[layout] ?? layout;
		if (isRunning && !wasRunning.current)
			canvas.showMessage(`Running ${label} layout…`);
		else if (!isRunning && wasRunning.current)
			canvas.showMessage(`${label} layout ready`, 3000);
		wasRunning.current = isRunning;
	}, [isRunning, layout, canvas]);

	// Announce the magnet toggle on the message channel (skip the initial mount).
	const firstMagnet = useRef(true);
	useEffect(() => {
		if (!showMagnet) return;
		if (firstMagnet.current) {
			firstMagnet.current = false;
			return;
		}
		canvas.showMessage(
			magnet ? "Hover highlights neighbours" : "Hover highlights the node only",
			2500,
		);
	}, [magnet, canvas, showMagnet]);
	const view = useViewSection({
		icons: {
			zoomIn: ZoomIn,
			zoomOut: ZoomOut,
			fit: Maximize,
			locked: Lock,
			unlocked: LockOpen,
		},
	});
	const style = useStyleEditorSection({
		layerId: "graph",
		icons: EDGE_TYPE_ICONS,
	});
	const { showGrid, toggleGrid } = useGrid();

	const div = (key: string): ToolbarItem => ({ type: "divider", key });
	const items: ToolbarItem[] = [
		...(showHistory ? [...history, div("d1")] : []),
		...(showSelectMode
			? [
					{
						// Select-mode picker: a `RichSelect` (icon + label + hint per row)
						// whose trigger shows the active mode's icon. Mirrors the header's
						// other pickers; the single `useSelectMode` instance keeps the
						// canvas's drag-select behaviours in sync.
						type: "custom" as const,
						key: "select-mode",
						render: () => (
							<RichSelect
								options={SELECT_MODE_OPTIONS}
								value={selectMode.mode}
								onChange={(v) => selectMode.setMode(v as string)}
								tooltip="Selection mode"
								renderValue={(selected) => {
									const Icon =
										SELECT_ICONS[selectMode.mode as keyof typeof SELECT_ICONS];
									return (
										<span className="flex items-center gap-2">
											<Icon className="size-4" />
											{selected[0]?.label ?? "Select"}
										</span>
									);
								}}
							/>
						),
					},
					div("dsel"),
				]
			: []),
		{
			// Layout switcher as an inline icon toggle group: every layout is
			// visible in the header, the active one stays highlighted, and each
			// reads its name from a hover tooltip. Default (not `outline`) variant
			// so the items have no borders — only the active one tints its
			// background.
			type: "custom",
			key: "layout",
			render: () => (
				<TooltipProvider delayDuration={300}>
					<ToggleGroup
						type="single"
						size="sm"
						value={layout}
						// Radix fires `""` when the active item is re-clicked; ignore that
						// so a layout is always selected.
						onValueChange={(v) => v && applyLayout(v)}
					>
						{Object.entries(layoutOptions).map(([value, label]) => {
							const Icon = LAYOUT_ICON[value] ?? Share2;
							// Keep the item itself the (clean) ToggleGroup child so it
							// keeps its `data-state="on"` highlight — wrapping it in
							// `TooltipTrigger asChild` would clobber that with the
							// tooltip's own `data-state`. The trigger lives on an inner
							// span instead.
							return (
								<ToggleGroupItem key={value} value={value} aria-label={label}>
									<Tooltip>
										<TooltipTrigger asChild>
											<span className="flex size-full items-center justify-center">
												<Icon className="size-4" />
											</span>
										</TooltipTrigger>
										<TooltipContent>{label}</TooltipContent>
									</Tooltip>
								</ToggleGroupItem>
							);
						})}
					</ToggleGroup>
				</TooltipProvider>
			),
		},
		div("d2"),
		{
			type: "button",
			key: "run-layout",
			icon: Play,
			label: "Run layout",
			onClick: () => applyLayout(layout),
			disabled: isRunning,
		},
		{
			type: "button",
			key: "refresh",
			icon: RefreshCw,
			label: "Re-render (re-run layout + repaint)",
			onClick: () => void canvas.refresh(),
		},
		div("d3"),
		...style,
		div("d4"),
		...view,
		div("d5"),
		{
			type: "toggle",
			key: "grid",
			icon: Grid3x3,
			label: "Toggle grid",
			active: showGrid,
			onToggle: toggleGrid,
		},
		div("d7"),
		{
			// Render backend switcher. Flipping it remounts the canvas (ExplorerCanvas
			// keys on `backend`) so PixiJS re-inits with the chosen renderer. WebGL is
			// the safe default; WebGPU is offered for users whose drivers handle it.
			type: "custom",
			key: "renderer",
			render: () => (
				<ToggleGroup
					type="single"
					size="sm"
					variant="outline"
					value={backend}
					// Radix fires `""` when the active item is re-clicked; ignore that so
					// a backend is always selected.
					onValueChange={(v) => v && onBackendChange(v as CanvasBackend)}
				>
					{(Object.keys(BACKEND_LABEL) as CanvasBackend[]).map((b) => (
						<ToggleGroupItem key={b} value={b} aria-label={BACKEND_LABEL[b]}>
							{BACKEND_LABEL[b]}
						</ToggleGroupItem>
					))}
				</ToggleGroup>
			),
		},
		...(showMagnet
			? [
					div("d8"),
					{
						type: "toggle" as const,
						key: "magnet",
						icon: Magnet,
						label: "Highlight neighbours: off",
						activeLabel: "Highlight neighbours: on",
						active: !!magnet,
						onToggle: onToggleMagnet ?? (() => {}),
					},
				]
			: []),
	];

	return <ToolbarItems items={items} orientation="horizontal" />;
}
