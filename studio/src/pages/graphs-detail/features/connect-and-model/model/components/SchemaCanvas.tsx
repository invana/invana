import type { SelectedItem } from "@/pages/graphs-detail/features/connect-and-model/model/types";
import type { ModelEditCtx } from "@/pages/graphs-detail/features/connect-and-model/model/types";
import type { CanvasBackend } from "@/pages/graphs-detail/features/explorer";
import { readCanvasThemeConfig } from "@/pages/graphs-detail/features/explorer";
import type { EdgeTypeResponse, NodeTypeResponse } from "@/types/schemas";
// The root is `<GraphCanvas>`, not `<Board>`: only it provides
// `GraphCanvasContext`, which every `useGraphCanvas()` below depends on. Up to
// canvas 0.0.11 `<Board>` provided it too, so this reads like a free swap —
// it is not. Under a plain `<Board>` those hooks throw at render, and nothing
// at the type level says so.
import {
	BackgroundLayer,
	BrushSelectBehaviour,
	type CanvasProps,
	ClickInspectBehaviour,
	ClickSelectBehaviour,
	ColorByBehaviour,
	CreateNodeBehaviour,
	D3ForceLayout,
	DragNodeBehaviour,
	DragPanBehaviour,
	DrawEdgeBehaviour,
	EraseBehaviour,
	GraphCanvas,
	GraphLayer,
	type GraphTool,
	LassoSelectBehaviour,
	MiniMapLayer,
	ParallelEdgeBehaviour,
	PinchZoomBehaviour,
	TextResolutionLODBehaviour,
	WheelZoomBehaviour,
	useCanvasEvent,
	useFitContent,
	useGraphCanvas,
	useGraphCanvasUpdate,
	useGrid,
	useInspectTarget,
	useSelectMode,
	useTool,
	useViewSection,
} from "@invana/canvas-react";
import {
	GraphBackgroundContextMenu,
	type GraphBackgroundMenuContext,
	GraphEdgeContextMenu,
	type GraphEdgeMenuContext,
	GraphNodeContextMenu,
	type GraphNodeMenuContext,
	type ToolbarItem,
	ToolbarItems,
	applyIconOverrides,
} from "@invana/canvas-ui";
import type {
	ErasedElement,
	GraphCanvas as GraphCanvasEngine,
	GraphData,
	GraphEdge,
	GraphNode,
	InspectTarget,
	ResolvableEdgeStyle,
	ResolvableNodeStyle,
} from "@invana/graph";
import type * as graph from "@invana/graph";
import { useTheme } from "@invana/themes";
import { Button, type MenuItem } from "@invana/ui";
import {
	Eraser,
	Grid3x3,
	Lasso,
	Lock,
	LockOpen,
	type LucideIcon,
	Maximize,
	MousePointer2,
	Plus,
	Spline,
	SquareDashedMousePointer,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

// Modeller canvas → backend wiring lives in ModellerPage; the canvas only
// *requests* edits through these callbacks. The gesture-driven create flows open
// the existing form dialogs (decision #1); inline rename + reverse + delete go
// straight to the existing draft-only mutations.
export interface SchemaCanvasProps {
	nodeTypes: NodeTypeResponse[];
	edgeTypes: EdgeTypeResponse[];
	selected: SelectedItem;
	onSelect: (item: SelectedItem) => void;
	/** Present ⇒ editable draft (tool-driven authoring); absent ⇒ read-only, which
	 *  renders the Explorer-grade exploration canvas (select modes, minimap, nav
	 *  context menus — no editing). */
	ctx?: ModelEditCtx;
	/** PixiJS render backend for the read-only explore canvas. Flipping it remounts
	 *  the canvas (keyed below). Ignored by the authoring canvas. */
	backend?: CanvasBackend;
	/** Receives the live engine once every layer/behaviour has registered — lifts
	 *  it to ModellerPage so the header toolbar + footer status bar resolve it. */
	onReady?: (canvas: GraphCanvasEngine | null) => void;
	/** Add-tool gesture on empty canvas → open the new-node-type dialog. */
	onRequestAddNode?: () => void;
	/** Connect-tool gesture between two nodes → open the new-edge-type dialog. */
	onRequestAddEdge?: (endpoints: { source: string; target: string }) => void;
	/** Context-menu delete → existing confirm dialog. */
	onRequestDelete?: (d: {
		kind: "node" | "edge";
		id: string;
		name: string;
	}) => void;
	/** Erase-tool delete → direct mutation (no confirm; refetch is authoritative). */
	onEraseType?: (d: { kind: "node" | "edge"; id: string }) => void;
	/** Context-menu reverse → swap an edge type's source/target. */
	onReverseEdge?: (edgeTypeId: string) => void;
}

type CanvasConfig = NonNullable<CanvasProps["config"]>;

const LAYER_ID = "graph";

// Per-tool footer hints, pushed to the canvas message channel on a tool switch
// and shown (sticky) in the footer's <CanvasMessageBar>. App-owned copy — the
// channel just displays it.
const HINTS: Record<string, string> = {
	select:
		"Drag a node to reposition · click a node or edge to open it in Details · click empty canvas to clear",
	add: "Click empty canvas to add a node type · Esc to exit",
	connect: "Drag node→node to connect them with an edge type · Esc to exit",
	delete:
		"Click a node type (removes its edges) or an edge to delete it · Esc to exit",
};

// Full node/edge style, applied via the <GraphLayer node|edge> props (NOT config).
// The base `Board.update(config)` only styles a layer that already exists
// (`this.layers.get(id)?.setOptions(...)`), so config-based styling silently drops
// when the layer isn't registered at config-apply time. Passing the style as the
// layer's creation options avoids that race — the template carries the circle
// shape from the moment the layer mounts. Theme-varying colours (label on the
// background; edge stroke) are patched on top by <ThemeBridge>, which merges (so
// the shape survives) and runs after the layer exists.
const NODE_STYLE: ResolvableNodeStyle<GraphNode> = {
	shape: { kind: "circle", radius: 14 },
	// Brand green (--primary 142 70%) instead of the stock indigo, so the schema
	// nodes sit on-palette with studio's grey/green theme.
	bgFill: 0x2bab5a,
	bgStrokeWidth: 2,
	bgStrokeColor: 0x181a1b,
	// The type name is the node id. Resolved at the template level so per-node
	// data carries no `style` (which would replace the template — losing the shape).
	labelText: (n: GraphNode) => String(n.id),
	// Neutral grey (--muted-foreground) reads on both themes; <ThemeBridge> refines.
	labelColor: 0x9199a1,
	labelFontSize: 13,
	// Word-length type names overflow a centred label; place it below the circle.
	labelPlacement: "bottom",
	labelOffsetY: 4,
};
const EDGE_STYLE: ResolvableEdgeStyle<GraphEdge> = {
	strokeColor: 0x646b73,
	strokeWidth: 1.5,
	labelText: (e: GraphEdge) => (e.type ? String(e.type) : ""),
	labelColor: 0x9199a1,
	// Smaller than the type name it sits between: an edge type is read *after*
	// the two types it joins, and `EMPLOYED_BY` at the node's size is the widest
	// thing on the canvas.
	labelFontSize: 10,
};

// Board colours track studio's *active* theme, read live from the CSS tokens
// by <ThemeBridge> (see `readCanvasThemeConfig`) so switching theme/mode retints
// the canvas — the authoring canvas has no minimap layer, so `update()` no-ops
// on that key. The `background`/edge patch merges onto NODE_STYLE (which carries
// the shape).

// The force config both canvases lay out with. `animate: false` is the part
// that matters (ME12): an animated sim keeps moving for ten seconds or more
// after the types appear, and a drawing that drifts into place reads as a canvas
// that is still loading. Run it to completion, fit once, then hold still.
const FORCE_OPTS = {
	animate: false,
	// Room, not proximity. A type carries its name *under* the circle and an edge
	// carries its own between two of them, so the thing being laid out is much
	// wider than the 14px node the sim sees: at the old 90px link distance every
	// label landed on its neighbour. The distance is what separates two joined
	// types, the charge is what pushes apart two that are not, and the collide
	// radius is the label's footprint rather than the circle's.
	charge: { strength: -1500 },
	link: { distance: 260 },
	center: { x: 0, y: 0 },
	collide: { radius: 80 },
};

/**
 * The camera never zooms past 1:1 to frame a model. A four-type model is ~600px
 * of drawing in a 1000px viewport, and a plain fit answers that by zooming to
 * 3× — circles the size of a fist, labels that collide, and half the model off
 * the edge. Fitting *out* is always right; fitting *in* is not.
 */
const MAX_FIT_ZOOM = 1;
/** Screen-px margin for that fit. */
const FIT_PADDING = 80;

/**
 * Both canvases register their sim by id and run it through
 * {@link SchemaAutoLayout}, whose promise is the one place either camera moves —
 * `<D3ForceLayout fitPadding={null}>` everywhere, because the wrapper's own
 * end-fit has no ceiling and runs on every solve.
 */
const AUTHOR_LAYOUT_ID = "d3-force-authoring";
const AUTHOR_OPTIONS: CanvasConfig = { activeLayout: AUTHOR_LAYOUT_ID };

// ── Read-only explore mode constants ────────────────────────────────────────
// The global (introspected) + published models render a rich, Explorer-grade
// read-only canvas: select modes, minimap, colour-by-type, label LOD, and the
// nav context menus — minus the magnet (hover-highlight) and any mutation. The
// header toolbar is the Explorer's (reused with magnet + history hidden).

// "Focus on node" zooms in to at least this scale.
const FOCUS_ZOOM = 2;

// Distinct colour per node-type (ColorByBehaviour keys on `node.type`, which
// the adapter stamps with the type name).
const EXPLORE_PALETTE = [
	0x9ca3af, 0xef4444, 0xf59e0b, 0xeab308, 0x10b981, 0x06b6d4, 0x3b82f6,
	0x8b5cf6, 0xec4899, 0x14b8a6, 0xa3e635,
] as const;

// Active layout registered on the explore canvas so the toolbar's Re-render
// (`canvas.refresh()`) re-runs it; <ExploreAutoLayout> runs it on data change.
const EXPLORE_LAYOUT_ID = "d3-force-active";

// Select-mode key → registered behaviour id (empty ⇒ plain click, no drag-select).
// Mirrors the Explorer; surfaced as a submenu of the background context menu.
const SELECT_MODE_IDS: Record<string, string> = {
	click: "",
	brush: "brush-select",
	lasso: "lasso-select",
};
const SELECT_LABEL: Record<string, string> = {
	click: "Click select",
	brush: "Brush select",
	lasso: "Lasso select",
};
const SELECT_ICONS: Record<string, LucideIcon> = {
	click: MousePointer2,
	brush: SquareDashedMousePointer,
	lasso: Lasso,
};

// Config-first options for the explore canvas: enabled behaviours (NO hover —
// the magnet is intentionally absent), the registered active layout, the grid
// background, and the minimap. Drag-select behaviours start disabled (click mode).
const EXPLORE_OPTIONS: CanvasConfig = {
	activeLayout: EXPLORE_LAYOUT_ID,
	layers: {
		background: { type: "pattern", patternType: "dots", alpha: 0.5 },
		minimap: { position: "bottom-left", margin: { x: 20 } },
	},
	behaviours: {
		pan: { enabled: true },
		"drag-node": { enabled: true },
		wheel: { enabled: true },
		pinch: { enabled: true },
		"click-select": { enabled: true },
		"brush-select": { enabled: false },
		"lasso-select": { enabled: false },
		"click-inspect": { enabled: true },
		"label-lod": { enabled: true },
	},
};

// The edge-type id is the prefix of every canvas edge id it fans out to
// (`${edgeType.id}:${src}->${tgt}`), so we recover it by splitting on the first
// colon — node/edge ids never contain one on the modeller side.
const edgeTypeIdOf = (canvasEdgeId: string): string =>
	canvasEdgeId.slice(0, canvasEdgeId.indexOf(":"));

const HEADER_TOOLS: { key: GraphTool; icon: LucideIcon; label: string }[] = [
	{ key: "select", icon: MousePointer2, label: "Select / move" },
	{ key: "add", icon: Plus, label: "Add node type" },
	{ key: "connect", icon: Spline, label: "Connect (edge type)" },
	{ key: "delete", icon: Eraser, label: "Delete" },
];

// Drawing-tool switcher for the shell header. Depends ONLY on the lifted
// `GraphToolProvider` (via `useTool`) — NOT on the canvas engine — so it renders
// the instant a model is open, independent of when `<Board>` publishes its
// engine. The in-canvas behaviours read the same tool state. On a read-only
// version the authoring tools are disabled (a draft is required to edit).
export function ModellerHeaderToolbar({ editable }: { editable: boolean }) {
	const { tool, setTool } = useTool();
	return (
		<div className="flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5 shadow-sm">
			{HEADER_TOOLS.map((t) => {
				const disabled = !editable && t.key !== "select";
				return (
					<Button
						key={t.key}
						type="button"
						variant={tool === t.key ? "secondary" : "ghost"}
						size="icon"
						className="h-7 w-7"
						disabled={disabled}
						title={disabled ? "Create a draft to edit this model" : t.label}
						aria-label={t.label}
						onClick={() => setTool(t.key)}
					>
						<t.icon className="h-4 w-4" />
					</Button>
				);
			})}
		</div>
	);
}

// View controls (zoom / fit / lock + grid) for the header, shown alongside the
// drawing switcher on an editable draft so authoring never loses navigation. The
// read-only model gets the same controls (and more) via the reused
// `ExplorerHeaderToolbar`; this is the trimmed set that applies to the authoring
// canvas (no layout switcher / re-render / render-backend — those don't map onto
// it). Resolves the live engine off the lifted CanvasContext, like the Explorer
// toolbar, so it's only mounted once the canvas is initialised.
export function ModellerViewToolbar() {
	const view = applyIconOverrides(useViewSection(), {
		zoomIn: ZoomIn,
		zoomOut: ZoomOut,
		fit: Maximize,
		locked: Lock,
		unlocked: LockOpen,
	});
	const { showGrid, toggleGrid } = useGrid();
	const items: ToolbarItem[] = [
		...view,
		{ type: "divider", key: "vd" },
		{
			type: "toggle",
			key: "grid",
			icon: Grid3x3,
			label: "Toggle grid",
			active: showGrid,
			onToggle: toggleGrid,
		},
	];
	return (
		<div className="rounded-md border border-border bg-background p-0.5 shadow-sm">
			<ToolbarItems items={items} orientation="horizontal" />
		</div>
	);
}

/** Follows studio's theme: pushes the matching colour patch via `update()`. */
function ThemeBridge() {
	const { variantId, isDark } = useTheme();
	const update = useGraphCanvasUpdate();
	// Deferred one frame so the ThemeProvider's class is applied before we read
	// tokens — see the ExplorerCanvas ThemeBridge for the ordering note.
	// biome-ignore lint/correctness/useExhaustiveDependencies: variantId/isDark are trigger-only — the effect re-reads the live DOM tokens on any theme/mode change
	useEffect(() => {
		const id = requestAnimationFrame(() => update(readCanvasThemeConfig()));
		return () => cancelAnimationFrame(id);
	}, [variantId, isDark, update]);
	return null;
}

// Surfaces the live engine from inside <Board> (where useGraphCanvas is
// guaranteed non-null) up to ModellerPage, so the lifted CanvasContext can feed
// the header toolbar + footer status bar. Rendered as the LAST <Board> child so
// it publishes only after every layer / behaviour above it has registered.
function CanvasBridge({
	onReady,
}: {
	onReady?: (canvas: GraphCanvasEngine | null) => void;
}) {
	const canvas = useGraphCanvas();
	useEffect(() => {
		onReady?.(canvas);
		return () => onReady?.(null);
	}, [canvas, onReady]);
	return null;
}

// Reflects the externally-driven `selected` (a click in the left SchemaNav list,
// the post-draft reselect, …) back onto the canvas, so the matching node/edge
// type paints with the `selected` visual state. The canvas→panel direction is
// already handled by the inspect bridges; this is the panel/list→canvas one.
// Mounted in both the authoring and explore canvases — they share the
// `click-select` behaviour id.
function SelectionBridge({
	selected,
	nodeTypes,
	edges,
}: {
	selected: SelectedItem;
	nodeTypes: NodeTypeResponse[];
	edges: GraphEdge[];
}) {
	const canvas = useGraphCanvas();
	useEffect(() => {
		const select =
			canvas.behaviours.get<graph.ClickSelectBehaviour>("click-select");
		if (!select) return;
		if (selected?.kind === "node-type") {
			// Board node ids ARE the type names; map the selected type id → name.
			const name = nodeTypes.find((n) => n.id === selected.id)?.name;
			if (name) select.select(name, "shape");
			else select.clearSelection();
		} else if (selected?.kind === "edge-type") {
			// An edge type fans out to one canvas edge per (source, target) pair —
			// select them all so every strand of the type highlights.
			const ids = edges
				.filter((e) => edgeTypeIdOf(e.id) === selected.id)
				.map((e) => ({ id: e.id, type: "connector" as const }));
			if (ids.length) select.selectMultiple(ids);
			else select.clearSelection();
		} else {
			// property-keys / constraints / indexes / nothing — no canvas element.
			select.clearSelection();
		}
	}, [selected, nodeTypes, edges, canvas]);
	return null;
}

interface SchemaData {
	data: GraphData;
	nameToNodeId: Map<string, string>;
	edgeTypeName: Map<string, string>;
}

// Adapt schema types into canvas data. Node-type *names* are the canonical ids on
// the modeller side (edge endpoints reference names), so we key canvas nodes by
// name; `type` is also the name so the explore canvas's ColorByBehaviour
// gives each type a distinct colour. Edge types fan out to one canvas edge per
// (source, target) pair. Shared by both the authoring and explore canvases.
function buildSchemaData(
	nodeTypes: NodeTypeResponse[],
	edgeTypes: EdgeTypeResponse[],
): SchemaData {
	const nodeNames = new Set(nodeTypes.map((n) => n.name));
	const nameToId = new Map<string, string>();
	// No per-instance `style` — a per-node style object REPLACES the layer's node
	// template (losing the circle shape/fill), leaving only a floating label. The
	// label is resolved at the layer level instead (GraphLayer `node`/`edge` props).
	const nodes: GraphNode[] = nodeTypes.map((n) => {
		nameToId.set(n.name, n.id);
		return { id: n.name, type: n.name };
	});
	const edges: GraphEdge[] = [];
	const etName = new Map<string, string>();
	for (const e of edgeTypes) {
		etName.set(e.id, e.name);
		for (const src of e.source_node_types) {
			for (const tgt of e.target_node_types) {
				if (!nodeNames.has(src) || !nodeNames.has(tgt)) continue;
				edges.push({
					id: `${e.id}:${src}->${tgt}`,
					source: src,
					target: tgt,
					type: e.name,
				});
			}
		}
	}
	return {
		data: { nodes, edges } as GraphData,
		nameToNodeId: nameToId,
		edgeTypeName: etName,
	};
}

const NO_NODE_TYPES: NodeTypeResponse[] = [];
const NO_EDGE_TYPES: EdgeTypeResponse[] = [];

// Selector: an editable draft (`ctx`) gets the tool-driven authoring canvas; a
// read-only model (global/introspected + published) gets the Explorer-grade
// exploration canvas. Both share the data adapter; the empty read-only case shows
// the introspect hint (no draft to draw on).
export function SchemaCanvas(props: SchemaCanvasProps) {
	const { ctx } = props;
	// Callers reach for `?? []` while their version query is in flight, which
	// hands us a *new* empty array on every render. The data build is keyed on
	// these references and `<GraphLayer data>` replaces the drawing when its
	// reference flips, so an unstable empty would rebuild the canvas every
	// render. Collapse empties onto one frozen reference; a loaded list already
	// comes back stable from the query cache.
	const nodeTypes = props.nodeTypes.length ? props.nodeTypes : NO_NODE_TYPES;
	const edgeTypes = props.edgeTypes.length ? props.edgeTypes : NO_EDGE_TYPES;
	const schema = useMemo(
		() => buildSchemaData(nodeTypes, edgeTypes),
		[nodeTypes, edgeTypes],
	);

	if (schema.data.nodes.length === 0 && !ctx) {
		return (
			<div className="w-full h-full relative bg-background flex items-center justify-center text-muted-foreground">
				<span>
					No schema loaded — run Introspect to discover your database schema.
				</span>
			</div>
		);
	}

	return ctx ? (
		<AuthoringSchemaCanvas {...props} schema={schema} />
	) : (
		<ExploreSchemaCanvas {...props} schema={schema} />
	);
}

// ── Authoring canvas (editable draft) ───────────────────────────────────────
function AuthoringSchemaCanvas(
	props: SchemaCanvasProps & { schema: SchemaData },
) {
	const { onReady, schema } = props;
	const { data, nameToNodeId, edgeTypeName } = schema;

	// The sim is registered by id and run by <SchemaAutoLayout> on every data
	// change — the same config-first shape the explore canvas uses, so both
	// canvases frame themselves through one piece of code rather than one of them
	// remounting the layout to re-seed it.
	const empty = data.nodes.length === 0;

	return (
		<div className="relative w-full h-full bg-background">
			<GraphCanvas autoResize config={AUTHOR_OPTIONS} className="w-full h-full">
				{/* Style lives on the layer props (creation options), NOT canvas
				    `config` — see NODE_STYLE for why. */}
				<BackgroundLayer
					id="background"
					type="pattern"
					patternType="dots"
					alpha={0.5}
					backgroundColor="#181a1b"
					color="#2b2e31"
				/>
				<GraphLayer
					id={LAYER_ID}
					data={data}
					node={{ style: NODE_STYLE }}
					edge={{ style: EDGE_STYLE }}
				/>
				<ThemeBridge />

				<DragPanBehaviour id="pan" enabled />
				<WheelZoomBehaviour id="wheel" enabled />
				<SchemaAutoLayout data={data} layoutId={AUTHOR_LAYOUT_ID} />
				{!empty && (
					<D3ForceLayout
						id={AUTHOR_LAYOUT_ID}
						targetLayerId={LAYER_ID}
						fitPadding={null}
						options={FORCE_OPTS}
					/>
				)}

				<ModellerTools
					{...props}
					nameToNodeId={nameToNodeId}
					edgeTypeName={edgeTypeName}
				/>

				{/* Mirror the panel/list selection onto the canvas (mounted after
				    ModellerTools so its `click-select` behaviour is registered). */}
				<SelectionBridge
					selected={props.selected}
					nodeTypes={props.nodeTypes}
					edges={data.edges}
				/>

				{/* Last child: publishes the live engine to the lifted CanvasContext
				    only after everything above has registered. */}
				<CanvasBridge onReady={onReady} />
			</GraphCanvas>
		</div>
	);
}

// ── Explore canvas (read-only: global/introspected + published) ─────────────
// Mirrors the Explorer's read-capable canvas — minus the magnet (hover-highlight)
// and any mutation. Clicking a type still drives the right-side DetailPanel.
function ExploreSchemaCanvas(
	props: SchemaCanvasProps & { schema: SchemaData },
) {
	const { onSelect, onReady, backend, schema, selected, nodeTypes } = props;
	const { data, nameToNodeId } = schema;

	return (
		<div className="relative w-full h-full bg-background">
			{/* `key={backend}`: the renderer backend is fixed at `Application.init`,
			    so flipping it only takes effect on a fresh mount. */}
			<GraphCanvas
				key={backend}
				autoResize
				preference={backend}
				config={EXPLORE_OPTIONS}
				className="w-full h-full"
			>
				<BackgroundLayer id="background" />
				<GraphLayer
					id={LAYER_ID}
					data={data}
					node={{ style: NODE_STYLE }}
					edge={{ style: EDGE_STYLE }}
				/>

				{/* Distinct colour per node-type (keys on `node.type` = the type name).
				    Edges keep their theme stroke. */}
				<ColorByBehaviour
					targetLayerId={LAYER_ID}
					palette={EXPLORE_PALETTE}
					colorEdges={false}
				/>

				{/* Registers the active layout (config-first: no auto-apply);
				    <SchemaAutoLayout> runs it on data change and frames it. */}
				<SchemaAutoLayout
					data={data}
					layoutId={EXPLORE_LAYOUT_ID}
					message="Read-only model — drag, zoom, and right-click to explore"
				/>
				<D3ForceLayout
					id={EXPLORE_LAYOUT_ID}
					targetLayerId={LAYER_ID}
					fitPadding={null}
					options={FORCE_OPTS}
				/>
				<ThemeBridge />

				{/* Camera + interaction (NO hover/magnet). Ids match what the reused
				    Explorer toolbar's view-section lock + select-mode submenu target. */}
				<DragPanBehaviour id="pan" />
				<DragNodeBehaviour id="drag-node" targetLayerId={LAYER_ID} />
				<WheelZoomBehaviour id="wheel" />
				<PinchZoomBehaviour id="pinch" />

				{/* Selection. `click-select` is registered but **not gesture-enabled**:
				    it and `click-inspect` both claim `pointer+click`, and the canvas
				    refuses the second claimant — so enabling both left `click-inspect`
				    unarmed and a click on a type selected nothing at all.

				    Inspect wins the gesture because it is what carries canvas → panel,
				    and the panel is where a type is read and edited. `click-select`
				    keeps its imperative `select()` API for the panel → canvas
				    direction, which {@link SelectionBridge} drives. Multi-select stays
				    available through brush and lasso (both Shift+drag). */}
				<ClickSelectBehaviour
					id="click-select"
					targetLayerId={LAYER_ID}
					enabled={false}
					multiple
				/>
				<BrushSelectBehaviour id="brush-select" targetLayerId={LAYER_ID} />
				<LassoSelectBehaviour id="lasso-select" targetLayerId={LAYER_ID} />

				{/* Click-to-inspect → drives the right-side DetailPanel via onSelect. */}
				<ClickInspectBehaviour id="click-inspect" targetLayerId={LAYER_ID} />
				<ExploreInspectBridge nameToNodeId={nameToNodeId} onSelect={onSelect} />

				<TextResolutionLODBehaviour id="label-lod" targetLayerId={LAYER_ID} />
				<ParallelEdgeBehaviour targetLayerId={LAYER_ID} />
				<MiniMapLayer id="minimap" graphLayerId={LAYER_ID} />

				<ExploreContextMenus nameToNodeId={nameToNodeId} onSelect={onSelect} />

				{/* Mirror the panel/list selection onto the canvas. */}
				<SelectionBridge
					selected={selected}
					nodeTypes={nodeTypes}
					edges={data.edges}
				/>

				{/* Last child: publishes the live engine to the lifted CanvasContext. */}
				<CanvasBridge onReady={onReady} />
			</GraphCanvas>
		</div>
	);
}

/**
 * Runs the registered layout whenever the data reference changes (the
 * config-first `<D3ForceLayout id>` only registers it), then frames the result.
 * Mounted after `<GraphLayer>` so the store already holds the new topology.
 *
 * **The camera follows the settled solve, not the promise.** A run the engine
 * stops — a re-registration, a topology change landing mid-solve — resolves like
 * any other with every node still on the origin, and fitting *that* framed a
 * single point and called it a model. `layout:run:end` says which happened, and
 * it also catches the engine's own `activeLayout` run, so there is one fitter
 * whoever started the solve.
 *
 * The fit is here rather than on the layout wrapper for a second reason: it has
 * a ceiling. `fitContent` alone scales a small model *up* until it fills the
 * viewport, which is how a four-type model was drawn at 3× with its labels on
 * top of each other and `Employee` off the bottom edge.
 */
function SchemaAutoLayout({
	data,
	layoutId,
	message,
}: {
	data: GraphData;
	layoutId: string;
	message?: string;
}) {
	const canvas = useGraphCanvas();
	useEffect(() => {
		if (!canvas || data.nodes.length === 0) return;
		if (message) canvas.showMessage(message);
		void canvas.runLayout(layoutId);
	}, [canvas, data, layoutId, message]);

	// **Mounted before `<D3ForceLayout>`, and this is why.** Registering a layout
	// stops whatever that id was running, and React re-registers it on every
	// remount (StrictMode's second pass, a `key` change) — so the run kicked off
	// beside it dies with every node still on the origin and nothing starts
	// another. Running off the registration itself is the trigger that cannot be
	// missed, and catching it needs this subscription to exist first.
	useCanvasEvent("scene:layout:add", (e) => {
		if (e.id !== layoutId || !canvas) return;
		void canvas.runLayout(layoutId);
	});

	useCanvasEvent("layout:run:end", (e) => {
		if (e.id !== layoutId || e.reason !== "settled" || !canvas) return;
		const layer = canvas.layers.get<graph.GraphLayer>(LAYER_ID);
		const bounds = layer?.getBounds();
		if (!layer || !bounds) return;
		// **Redraw before framing** (ME25). A layer holds every node invisible
		// while a declared `activeLayout` has yet to report a run — otherwise an
		// unplaced node paints at the origin and the whole model piles up there.
		// This sim is `animate: false`, so its solve lands in the same beat as
		// the data it is laying out: the gate lifts against a flush that has
		// already been and gone, and the drawing is never installed. The store
		// has the types, `getBounds()` has the box and the minimap draws them —
		// the viewport alone stays empty. `redraw()` is the engine's own recovery
		// for that desync: a pure render pass over what the store already holds,
		// no data touched.
		layer.redraw();
		canvas.camera.fitContent(bounds, FIT_PADDING);
		if (canvas.camera.scale > MAX_FIT_ZOOM) canvas.camera.setZoom(MAX_FIT_ZOOM);
	});
	return null;
}

// Maps the click-inspect target (canvas node id = type name) back to a
// SelectedItem so the right-side DetailPanel shows the clicked type.
function ExploreInspectBridge({
	nameToNodeId,
	onSelect,
}: {
	nameToNodeId: Map<string, string>;
	onSelect: (item: SelectedItem) => void;
}) {
	// `onSelect` through a ref, out of the deps — same render loop as the
	// authoring bridge above, and the same reason.
	const selectRef = useRef(onSelect);
	selectRef.current = onSelect;
	const target = useInspectTarget();
	useEffect(() => {
		if (!target) return;
		if (target.kind === "node") {
			const id = nameToNodeId.get(target.id);
			if (id) selectRef.current({ kind: "node-type", id });
		} else {
			selectRef.current({ kind: "edge-type", id: edgeTypeIdOf(target.id) });
		}
	}, [target, nameToNodeId]);
	return null;
}

// Read-only right-click menus: navigation + selection + highlight + "Show
// details" (drives the DetailPanel). No clipboard / mutation items — the model
// can't be edited here.
function exploreNodeItems(
	{ id, canvas }: GraphNodeMenuContext,
	nameToNodeId: Map<string, string>,
	onSelect: (item: SelectedItem) => void,
): MenuItem[] {
	const layer = canvas.layers.get<graph.GraphLayer>("graph");
	if (!layer) return [];
	const select =
		canvas.behaviours.get<graph.ClickSelectBehaviour>("click-select");
	const typeId = nameToNodeId.get(id);
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
		...(typeId
			? [
					{
						id: "details",
						label: "Show details",
						onClick: () => onSelect({ kind: "node-type", id: typeId }),
					},
				]
			: []),
	];
}

function exploreEdgeItems(
	{ id, canvas }: GraphEdgeMenuContext,
	onSelect: (item: SelectedItem) => void,
): MenuItem[] {
	const layer = canvas.layers.get<graph.GraphLayer>("graph");
	if (!layer) return [];
	const store = layer.store;
	const select =
		canvas.behaviours.get<graph.ClickSelectBehaviour>("click-select");
	const typeId = edgeTypeIdOf(id);
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
			id: "details",
			label: "Show details",
			onClick: () => onSelect({ kind: "edge-type", id: typeId }),
		},
	];
}

function exploreBackgroundItems(
	{ canvas }: GraphBackgroundMenuContext,
	selectMode: { mode: string; setMode: (mode: string) => void },
): MenuItem[] {
	const layer = canvas.layers.get<graph.GraphLayer>("graph");
	if (!layer) return [];
	const store = layer.store;
	const select =
		canvas.behaviours.get<graph.ClickSelectBehaviour>("click-select");
	return [
		{
			id: "select-mode",
			label: "Select mode",
			icon: SELECT_ICONS[selectMode.mode],
			children: Object.keys(SELECT_MODE_IDS).map((key) => ({
				id: `select-mode-${key}`,
				label: `${SELECT_LABEL[key]}${key === selectMode.mode ? " ✓" : ""}`,
				icon: SELECT_ICONS[key],
				onClick: () => selectMode.setMode(key),
			})),
		},
		{
			id: "fit",
			label: "Fit to content",
			onClick: () => canvas.camera.fitContent(layer.getBounds(), 80),
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

function ExploreContextMenus({
	nameToNodeId,
	onSelect,
}: {
	nameToNodeId: Map<string, string>;
	onSelect: (item: SelectedItem) => void;
}) {
	// Selection mode (click / brush / lasso) lives in the background menu as a
	// submenu; `useSelectMode` arms exactly one drag-select behaviour.
	const selectMode = useSelectMode(SELECT_MODE_IDS, {
		labels: SELECT_LABEL,
		initial: "click",
	});
	const node = useCallback(
		(ctx: GraphNodeMenuContext) =>
			exploreNodeItems(ctx, nameToNodeId, onSelect),
		[nameToNodeId, onSelect],
	);
	const edge = useCallback(
		(ctx: GraphEdgeMenuContext) => exploreEdgeItems(ctx, onSelect),
		[onSelect],
	);
	const background = useCallback(
		(ctx: GraphBackgroundMenuContext) =>
			exploreBackgroundItems(ctx, selectMode),
		[selectMode],
	);
	return (
		<>
			<GraphNodeContextMenu items={node} />
			<GraphEdgeContextMenu items={edge} />
			<GraphBackgroundContextMenu items={background} />
		</>
	);
}

interface ModellerToolsProps extends SchemaCanvasProps {
	nameToNodeId: Map<string, string>;
	edgeTypeName: Map<string, string>;
}

// All tool-gated behaviours + the inline inspector + context menus + the per-tool
// footer hint. Must live inside `<Board>` so it can call `useTool` /
// `useGraphCanvas` / `useInspectTarget`. The active tool comes from the
// `GraphToolProvider` lifted above the whole shell in ModellerPage (so the header
// `ModellerHeaderToolbar`, a sibling of `<Board>`, shares the same tool state).
function ModellerTools({
	onSelect,
	ctx,
	onRequestAddNode,
	onRequestAddEdge,
	onRequestDelete,
	onEraseType,
	onReverseEdge,
	nameToNodeId,
	edgeTypeName,
}: ModellerToolsProps) {
	const { tool, setTool } = useTool();
	const canvas = useGraphCanvas();
	const { fitContent } = useFitContent(LAYER_ID);
	const editable = !!ctx;

	// Surface the active tool's guidance on the message channel (footer
	// <CanvasMessageBar>) — sticky, so the footer always shows the current hint.
	// Read-only models explain how to start editing instead.
	useEffect(() => {
		canvas.showMessage(
			editable
				? (HINTS[tool] ?? "")
				: "Read-only model — create a draft to edit it",
		);
	}, [tool, canvas, editable]);

	// Drawing-behaviour factories are captured once at mount (init-only), so read
	// the live callbacks through refs to stay current.
	const cb = useRef({ onRequestAddNode, onRequestAddEdge, onEraseType });
	cb.current = { onRequestAddNode, onRequestAddEdge, onEraseType };

	// Click an element (Select tool) → drive the right-side DetailPanel.
	//
	// `onSelect` is read through a ref and deliberately kept OUT of the deps. A
	// caller that passes an inline handler and answers by storing a fresh object
	// closes a render loop otherwise: fire → set state → new handler identity →
	// effect re-runs on the unchanged target → fire again. React reports that as
	// "Maximum update depth exceeded". The inspect target is what says a new
	// element was clicked, so the target alone drives this.
	const selectRef = useRef(onSelect);
	selectRef.current = onSelect;
	const inspectTarget = useInspectTarget();
	useEffect(() => {
		if (!inspectTarget) return;
		if (inspectTarget.kind === "node") {
			const id = nameToNodeId.get(inspectTarget.id);
			if (id) selectRef.current({ kind: "node-type", id });
		} else {
			selectRef.current({
				kind: "edge-type",
				id: edgeTypeIdOf(inspectTarget.id),
			});
		}
	}, [inspectTarget, nameToNodeId]);

	const setInspect = useCallback(
		(target: InspectTarget | null) => {
			// Behaviour id defaults to 'click-inspect'; setTarget arms the inspector.
			(
				canvas.behaviours.get("click-inspect") as
					| { setTarget?: (t: InspectTarget | null) => void }
					| undefined
			)?.setTarget?.(target);
		},
		[canvas],
	);

	const createNode = useCallback((): GraphNode | null => {
		// Veto the store insert; open the existing node-type dialog instead. The
		// world position is discarded — positions are ephemeral (decision #2).
		cb.current.onRequestAddNode?.();
		return null;
	}, []);

	const createEdge = useCallback(
		(source: string, target: string): GraphEdge | null => {
			// Board node ids ARE node-type names, so they pass straight through to
			// the prefilled edge-type dialog. Veto the store insert.
			cb.current.onRequestAddEdge?.({ source, target });
			return null;
		},
		[],
	);

	const onErase = useCallback(
		(removed: ErasedElement) => {
			if (removed.kind === "node") {
				const id = nameToNodeId.get(removed.node.id);
				if (id) cb.current.onEraseType?.({ kind: "node", id });
			} else {
				cb.current.onEraseType?.({
					kind: "edge",
					id: edgeTypeIdOf(removed.edge.id),
				});
			}
		},
		[nameToNodeId],
	);

	// ── Context-menu builders ──────────────────────────────────────────────────
	const nodeMenu = useCallback(
		({ id }: { id: string }): MenuItem[] => {
			const typeId = nameToNodeId.get(id);
			const name = id;
			return [
				{
					id: "edit",
					label: "Edit properties…",
					onClick: () => {
						setTool("select");
						setInspect({ kind: "node", id });
						if (typeId) onSelect({ kind: "node-type", id: typeId });
					},
				},
				{
					id: "delete",
					label: "Delete node type",
					onClick: () =>
						typeId && onRequestDelete?.({ kind: "node", id: typeId, name }),
				},
			];
		},
		[nameToNodeId, onRequestDelete, onSelect, setInspect, setTool],
	);

	const edgeMenu = useCallback(
		({ id }: { id: string }): MenuItem[] => {
			const typeId = edgeTypeIdOf(id);
			const name = edgeTypeName.get(typeId) ?? "edge";
			return [
				{
					id: "edit",
					label: "Edit properties…",
					onClick: () => {
						setTool("select");
						setInspect({ kind: "edge", id });
						onSelect({ kind: "edge-type", id: typeId });
					},
				},
				{
					id: "reverse",
					label: "Reverse direction",
					onClick: () => onReverseEdge?.(typeId),
				},
				{
					id: "delete",
					label: "Delete edge type",
					onClick: () => onRequestDelete?.({ kind: "edge", id: typeId, name }),
				},
			];
		},
		[
			edgeTypeName,
			onRequestDelete,
			onReverseEdge,
			onSelect,
			setInspect,
			setTool,
		],
	);

	const backgroundMenu = useCallback(
		(): MenuItem[] => [
			{
				id: "add-node",
				label: "Add node type…",
				icon: Plus,
				onClick: () => onRequestAddNode?.(),
			},
			{ id: "fit", label: "Fit to content", onClick: () => fitContent() },
		],
		[onRequestAddNode, fitContent],
	);

	return (
		<>
			{/* Select tool: move nodes, click to select / inspect. Enabled regardless
			    of editability — selecting/inspecting is harmless on read-only models.

			    `click-select` is **registered but never gesture-enabled**, and that is
			    load-bearing rather than an oversight: it and `click-inspect` both claim
			    `pointer+click`, and the canvas refuses the second claimant. Enabling
			    both meant `click-inspect` never armed — so `useInspectTarget()` stayed
			    null, `onSelect` never fired, and clicking a type on the canvas selected
			    nothing at all.

			    The two have different jobs (see {@link SelectionBridge}):
			    `click-inspect` carries canvas → panel, and `click-select` is driven
			    *programmatically* by the bridge for panel → canvas highlighting. Only
			    the first needs the gesture. */}
			<DragNodeBehaviour targetLayerId={LAYER_ID} enabled={tool === "select"} />
			<ClickSelectBehaviour
				targetLayerId={LAYER_ID}
				enabled={false}
				multiple={false}
			/>
			<ClickInspectBehaviour
				targetLayerId={LAYER_ID}
				enabled={tool === "select"}
			/>
			<ParallelEdgeBehaviour targetLayerId={LAYER_ID} />

			{editable && (
				<>
					<CreateNodeBehaviour
						targetLayerId={LAYER_ID}
						enabled={tool === "add"}
						createNode={createNode}
					/>
					<DrawEdgeBehaviour
						targetLayerId={LAYER_ID}
						enabled={tool === "connect"}
						allowSelfLoop
						createEdge={createEdge}
					/>
					<EraseBehaviour
						targetLayerId={LAYER_ID}
						enabled={tool === "delete"}
						onErase={onErase}
					/>

					<GraphNodeContextMenu items={nodeMenu} />
					<GraphEdgeContextMenu items={edgeMenu} />
					<GraphBackgroundContextMenu items={backgroundMenu} />
				</>
			)}
		</>
	);
}
