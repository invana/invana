/**
 * **One canvas, four kinds** — `plan` · `workflow` · `envelope` · `lineage`
 * drawn through `@invana/canvas-react`, the same stack the Explorer and the
 * Modeller use ([canvas kinds](../../../../docs/for-developers/modules/explore/spec.md)).
 *
 * These four used to render as bespoke inline SVG. The argument for that — a
 * few dozen labelled boxes is a different job from 100K records at 60fps — was
 * true about the *data* and irrelevant to the *work*: what a small DAG needs is
 * layout, labelled edges, selection, fit, pan, zoom and theme, and the shared
 * canvas had already answered every one of them. The SVG answered them again,
 * worse, and one of those answers made the engine lie: a renderer that could
 * only draw a line asked for a chain, so `nl-compare` claimed its second
 * reading of the graph waited on the first.
 *
 * Each kind supplies **data and meaning**; this file supplies the picture:
 *
 * | Kind | Column is | An edge is | Writes from a gesture |
 * |---|---|---|---|
 * | `plan` | a wave | a dependency (finish → start) | **yes** — drag card → card |
 * | `workflow` | required order | order · `${steps.X.y}` binding | no |
 * | `envelope` | allowed vs not | a `require` precondition | no |
 * | `lineage` | causal depth | authored · spawned · delegated-for | no |
 *
 * **The canvas law still holds** (docs/for-developers/modules/agents/features/lineage.md): it selects and draws. Exactly
 * one kind writes, `plan`, and only where the geometry *is* the datum —
 * drawing the edge is creating the dependency — and it hands off to the same
 * endpoint the panel uses.
 */

import {
	CANVAS_KINDS,
	type CanvasKind,
} from "@/pages/graphs-detail/features/boards";
import { readCanvasThemeConfig } from "@/pages/graphs-detail/features/explorer";
import type { Tone } from "@/pages/graphs-detail/shared/statusTone";
// The root is `<GraphCanvas>`, not `<Board>`: only it provides
// `GraphCanvasContext`, which every `useGraphCanvas()` below depends on. Up to
// canvas 0.0.11 `<Board>` provided it too, so this reads like a free swap —
// it is not. Under a plain `<Board>` those hooks throw at render, and nothing
// at the type level says so.
import { WorldLayer } from "@invana/canvas";
import {
	BackgroundLayer,
	type CanvasProps,
	ClickSelectBehaviour,
	DragNodeBehaviour,
	DragPanBehaviour,
	DrawEdgeBehaviour,
	GraphCanvas,
	GraphLayer,
	PinchZoomBehaviour,
	TextResolutionLODBehaviour,
	WheelZoomBehaviour,
	useCanvasEvent,
	useGraphCanvas,
	useGraphCanvasUpdate,
	useSelection,
} from "@invana/canvas-react";
import type {
	GraphData,
	GraphEdge,
	GraphNode,
	ResolvableEdgeStyle,
	ResolvableNodeStyle,
} from "@invana/graph";
import type * as graph from "@invana/graph";
import { ElkLayout } from "@invana/graph-layout-elkjs";
import { useTheme } from "@invana/themes";
import { cn } from "@invana/ui";
// Vite's worker idiom: `?worker` makes the bundler emit the ELK solver as a
// worker asset and hand back a constructor. See {@link newElkLayout} for why
// the layout package's own default factory cannot be used.
import ElkWorker from "elkjs/lib/elk-worker.min.js?worker";
import { MousePointer2, Spline } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

const LAYER_ID = "graph";
const LAYOUT_ID = "work-layered";

/**
 * The same status vocabulary the panels use, so a task drawn on the plan and the
 * same task listed beside it cannot disagree about what colour it is.
 */
export type WorkTone = Tone;

export interface WorkNode {
	id: string;
	label: string;
	/** Second line under the label — an assignee, a task key, a status. */
	sub?: string;
	/** The kind's semantic axis: a wave, a depth, allowed-vs-not. */
	column: number;
	tone?: WorkTone;
	/** Drawn hollow and faded — a step this envelope does not allow. */
	disabled?: boolean;
	/** `lineage` only: which of agent / user / task this node is. */
	nodeKind?: string;
}

export interface WorkEdge {
	id: string;
	source: string;
	target: string;
	label?: string;
	/** Dashed — a binding, or an assignment: something other than plain order. */
	dashed?: boolean;
	/** On the critical path: the one thing drawn in the accent colour. */
	highlight?: boolean;
}

interface Props {
	kind: CanvasKind;
	nodes: WorkNode[];
	edges: WorkEdge[];
	selectedNodeId?: string | null;
	selectedEdgeId?: string | null;
	onSelectNode?: (id: string | null, node: WorkNode | null) => void;
	onSelectEdge?: (id: string | null) => void;
	/**
	 * Drag node → node. Only `plan` passes this; passing it turns on the
	 * Connect tool, and the canvas's one write with it.
	 */
	onConnect?: (sourceId: string, targetId: string) => void;
	/**
	 * `layered` runs ELK; `fixed` keeps the seeded columns. An `envelope` is a
	 * classification, not a flow — layering its two piles moves them around for
	 * no reason.
	 */
	layout?: "layered" | "fixed";
	/** Shown in place of the legend copy — e.g. a 422 that named the loop. */
	error?: string | null;
	emptyHint?: string;
}

// ── Paint ────────────────────────────────────────────────────────────────────
//
// Pixi wants numbers, so these are the theme's colours resolved once rather
// than CSS variables: `--primary` (brand green), `--muted-foreground`, and the
// three status hues the panels already use. <ThemeBridge> retints the canvas
// chrome; the semantic tones stay stable across themes on purpose — "green
// means it served" should not become "blue means it served" in a light theme.

const TONE_FILL: Record<WorkTone, number> = {
	muted: 0x646b73,
	queued: 0x646b73,
	info: 0x2bab5a,
	running: 0x2bab5a,
	success: 0x10b981,
	warning: 0xf59e0b,
	error: 0xef4444,
};
const NODE_RADIUS = 13;
const LABEL_LINE_HEIGHT = 14;
const LABEL_OFFSET_Y = 5;
const LABEL_COLOUR = 0x9199a1;
const EDGE_COLOUR = 0x646b73;

interface NodeDatum {
	text: string;
	tone: WorkTone;
	disabled: boolean;
}
interface EdgeDatum {
	label: string;
	dashed: boolean;
	highlight: boolean;
}

/**
 * Fit a node's label to the space a column actually has.
 *
 * Task titles are sentences ("List single-sourced parts and their suppliers"),
 * and the renderer draws a label as one unbroken line under the node — so on a
 * plan with six real tasks the labels ran straight through their neighbours and
 * the graph became unreadable.
 *
 * **Every label is exactly one line, plus the sub-line when there is one.** The
 * tempting fix — wrap the title to two or three lines — makes a node's height
 * depend on its text, and the layout then has to be spaced for the worst case,
 * which leaves a graph of short labels sparse and a graph of long ones still
 * colliding. A fixed two-line box is the one shape the layout can reserve room
 * for exactly.
 *
 * Truncation is safe here in a way it would not be elsewhere: the panel beside
 * the canvas carries every title in full, so nothing is only ever visible in a
 * clipped form.
 */
const LABEL_CHARS = 24;

function clampLine(line: string): string {
	return line.length > LABEL_CHARS
		? `${line.slice(0, LABEL_CHARS - 1)}…`
		: line;
}

const NODE_STYLE: ResolvableNodeStyle<GraphNode> = {
	shape: { kind: "circle", radius: NODE_RADIUS },
	// Every field resolves from the node's own datum at the *template* level.
	// A per-instance `style` would REPLACE this template — the node would keep
	// its label and lose its shape, which is the trap `SchemaCanvas` documents.
	bgFill: (n: GraphNode) => TONE_FILL[(n.data as NodeDatum)?.tone ?? "muted"],
	bgAlpha: (n: GraphNode) => ((n.data as NodeDatum)?.disabled ? 0.25 : 1),
	bgStrokeWidth: 2,
	bgStrokeColor: (n: GraphNode) =>
		(n.data as NodeDatum)?.disabled
			? TONE_FILL[(n.data as NodeDatum)?.tone ?? "muted"]
			: 0x181a1b,
	bgStrokeDashArray: (n: GraphNode) =>
		(n.data as NodeDatum)?.disabled ? ([3, 3] as const) : ([0, 0] as const),
	labelText: (n: GraphNode) => String((n.data as NodeDatum)?.text ?? n.id),
	labelColor: LABEL_COLOUR,
	labelFontSize: 12,
	// Below the circle: the only placement that survives a label as long as
	// "Execute A · execute_graph_query".
	labelPlacement: "bottom",
	labelOffsetY: LABEL_OFFSET_Y,
	labelLineHeight: LABEL_LINE_HEIGHT,
};

const EDGE_STYLE: ResolvableEdgeStyle<GraphEdge> = {
	strokeColor: (e: GraphEdge) =>
		(e.data as EdgeDatum)?.highlight ? TONE_FILL.info : EDGE_COLOUR,
	strokeWidth: (e: GraphEdge) => ((e.data as EdgeDatum)?.highlight ? 2.5 : 1.5),
	strokeDashArray: (e: GraphEdge) =>
		(e.data as EdgeDatum)?.dashed ? ([4, 3] as const) : ([0, 0] as const),
	arrowTargetShape: "triangle",
	arrowTargetSize: 7,
	arrowTargetColor: (e: GraphEdge) =>
		(e.data as EdgeDatum)?.highlight ? TONE_FILL.info : EDGE_COLOUR,
	labelText: (e: GraphEdge) => String((e.data as EdgeDatum)?.label ?? ""),
	labelColor: LABEL_COLOUR,
	labelFontSize: 10,
	// A dashed edge often runs *past* the node between its ends (translate →
	// execute skips validate), so its label would land on that node's own edge.
	// Sitting the two kinds on opposite sides of the path keeps both readable.
	labelOffsetY: (e: GraphEdge) => ((e.data as EdgeDatum)?.dashed ? 9 : -9),
};

const OPTIONS: NonNullable<CanvasProps["config"]> = {
	layers: { background: { type: "pattern", patternType: "dots", alpha: 0.4 } },
	behaviours: {
		pan: { enabled: true },
		wheel: { enabled: true },
		pinch: { enabled: true },
		// A node may be nudged for legibility; no position is ever saved,
		// because a position is not a fact about a plan or a workflow.
		"drag-node": { enabled: true },
		"click-select": { enabled: true },
		"label-lod": { enabled: true },
	},
};

/** Left → right, one layer per column. */
const newElkLayout = () =>
	new ElkLayout({
		id: LAYOUT_ID,
		targetLayerId: LAYER_ID,
		algorithm: "layered",
		direction: "RIGHT",
		/**
		 * Room for the two-line label that hangs under every node.
		 *
		 * ELK sizes a node from its shape — a 26px circle — and knows nothing
		 * about the label below it, so the gap has to cover 26px of node plus a
		 * 5px offset plus two 14px lines. That is why the label is clamped to a
		 * fixed two lines above: a height that varies with the text cannot be
		 * spaced for without either crowding or wasting the whole canvas.
		 *
		 * These two typed fields are the whole configuration. An earlier version
		 * also passed them again through `layoutOptions` as raw ELK keys, on the
		 * theory that the typed ones were being ignored — they are not, and the
		 * duplicate root-level properties made the solver return nothing at all,
		 * which rendered every workflow DAG as an empty canvas.
		 */
		nodeSpacing: 76,
		layerSpacing: 150,
		// **The worker has to be ours.** `ElkLayout`'s default factory resolves
		// `elkjs/lib/elk-worker.min.js` relative to the *package*, which Vite
		// does not turn into a worker asset — the Worker is constructed, never
		// answers, and the layout promise hangs with every node stacked on the
		// origin. Its synchronous fallback is no help either (`BundledELK is not
		// a constructor`, a CJS-interop bug in the layout package), so this
		// override is the working path, not a nicety.
		workerFactory: () => new ElkWorker(),
	});

export function WorkGraphCanvas({
	kind,
	nodes,
	edges,
	selectedNodeId,
	selectedEdgeId,
	onSelectNode,
	onSelectEdge,
	onConnect,
	layout = "layered",
	error,
	emptyHint,
}: Props) {
	// The Connect tool, on the one kind that has one. Local state rather than a
	// `GraphToolProvider`: this canvas owns both tools and nothing outside it
	// needs to know which is armed.
	const [connecting, setConnecting] = useState(false);

	const data: GraphData = useMemo(() => {
		// Seed each node in its own column before any layout runs. The column is
		// already the answer — a wave, a depth — so the *first* paint is a
		// correct left→right picture rather than a pile on the origin, and a
		// layout that is slow, hung or skipped degrades to a plain grid.
		const row = new Map<number, number>();
		return {
			nodes: nodes.map((node): GraphNode => {
				const at = row.get(node.column) ?? 0;
				row.set(node.column, at + 1);
				return {
					id: node.id,
					type: node.nodeKind ?? kind,
					position: { x: node.column * 190, y: at * 90 },
					data: {
						text: node.sub
							? `${clampLine(node.label)}\n${clampLine(node.sub)}`
							: clampLine(node.label),
						tone: node.tone ?? "muted",
						disabled: !!node.disabled,
					} satisfies NodeDatum,
				};
			}),
			edges: edges.map(
				(edge): GraphEdge => ({
					id: edge.id,
					source: edge.source,
					target: edge.target,
					// `@invana/graph` 0.0.12 requires a type on every edge. The
					// distinction the canvas already draws is the one `dashed`
					// names: a binding or an assignment, against plain order.
					type: edge.dashed ? "binding" : "order",
					data: {
						label: edge.label ?? "",
						dashed: !!edge.dashed,
						highlight: !!edge.highlight,
					} satisfies EdgeDatum,
				}),
			),
		};
	}, [nodes, edges, kind]);

	if (!nodes.length) {
		return (
			<div className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
				{emptyHint ?? "Nothing to draw yet."}
			</div>
		);
	}

	return (
		<div className="relative h-full w-full">
			<GraphCanvas autoResize config={OPTIONS} className="h-full w-full">
				<BackgroundLayer id="background" />
				<GraphLayer
					id={LAYER_ID}
					data={data}
					node={{ style: NODE_STYLE }}
					edge={{ style: EDGE_STYLE }}
				/>
				<LayoutBridge data={data} run={layout === "layered"} />
				<ThemeBridge />

				<DragPanBehaviour id="pan" />
				{/* Node-drag and edge-draw both start on a node pointer-down, so
				    exactly one of them is ever enabled. */}
				<DragNodeBehaviour
					id="drag-node"
					targetLayerId={LAYER_ID}
					enabled={!connecting}
				/>
				<WheelZoomBehaviour id="wheel" />
				<PinchZoomBehaviour id="pinch" />
				<ClickSelectBehaviour id="click-select" targetLayerId={LAYER_ID} />
				<TextResolutionLODBehaviour id="label-lod" targetLayerId={LAYER_ID} />
				{onConnect ? (
					<DrawEdgeBehaviour
						targetLayerId={LAYER_ID}
						enabled={connecting}
						createEdge={(source: string, target: string) => {
							// Veto the store insert and hand off to the endpoint: the
							// refetch is what draws the edge, so the picture can never
							// claim a dependency the backend rejected.
							onConnect(source, target);
							return null;
						}}
					/>
				) : null}

				<SelectionBridge
					nodes={nodes}
					selectedNodeId={selectedNodeId ?? null}
					selectedEdgeId={selectedEdgeId ?? null}
					onSelectNode={onSelectNode}
					onSelectEdge={onSelectEdge}
				/>
			</GraphCanvas>

			{onConnect ? (
				<ToolSwitch connecting={connecting} onChange={setConnecting} />
			) : null}
			<Legend kind={kind} error={error} connecting={connecting} />
		</div>
	);
}

/**
 * Runs the layout and frames it — on mount, and again whenever the drawing
 * changes.
 *
 * Three ordering facts shape this, all of them learned the hard way (docs/for-developers/modules/explore/features/graph-canvas.md
 * § 5):
 *
 * 1. **The renderer initialises asynchronously.** A layout run before
 *    `canvas:renderer:ready` reaches a layer whose container is not mounted,
 *    and the fit throws into a swallowed promise. Subscribing is not enough —
 *    on a cold load the event can fire first, so `isInitialised` is read too.
 * 2. **Data arrives after mount**, and again per selection, so a
 *    run-once-on-mount layout leaves the second subject on the first one's
 *    coordinates.
 * 3. **`fitContent` reads the rendered bounds**, which move at three different
 *    moments — first paint, layout result, panel resize. Fitting once frames
 *    whichever happened to be current, and a canvas framed to a stale bound is
 *    a blank one.
 */
function LayoutBridge({ data, run }: { data: GraphData; run: boolean }) {
	const canvas = useGraphCanvas();
	const [ready, setReady] = useState(false);
	useCanvasEvent("canvas:renderer:ready", () => setReady(true));
	useEffect(() => {
		if (canvas.isInitialised) setReady(true);
	}, [canvas]);

	useEffect(() => {
		if (!ready || !data.nodes.length) return;
		let alive = true;
		const fit = () => {
			const layer = canvas.layers.get(LAYER_ID);
			// `layers.get` is typed to `ILayer`; only a world layer has an extent
			// to fit to. The engine duck-types this the same way.
			if (!alive || !layer || !(layer instanceof WorldLayer)) return;
			canvas.camera.fitContent(layer.getBounds(), 70);
			// **Fit, don't magnify.** A lineage with one node, or a three-step
			// workflow, fits by zooming until the circles fill the viewport and
			// the labels read like a headline. Fitting is about seeing the whole
			// thing, so 100% is the ceiling.
			if (canvas.camera.scale > 1) canvas.camera.setZoom(1);
		};
		const after = (ms: number) =>
			new Promise((resolve) => window.setTimeout(resolve, ms));

		void (async () => {
			// Frame the seeded columns immediately, so there is a correct picture
			// on screen while ELK's worker boots.
			fit();
			if (run) {
				if (!canvas.layouts.has(LAYOUT_ID)) canvas.layouts.add(newElkLayout());
				await canvas.runLayout(LAYOUT_ID);
			}
			// Then frame the result — more than once, because `fitContent` reads
			// the *rendered* bounds and those settle a paint or two after the
			// positions do (and again when the panel finishes resizing).
			for (const delay of [0, 150, 450]) {
				await after(delay);
				if (!alive) return;
				fit();
			}
		})();

		return () => {
			alive = false;
		};
	}, [ready, data, run, canvas]);

	return null;
}

/** Board colours follow Studio's active theme, like every other canvas. */
function ThemeBridge() {
	const { variantId, isDark } = useTheme();
	const update = useGraphCanvasUpdate();
	// biome-ignore lint/correctness/useExhaustiveDependencies: variantId/isDark are trigger-only — the effect re-reads the live DOM tokens on any theme change
	useEffect(() => {
		const id = requestAnimationFrame(() => update(readCanvasThemeConfig()));
		return () => cancelAnimationFrame(id);
	}, [variantId, isDark, update]);
	return null;
}

/**
 * Selection, both ways: a click on the canvas moves the panel's detail, and a
 * row chosen in the panel lights up on the canvas.
 *
 * Nodes and edges are both selectable because on a `lineage` the **edge** is
 * the interesting thing — it stands for an event, with an actor and a cause
 * (docs/for-developers/modules/agents/features/lineage.md).
 *
 * **Each direction has to know which one it is.** The two effects run in the
 * same commit, canvas→panel first, so "the canvas disagrees with the prop" is
 * *not* evidence that the canvas moved: right after a panel row is picked the
 * canvas has not been told yet. Reading it as a canvas gesture made the two
 * directions fight — the echo cleared the row, the next commit re-selected it
 * from the canvas, and React stopped the page with "Maximum update depth
 * exceeded". So the canvas→panel direction fires only when the canvas's own
 * selection *changed*, tracked in {@link applied}, which both directions write
 * whenever they are the one that moved it.
 */
function SelectionBridge({
	nodes,
	selectedNodeId,
	selectedEdgeId,
	onSelectNode,
	onSelectEdge,
}: {
	nodes: WorkNode[];
	selectedNodeId: string | null;
	selectedEdgeId: string | null;
	onSelectNode?: (id: string | null, node: WorkNode | null) => void;
	onSelectEdge?: (id: string | null) => void;
}) {
	const canvas = useGraphCanvas();
	const { selectedNodeIds, selectedEdgeIds } = useSelection();

	/** The canvas selection as both directions last left it. */
	const applied = useRef<{ node: string | null; edge: string | null }>({
		node: selectedNodeId,
		edge: selectedEdgeId,
	});
	// The panel's side of the bridge, read at fire time rather than depended on:
	// `nodes` and the two handlers are rebuilt by every parent render, and this
	// effect must answer to the canvas alone.
	const panel = useRef({
		selectedNodeId,
		selectedEdgeId,
		onSelectNode,
		onSelectEdge,
		nodes,
	});
	panel.current = {
		selectedNodeId,
		selectedEdgeId,
		onSelectNode,
		onSelectEdge,
		nodes,
	};

	// Board → panel.
	useEffect(() => {
		const nodeId = selectedNodeIds[0] ?? null;
		const edgeId = selectedEdgeIds[0] ?? null;
		if (nodeId === applied.current.node && edgeId === applied.current.edge)
			return;
		applied.current = { node: nodeId, edge: edgeId };
		const current = panel.current;
		if (nodeId !== current.selectedNodeId) {
			current.onSelectNode?.(
				nodeId,
				current.nodes.find((n) => n.id === nodeId) ?? null,
			);
		}
		if (edgeId !== current.selectedEdgeId) current.onSelectEdge?.(edgeId);
	}, [selectedNodeIds, selectedEdgeIds]);

	// Panel → canvas.
	useEffect(() => {
		const select =
			canvas.behaviours.get<graph.ClickSelectBehaviour>("click-select");
		if (!select) return;
		applied.current = { node: selectedNodeId, edge: selectedEdgeId };
		if (selectedNodeId) select.select(selectedNodeId, "shape");
		else if (selectedEdgeId) select.select(selectedEdgeId, "connector");
		else select.clearSelection();
	}, [selectedNodeId, selectedEdgeId, canvas]);

	return null;
}

/** Select / Connect. Shown only on the kind that can write (`plan`). */
function ToolSwitch({
	connecting,
	onChange,
}: {
	connecting: boolean;
	onChange: (connecting: boolean) => void;
}) {
	return (
		<div className="absolute left-2 top-2 flex items-center gap-0.5 rounded-sm border bg-card/90 p-0.5 backdrop-blur">
			<ToolButton
				label="Select / move"
				active={!connecting}
				onClick={() => onChange(false)}
			>
				<MousePointer2 className="h-3.5 w-3.5" />
			</ToolButton>
			<ToolButton
				label="Connect — drag a task onto the one that waits for it"
				active={connecting}
				onClick={() => onChange(true)}
			>
				<Spline className="h-3.5 w-3.5" />
			</ToolButton>
		</div>
	);
}

function ToolButton({
	label,
	active,
	onClick,
	children,
}: {
	label: string;
	active: boolean;
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			title={label}
			aria-label={label}
			aria-pressed={active}
			onClick={onClick}
			className={cn(
				"flex h-6 w-6 items-center justify-center rounded-sm hover:bg-accent",
				active ? "bg-accent text-primary" : "text-muted-foreground",
			)}
		>
			{children}
		</button>
	);
}

// ── Legend ───────────────────────────────────────────────────────────────────

interface LegendKey {
	swatch: "node" | "edge";
	tone?: WorkTone;
	dashed?: boolean;
	label: string;
}

const LEGENDS: Record<CanvasKind, { keys: LegendKey[]; note: string }> = {
	plan: {
		keys: [
			{ swatch: "node", tone: "success", label: "done" },
			{ swatch: "node", tone: "info", label: "in progress · critical path" },
			{ swatch: "node", tone: "warning", label: "review · needs input" },
			{
				swatch: "node",
				tone: "muted",
				label: "blocked · waiting on dependencies",
			},
			{ swatch: "edge", label: "finish → start" },
		],
		note: "Order is derived: dependencies first, then due date · columns are waves — what can run in parallel.",
	},
	workflow: {
		keys: [
			{
				swatch: "node",
				tone: "muted",
				label: "always present (plan · verify)",
			},
			{ swatch: "node", tone: "info", label: "template step" },
			{ swatch: "edge", label: "required order" },
			{ swatch: "edge", dashed: true, label: "${steps.X.y} binding" },
		],
		note: "A workflow is the reusable plan. Each agent's envelope decides which workflows it may select and pins what a plan cannot change. Clicking a step selects it; nothing here is editable.",
	},
	envelope: {
		keys: [
			{ swatch: "node", tone: "success", label: "this agent may run it" },
			{ swatch: "node", tone: "muted", dashed: true, label: "it may not" },
			{ swatch: "edge", label: "require" },
		],
		note: "What the agent may not do is as much of the answer as what it may. The envelope is edited in the panel, with Save.",
	},
	lineage: {
		keys: [
			{ swatch: "node", tone: "success", label: "agent · active" },
			{ swatch: "node", tone: "warning", label: "agent · ephemeral / paused" },
			{ swatch: "node", tone: "muted", label: "person" },
			{ swatch: "node", tone: "info", label: "task" },
			{ swatch: "edge", dashed: true, label: "assigned" },
		],
		// Three kinds of node live here, and a click means something different on
		// each — so the legend says which, rather than leaving a user to find out
		// by being navigated somewhere they did not expect.
		note: "An agent selects into the roster. A task opens in Tasks — this panel has no row for it. A person has no surface in MVP. An edge is an event: selecting one says what happened, for whom, and why.",
	},
	data: { keys: [], note: "" },
	model: { keys: [], note: "" },
};

function Legend({
	kind,
	error,
	connecting,
}: {
	kind: CanvasKind;
	error?: string | null;
	connecting: boolean;
}) {
	const legend = LEGENDS[kind];
	const spec = CANVAS_KINDS[kind];
	return (
		<div
			className={cn(
				"pointer-events-none absolute bottom-2 left-2 right-2 max-w-2xl rounded-sm border bg-card/90 px-2 py-1.5 text-sm backdrop-blur",
				error ? "border-destructive/50" : "border-border",
			)}
		>
			{error ? (
				<span className="text-destructive">{error}</span>
			) : (
				<>
					{legend.keys.length ? (
						<div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
							{legend.keys.map((key) => (
								<LegendItem key={key.label} {...key} />
							))}
						</div>
					) : null}
					<span className="text-muted-foreground">
						{connecting
							? "Connect: drag a task onto the one that waits for it. Everything else is edited in the panel."
							: legend.note}
					</span>
					{!connecting && spec.writesFromGesture ? null : null}
				</>
			)}
		</div>
	);
}

function LegendItem({ swatch, tone = "muted", dashed, label }: LegendKey) {
	const colour = `#${TONE_FILL[tone].toString(16).padStart(6, "0")}`;
	return (
		<span className="flex items-center gap-1.5">
			{swatch === "node" ? (
				<span
					className="h-2.5 w-2.5 rounded-full"
					style={
						dashed
							? { border: `1.5px dashed ${colour}` }
							: { background: colour }
					}
				/>
			) : (
				<span
					className="h-0 w-4"
					style={{
						borderTop: `1.5px ${dashed ? "dashed" : "solid"} hsl(var(--muted-foreground))`,
						opacity: 0.7,
					}}
				/>
			)}
			{label}
		</span>
	);
}
