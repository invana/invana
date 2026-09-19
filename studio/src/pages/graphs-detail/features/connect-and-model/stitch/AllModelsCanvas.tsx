/**
 * All models — every published model on one canvas (stitch-models.md ST14).
 *
 * A model is a group frame, its node types are the members, and a **stitch is
 * the only edge allowed to cross a frame**. None of that is drawn by hand: the
 * frame is `@invana/graph`'s group (`style.group` + `parentId`), ELK packs the
 * members inside it (ST20), and a crossing is a crossing because its endpoints
 * sit in two different groups.
 *
 * **Altitude is collapse** (ST15). Below the zoom threshold every frame carries
 * the `collapsed` state: a `tabbed-rect` closes to its own tab, so each model
 * reads as one named folder and the layer re-routes every stitch onto it. Above
 * the threshold the frames open and the same edges land back on the types they
 * always named. One canvas, one data build, nothing hidden from the reader.
 *
 * It does not write. Authoring a model is the model canvas, on a draft (ME1);
 * this draws published versions and declares stitches between them.
 */

import {
	useCommitStitchesMutation,
	useDiscardStitchesMutation,
} from "@/hooks/queries/useModels";
import {
	FRAME_TYPE,
	type FrameEdgeData,
	type FrameNodeData,
	type ModelFrame,
	STITCH_ANCHOR,
	buildAllModelsData,
	frameIdOf,
	hueTokenForIndex,
	parseMemberId,
} from "@/pages/graphs-detail/features/connect-and-model/stitch/allModels";
import { DeclareStitchPanel } from "@/pages/graphs-detail/features/connect-and-model/stitch/components/DeclareStitchPanel";
import { useAllModels } from "@/pages/graphs-detail/features/connect-and-model/stitch/useAllModels";
import {
	readCanvasForeground,
	readCanvasThemeConfig,
} from "@/pages/graphs-detail/features/explorer";
import type { LinkKind } from "@/types/models";
import {
	BackgroundLayer,
	ClickSelectBehaviour,
	CollapseExpandBehaviour,
	DragNodeBehaviour,
	DragPanBehaviour,
	DrawEdgeBehaviour,
	ElkLayout,
	GraphCanvas,
	GraphLayer,
	PinchZoomBehaviour,
	WheelZoomBehaviour,
	useCanvasEvent,
	useFitContent,
	useGraphCanvas,
	useGraphCanvasUpdate,
	useZoom,
} from "@invana/canvas-react";
import { ToolbarItems } from "@invana/canvas-ui";
import type { ToolbarItem } from "@invana/canvas-ui";
import { Slider } from "@invana/forms";
import { COLLAPSED_STATE } from "@invana/graph";
import type {
	EdgeStyle,
	GraphCanvas as GraphCanvasEngine,
	GraphEdge,
	GraphLayer as GraphLayerEngine,
	GraphNode,
	NodeStyle,
	ResolvableEdgeStyle,
	ResolvableNodeStyle,
} from "@invana/graph";
import { useTheme } from "@invana/themes";
import {
	Badge,
	Button,
	EmptyState,
	Legend,
	LegendItem,
	Spinner,
} from "@invana/ui";
import ElkWorker from "elkjs/lib/elk-worker.min.js?worker";
import {
	AlertTriangle,
	Boxes,
	Check,
	Link2,
	Maximize2,
	MousePointer2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const LAYER_ID = "graph";
const LAYOUT_ID = "elk-all-models";

/**
 * Below this zoom every frame is closed and the canvas reads as the
 * constellation; above it they open. One number, because two (a separate
 * open-at and close-at) is a hysteresis nobody asked for and a reader cannot
 * predict.
 */
const ALTITUDE_THRESHOLD = 1;

/** The ends of the altitude track. Below the threshold is the constellation. */
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;
/** Where "Types" lands — comfortably past the threshold, not at the far end. */
const TYPES_ZOOM = 1.6;
/**
 * The altitude the landscape opens at — the constellation, just under the
 * threshold. The first fit is clamped to it so that framing the models cannot
 * itself expand them (ST25).
 */
const CONSTELLATION_ZOOM = ALTITUDE_THRESHOLD - 0.05;
/** Screen-px margin for the one fit this canvas performs, and for the Fit button. */
const FIT_PADDING = 60;
/**
 * The box a model with nothing drawn in it occupies — a frame that is a plain
 * node rather than a group (ST29), so this is both what it is drawn at and what
 * ELK reserves for it. It is the size of a *closed* frame, because a model with
 * nothing published has nothing to open: at the landscape altitude it reads as
 * one more named folder beside the others, rather than as a big empty box.
 */
const EMPTY_FRAME = { width: 210, height: 44 };

const frameStyleFor = (n: GraphNode, labelColor: number): NodeStyle => {
	const d = (n.data ?? {}) as FrameNodeData;
	return {
		shape: {
			kind: "tabbed-rect",
			// The tab is what a **collapsed** frame closes to (ST15), so it is sized
			// here rather than left to auto-size: every model reads as the same
			// named folder at the landscape altitude.
			tabWidth: 210,
			// A sized box only for the empty frame. On a group, a `shape` size is a
			// floor the renderer applies and the solver never sees, so the frame is
			// drawn wider than the space ELK reserved for it — a frame on top of its
			// neighbour (ST29). `autoFit` owns the size of a frame that has members.
			...(d.empty ? EMPTY_FRAME : {}),
			// Two lines ride in the tab — the model and the version this canvas is
			// drawing — so it is deeper than the 26px a one-line tab needs.
			tabHeight: 38,
			cornerRadius: 6,
			tabAlign: "left",
			tabSkew: 10,
		},
		// The presence of this field is what makes the node a group; everything
		// else here is how the frame looks — and a model with nothing drawn in it
		// is deliberately **not** one (ST29): ELK sizes a group from its members
		// and reserves nothing at all for one with none, so an empty group was
		// drawn at the shape's size on top of whatever ELK put beside it. Without
		// `group` it is an ordinary node, ELK reserves the box it is drawn at, and
		// the packing is honest.
		...(d.empty
			? {}
			: {
					group: {
						autoFit: true,
						padding: 26,
						// The tab auto-sizes to the measured title — leaving `tabWidth`
						// unset is what keeps a row of frames with differently-sized names
						// consistent.
						headerHeight: 38,
						behindChildren: true,
						tabAlign: "left",
						tabSkew: 10,
						togglePlacement: "top-right",
						// No `width`/`height`: a floor the solver does not know about is a
						// frame drawn wider than the space reserved for it, which is a
						// frame lying on its neighbour. The box is whatever the members
						// plus `padding` and `headerHeight` come to — the same number ELK
						// works from.
					},
				}),
		bgFill: d.hue,
		bgAlpha: 0.18,
		bgStrokeColor: d.hue,
		bgStrokeAlpha: 0.5,
		bgStrokeWidth: 1.5,
		// Two lines in the tab, because the tab auto-sizes to what it is given:
		// the model, and the version of it this canvas is drawing.
		labelText: `${d.modelName}\n${d.caption ?? ""}`.trim(),
		// A `tabbed-rect` routes every `inside-*` placement into its **tab**, so
		// the model's name sits on the boundary rather than over the types inside
		// it — and it takes no offsets and no background pill, because the tab is
		// real geometry rather than a floated chip.
		labelPlacement: "inside-center",
		// The theme's text colour, not the model's own hue: a pastel title on a
		// wash of the same pastel is a name nobody can read, and the hue already
		// says which model this is — on the border, the wash, the members and the
		// legend row. It is passed in rather than hardcoded because a frame's
		// per-node style replaces the layer template `<ThemeBridge>` patches, so
		// nothing else here follows the theme (ST33).
		labelColor,
		// The frame body is a 7%% wash; without this the title inherits that and
		// a named boundary reads as an unnamed one.
		labelAlpha: 1,
		labelFontSize: 12,
		labelFontWeight: 700,
	};
};

/**
 * What a frame looks like **closed** — the node's own `state.collapsed` overlay,
 * which is the door the engine documents for this. The tab is the whole model up
 * here, so it carries more of the hue than the open frame's 7% wash does and its
 * title is drawn at full strength; the open frame is a boundary around types,
 * the closed one is a label.
 */
const collapsedFrameStyleFor = (
	d: FrameNodeData,
	labelColor: number,
): NodeStyle => ({
	bgFill: d.hue,
	bgAlpha: 0.35,
	bgStrokeColor: d.hue,
	bgStrokeAlpha: 0.9,
	bgStrokeWidth: 1.5,
	labelAlpha: 1,
	labelColor,
	labelFontSize: 12,
	labelFontWeight: 700,
});

// Members keep the layer template — a per-node style would REPLACE it and leave
// a floating label with no circle (the model canvas learned this the hard way).
// The only per-model thing a member needs is its hue, which rides on `data`.
const MEMBER_STYLE: ResolvableNodeStyle<GraphNode> = {
	shape: { kind: "circle", radius: 15 },
	bgFill: (n) => (n.data as FrameNodeData | undefined)?.hue ?? 0x9199a1,
	bgStrokeWidth: 2,
	bgStrokeColor: 0x181a1b,
	labelText: (n) => {
		const d = n.data as FrameNodeData | undefined;
		const name = d?.typeName ?? String(n.id);
		return d?.props ? `${name}\n${d.props} props` : name;
	},
	labelColor: 0x9199a1,
	labelFontSize: 12,
	labelPlacement: "bottom",
	labelOffsetY: 4,
};

// A stitch wears the edge token, never a model's hue — it belongs to neither of
// the two models it joins (ST17).
const edgeStyleFor = (closed: boolean): ResolvableEdgeStyle<GraphEdge> => ({
	strokeColor: 0x646b73,
	strokeWidth: 1.5,
	// Closed, a model's own edge type re-routes onto its own tab and prints its
	// name across it — the one thing the constellation is *not* about. Only a
	// stitch is named up here, because only a stitch still goes anywhere (ST15),
	// and up there it wears its **mark** (`≡`, `FOR`): a frame is a tab a few
	// characters wide, and a rule printed across five of them is a rule nobody
	// reads and four names nobody can. Open, it wears the rule itself.
	labelText: (e) => {
		const d = e.data as FrameEdgeData | undefined;
		if (!d) return "";
		if (closed) return d.kind === "edge-type" ? "" : d.short;
		return d.staged ? `${d.label} · staged` : d.label;
	},
	labelColor: 0x9199a1,
	labelFontSize: 10,
});

/**
 * An anchor is dashed: it states that two types are one entity, which is not a
 * traversal and should not be drawn as one. It is a per-edge style rather than a
 * resolver because a resolver has to return *some* dash for every edge, and
 * "no dash" is not a value it can return.
 *
 * Neither sets `labelText`. A per-edge style overrides the template field by
 * field (`GraphLayer.resolveEdgeStyle`), so leaving that one field alone keeps
 * the template's resolver — which is the only thing that knows the altitude.
 */
const STAGED_STYLE: EdgeStyle = {
	strokeColor: 0x2bab5a,
	strokeWidth: 2,
	strokeDashArray: [6, 4],
	labelColor: 0x2bab5a,
	labelFontSize: 10,
};

const ANCHOR_STYLE: EdgeStyle = {
	strokeColor: 0x646b73,
	strokeWidth: 1.5,
	strokeDashArray: [6, 4],
	labelColor: 0x9199a1,
	labelFontSize: 10,
};

/**
 * The theme's text colour, live. `<ThemeBridge>` retints the layer *template*
 * when the theme changes, and a frame's own style replaces that template — so
 * the one colour frames need is read here and rebuilt with the theme (ST33).
 */
function useCanvasForeground(): number {
	const { variantId, isDark } = useTheme();
	const [color, setColor] = useState(readCanvasForeground);
	// biome-ignore lint/correctness/useExhaustiveDependencies: variantId/isDark are trigger-only — the read is of the live DOM tokens, one frame after the class lands
	useEffect(() => {
		const id = requestAnimationFrame(() => setColor(readCanvasForeground()));
		return () => cancelAnimationFrame(id);
	}, [variantId, isDark]);
	return color;
}

function ThemeBridge() {
	const { variantId, isDark } = useTheme();
	const update = useGraphCanvasUpdate();
	// biome-ignore lint/correctness/useExhaustiveDependencies: variantId/isDark are trigger-only — the effect re-reads the live DOM tokens
	useEffect(() => {
		const id = requestAnimationFrame(() => update(readCanvasThemeConfig()));
		return () => cancelAnimationFrame(id);
	}, [variantId, isDark, update]);
	return null;
}

/**
 * Zoom drives altitude (ST15). Crossing the threshold collapses or expands every
 * frame; a person who then opens one frame by hand keeps it open until the next
 * crossing, because a canvas that undoes a deliberate click on the next wheel
 * tick is a canvas nobody trusts.
 *
 * **And again whenever the drawing is rebuilt** (ST31). Collapse is store state,
 * not style, so a new `<GraphLayer data>` reference — which replaces the drawing
 * rather than patching it — takes every frame's collapsed state with it. Without
 * this the constellation silently opened back up on the next data build and
 * altitude looked broken: the zoom said models, the canvas drew types.
 */
function AltitudeBridge({
	frameIds,
	signature,
	onAltitude,
}: {
	frameIds: readonly string[];
	signature: string;
	onAltitude: (closed: boolean) => void;
}) {
	const canvas = useGraphCanvas();
	const { zoom } = useZoom();
	const closed = zoom < ALTITUDE_THRESHOLD;
	const lastRef = useRef<boolean | null>(null);
	const drawingRef = useRef<string | null>(null);

	useEffect(() => {
		const redrawn = drawingRef.current !== signature;
		if (lastRef.current === closed && !redrawn) return;
		lastRef.current = closed;
		drawingRef.current = signature;
		const layer = canvas.layers.get<GraphLayerEngine>(LAYER_ID);
		if (!layer) return;
		for (const id of frameIds) {
			layer.store.setNodeState(id, COLLAPSED_STATE, closed);
		}
		onAltitude(closed);
	}, [closed, signature, frameIds, canvas, onAltitude]);

	return null;
}

/**
 * Runs the registered ELK layout, and owns the camera across a run (ST25).
 *
 * Three reasons to solve, and they want different things from the camera:
 *
 * - **The first draw.** Nobody has framed this landscape yet, so fit it and open
 *   it at the constellation altitude. The clamp is what breaks the loop: a fit
 *   that landed *above* the threshold expanded every frame, which re-ran the
 *   solve, which fit again, which dropped back below it — the camera oscillating
 *   on its own, and any zoom the reader had gone with it.
 * - **An altitude flip.** Collapsing is a *state* change, not a topology one, so
 *   nothing re-runs the solve on its own — without this the frames would close
 *   but keep the spacing they had while open, and a constellation with
 *   model-sized gaps between five tabs reads as a bug. The **zoom is the
 *   reader's** here: it is how they asked for this altitude, so the camera keeps
 *   its scale and only re-centres on the frame they were on, because ELK has
 *   just repacked everything under them.
 * - **A topology change** — a model published, a stitch declared, a refetch that
 *   brought either. Re-framed only while the reader is *at* the landscape
 *   altitude; zoomed into a model, they keep their view and their zoom.
 *
 * Which is why `<ElkLayout fitPadding={null}>`: its own `end → fitContent` fires
 * on *every* solve — including the engine's auto-run when a refetch hands the
 * layer new data — and threw the zoom away each time.
 */
function AllModelsLayout({
	signature,
	closed,
	frameIds,
}: {
	signature: string;
	closed: boolean;
	frameIds: readonly string[];
}) {
	const canvas = useGraphCanvas();
	// The topology this camera has been framed for. A solve that never got to fit
	// — stopped mid-run, or skipped because the reader was inside a model —
	// leaves it behind, so a later one can still catch up.
	const fittedRef = useRef<string | null>(null);
	// Whether the camera has been put at the opening altitude yet.
	const openedRef = useRef(false);
	// The frame the reader was on, read before ELK repacks everything.
	const anchorRef = useRef<string | null>(null);
	// A new array every refetch, and re-framing on a refetch is the bug; the key
	// is what actually changed.
	const frameKey = frameIds.join("|");
	// biome-ignore lint/correctness/useExhaustiveDependencies: signature/closed/frameKey are the triggers; the layout reads the live layer
	useEffect(() => {
		if (!canvas) return;
		if (!openedRef.current) {
			openedRef.current = true;
			// The landscape opens at the landscape altitude (ST24), and this is what
			// says so — `AltitudeBridge` closes every frame off the back of it. Done
			// before the first solve so the fit frames the *constellation* rather
			// than the expanded frames the default zoom would have drawn.
			canvas.camera.setZoom(CONSTELLATION_ZOOM);
		}
		void canvas.runLayout(LAYOUT_ID);
	}, [canvas, signature, closed, frameKey]);

	// Registering a layout stops whatever that id was running, and React
	// re-registers on every remount — so a solve kicked off beside the
	// registration dies with every frame still on the origin. Running off the
	// registration is the trigger that cannot be missed; `<AllModelsLayout>` is
	// mounted before `<ElkLayout>` so this subscription exists when it fires.
	useCanvasEvent("scene:layout:add", (e) => {
		if (e.id !== LAYOUT_ID || !canvas) return;
		void canvas.runLayout(LAYOUT_ID);
	});

	// Positions are still the pre-solve ones here, which is the only moment the
	// frame under the camera can be read.
	useCanvasEvent("layout:run:start", (e) => {
		if (e.id !== LAYOUT_ID || !canvas) return;
		anchorRef.current = frameUnderCamera(canvas, frameIds);
	});

	useCanvasEvent("layout:run:end", (e) => {
		if (e.id !== LAYOUT_ID || e.reason !== "settled" || !canvas) return;
		const layer = canvas.layers.get<GraphLayerEngine>(LAYER_ID);
		const bounds = layer?.getBounds();
		if (!layer || !bounds) return;
		// What this camera has been framed for is the drawing *and* its altitude:
		// closing every frame changes the size of the thing on screen as much as a
		// new model does. Re-framed only while the reader is still at the landscape
		// altitude — zoomed into a model (scale above the threshold) the camera is
		// theirs and is never taken (ST25).
		const fitKey = `${signature}:${closed}`;
		const needsFit =
			fittedRef.current === null ||
			(fittedRef.current !== fitKey &&
				canvas.camera.scale <= CONSTELLATION_ZOOM);
		if (needsFit) {
			// The graph layer's bounds, not `fitView`'s union of every world layer —
			// the dot pattern behind the frames is a world layer too, and framing the
			// union of it and the drawing is how the landscape ended up in a corner.
			canvas.camera.fitContent(bounds, FIT_PADDING);
			if (canvas.camera.scale > CONSTELLATION_ZOOM) {
				canvas.camera.setZoom(CONSTELLATION_ZOOM);
			}
			fittedRef.current = fitKey;
			return;
		}
		// Pan only — `focusNodes` never touches the zoom. At the landscape altitude
		// the whole map is what you are reading, so centre all of it; inside a
		// model, centre the frame you were in.
		if (closed) layer.focusNodes(frameIds);
		else if (anchorRef.current) layer.focusNodes([anchorRef.current]);
	});
	return null;
}

/**
 * The frame nearest the viewport centre — the model the reader is looking at,
 * and so the one to put back under the camera after a repack.
 */
function frameUnderCamera(
	canvas: GraphCanvasEngine,
	frameIds: readonly string[],
): string | null {
	const layer = canvas.layers.get<GraphLayerEngine>(LAYER_ID);
	if (!layer) return null;
	const { camera } = canvas;
	const centre = camera.toWorld(
		camera.screenWidth / 2,
		camera.screenHeight / 2,
	);
	let nearest: string | null = null;
	let best = Number.POSITIVE_INFINITY;
	for (const id of frameIds) {
		const p = layer.store.getPosition(id);
		if (!p) continue;
		const d = (p.x - centre.x) ** 2 + (p.y - centre.y) ** 2;
		if (d < best) {
			best = d;
			nearest = id;
		}
	}
	return nearest;
}

/**
 * Altitude, as a control rather than a readout (ST23).
 *
 * It reports where the camera is and takes it there — dragging the track sets
 * the zoom, which is what flips every frame through `AltitudeBridge`. Zoom stays
 * the natural gesture; this is the one that does not require knowing that.
 *
 * The track is linear in log-zoom because zoom is multiplicative: half the
 * travel between 0.25× and 4× has to be 1×, not 2.1×.
 */
/** Hands `fitContent` out of the canvas context so the palette can call it. */
function FitBridge({
	handoff,
}: {
	handoff: { current: ((padding?: number) => void) | null };
}) {
	const canvas = useGraphCanvas();
	const { fitContent } = useFitContent(LAYER_ID);
	useEffect(() => {
		handoff.current = (p?: number) => {
			fitContent(p ?? FIT_PADDING);
			// "Fit every model in view" is the landscape, so it lands at the
			// landscape altitude. Without the clamp a fit of two small models would
			// overshoot the threshold, expand every frame, and leave the thing it
			// just framed spilling off the canvas.
			if (canvas && canvas.camera.scale > CONSTELLATION_ZOOM) {
				canvas.camera.setZoom(CONSTELLATION_ZOOM);
			}
		};
		return () => {
			handoff.current = null;
		};
	}, [fitContent, handoff, canvas]);
	return null;
}

function AltitudeControl() {
	const { zoom, setZoom } = useZoom();
	const closed = zoom < ALTITUDE_THRESHOLD;
	const toSlider = (z: number) =>
		Math.round(
			((Math.log(Math.min(Math.max(z, MIN_ZOOM), MAX_ZOOM)) -
				Math.log(MIN_ZOOM)) /
				(Math.log(MAX_ZOOM) - Math.log(MIN_ZOOM))) *
				100,
		);
	const fromSlider = (v: number) =>
		Math.exp(
			Math.log(MIN_ZOOM) +
				(v / 100) * (Math.log(MAX_ZOOM) - Math.log(MIN_ZOOM)),
		);

	return (
		<div className="absolute right-3 bottom-3 z-10 flex items-center gap-2.5 rounded-sm border bg-card px-3 py-1.5 text-meta shadow-sm">
			<span className="font-medium text-foreground">Altitude</span>
			<button
				type="button"
				className={
					closed ? "font-medium text-foreground" : "text-muted-foreground"
				}
				onClick={() => setZoom(MIN_ZOOM)}
			>
				Models
			</button>
			<Slider
				className="w-28"
				min={0}
				max={100}
				step={1}
				value={[toSlider(zoom)]}
				onValueChange={(next: number[]) => setZoom(fromSlider(next[0] ?? 0))}
				aria-label="Altitude — models to types"
			/>
			<button
				type="button"
				className={
					closed ? "text-muted-foreground" : "font-medium text-foreground"
				}
				onClick={() => setZoom(TYPES_ZOOM)}
			>
				Types
			</button>
		</div>
	);
}

interface Props {
	username: string;
	graphSlug: string;
	/** Open one model's own canvas — the double-click way out of the constellation. */
	onOpenModel?: (modelId: string) => void;
}

export function AllModelsCanvas({ username, graphSlug, onOpenModel }: Props) {
	const { frames, links, isLoading, isError, error } = useAllModels(
		username,
		graphSlug,
	);
	const commit = useCommitStitchesMutation(username, graphSlug);
	const discard = useDiscardStitchesMutation(username, graphSlug);

	const build = useMemo(
		() => buildAllModelsData(frames, links),
		[frames, links],
	);

	const frameIds = useMemo(
		() => frames.map((t) => frameIdOf(t.modelId)),
		[frames],
	);

	const foreground = useCanvasForeground();
	const [closed, setClosed] = useState(true);
	const onAltitude = useCallback((v: boolean) => setClosed(v), []);

	// `select` drags a frame; `stitch` drags a crossing. They cannot both be on —
	// both behaviours start on node pointer-down.
	const [tool, setTool] = useState<"select" | "stitch">("select");
	const [declaring, setDeclaring] = useState<{
		kind: LinkKind;
		sourceKey: string;
		targetKey: string;
	} | null>(null);
	const [refusal, setRefusal] = useState<string | null>(null);
	const fitRef = useRef<((padding?: number) => void) | null>(null);

	const versionOf = useMemo(() => {
		const out = new Map<string, string | null>();
		for (const f of frames) out.set(f.modelId, f.versionId);
		return out;
	}, [frames]);

	/**
	 * The drag names both ends (ST19). It always returns `null` — the store must
	 * not gain an edge here, because a stitch is a declared row, not a drawing.
	 * The dialog is the same one the Stitches drawer opens (ST11).
	 */
	const createEdge = useCallback(
		(source: string, target: string) => {
			const from = parseMemberId(source);
			const to = parseMemberId(target);
			if (!from || !to) return null;
			if (from.modelId === to.modelId) {
				// Inside one frame this would be an edge type, and this canvas draws
				// published versions — authoring belongs to the model canvas (ME1).
				setRefusal(
					"Both types are in the same model. A stitch crosses a boundary — an edge inside one is that model's own edge type, authored on its draft.",
				);
				return null;
			}
			const sourceVersion = versionOf.get(from.modelId);
			const targetVersion = versionOf.get(to.modelId);
			if (!sourceVersion || !targetVersion) {
				// ST8 — a draft has nothing immutable to bind.
				setRefusal(
					"A stitch binds published versions. One of these models has nothing published yet.",
				);
				return null;
			}
			setRefusal(null);
			setDeclaring({
				kind: "anchor",
				sourceKey: `${sourceVersion}::${from.typeName}`,
				targetKey: `${targetVersion}::${to.typeName}`,
			});
			return null;
		},
		[versionOf],
	);

	const tools: ToolbarItem[] = [
		{
			key: "select",
			type: "toggle",
			icon: MousePointer2,
			label: "Select — drag a frame to move it",
			active: tool === "select",
			onToggle: () => setTool("select"),
		},
		{
			key: "stitch",
			type: "toggle",
			icon: Link2,
			label: "Declare a stitch — drag a type onto a type in another model",
			active: tool === "stitch",
			onToggle: () => setTool("stitch"),
		},
		{ key: "sep", type: "divider" },
		{
			key: "fit",
			type: "button",
			icon: Maximize2,
			label: "Fit every model in view",
			onClick: () => fitRef.current?.(),
		},
	];

	// Every node carries the template except the frames, whose own style is what
	// makes them groups. Built here rather than in the data builder so style stays
	// out of the payload and the builder stays pure.
	const data = useMemo(() => {
		const nodes = build.data.nodes.map((n) =>
			n.type === FRAME_TYPE
				? {
						...n,
						style: frameStyleFor(n, foreground),
						state: {
							collapsed: collapsedFrameStyleFor(
								(n.data ?? {}) as FrameNodeData,
								foreground,
							),
						},
					}
				: n,
		);
		const edges = build.data.edges.map((e) => {
			const d = e.data as FrameEdgeData | undefined;
			// Staged reads differently from committed, on the canvas as in the
			// list (ME5): what is about to land, before what already has.
			if (d?.staged) return { ...e, style: STAGED_STYLE };
			if (e.type === STITCH_ANCHOR) return { ...e, style: ANCHOR_STYLE };
			return e;
		});
		return { nodes, edges };
	}, [build, foreground]);

	const edgeStyle = useMemo(() => edgeStyleFor(closed), [closed]);

	const hasCrossings = build.stitchCount > 0;

	const signature = useMemo(
		() => `${data.nodes.length}:${data.edges.length}`,
		[data],
	);

	if (isError) {
		return (
			<div className="flex h-full w-full items-center justify-center p-6">
				<EmptyState
					icon={<AlertTriangle />}
					title="The models could not be read"
					description={
						error instanceof Error
							? error.message
							: "The engine did not answer for this graph."
					}
				/>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="flex h-full w-full items-center justify-center">
				<Spinner />
			</div>
		);
	}

	if (frames.length === 0) {
		return (
			<div className="flex h-full w-full items-center justify-center p-6">
				<EmptyState
					icon={<Boxes />}
					title="No models yet"
					description="All models draws every model in this Graph. Author one, or import a starter, and it appears here as its own frame."
				/>
			</div>
		);
	}

	return (
		<div className="relative h-full w-full bg-background">
			<GraphCanvas
				autoResize
				config={{ activeLayout: LAYOUT_ID }}
				className="h-full w-full"
			>
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
					node={{ style: MEMBER_STYLE }}
					edge={{ style: edgeStyle }}
				/>
				<ThemeBridge />

				<DragPanBehaviour id="pan" enabled />
				<WheelZoomBehaviour id="wheel" enabled />
				<PinchZoomBehaviour id="pinch" enabled />
				<DragNodeBehaviour id="drag-node" enabled={tool === "select"} />
				<DrawEdgeBehaviour
					id="draw-edge"
					targetLayerId={LAYER_ID}
					enabled={tool === "stitch"}
					createEdge={createEdge}
				/>
				<ClickSelectBehaviour id="click-select" enabled />
				{/* The +/- on a frame's rim — the other way to change altitude, one
				    model at a time rather than all of them. */}
				<CollapseExpandBehaviour id="collapse-expand" enabled />

				<AllModelsLayout
					signature={signature}
					closed={closed}
					frameIds={frameIds}
				/>
				<ElkLayout
					id={LAYOUT_ID}
					targetLayerId={LAYER_ID}
					// The camera belongs to `<AllModelsLayout>` (ST25) — this wrapper's
					// own end-fit ran on every solve and reset the reader's zoom.
					fitPadding={null}
					options={{
						// `layered` earns its keep only when edges cross between
						// frames; with none, every frame lands in one layer and the
						// canvas reads as a column. `rectpacking` fills the viewport
						// instead, which is what a set of unrelated frames wants.
						algorithm: hasCrossings ? "layered" : "rectpacking",
						direction: "RIGHT",
						includeGroups: true,
						nodeSpacing: 72,
						layerSpacing: 120,
						workerFactory: () => new ElkWorker(),
					}}
				/>

				<AltitudeBridge
					frameIds={frameIds}
					signature={signature}
					onAltitude={onAltitude}
				/>
				<AltitudeControl />
				<FitBridge handoff={fitRef} />
			</GraphCanvas>

			{build.stagedCount > 0 ? (
				<div className="-translate-x-1/2 absolute bottom-3 left-1/2 z-10 flex items-center gap-2.5 rounded-sm border bg-card py-1.5 pr-2 pl-3 shadow-sm">
					<span className="size-1.5 rounded-full bg-warning" />
					<span className="text-meta">
						{build.stagedCount} staged{" "}
						<span className="text-muted-foreground">
							· the union is unchanged
						</span>
					</span>
					<Button
						size="xs"
						onClick={() => commit.mutate(undefined as never)}
						disabled={commit.isPending}
					>
						<Check />
						Commit
					</Button>
					<Button
						size="xs"
						variant="ghost"
						onClick={() => discard.mutate(undefined)}
						disabled={discard.isPending}
					>
						Discard
					</Button>
				</div>
			) : null}

			{/* A column, as the artboards draw it — the canvas's own tools stack
			    down the left rim and leave the top of the drawing clear. */}
			<ToolbarItems
				items={tools}
				orientation="vertical"
				className="absolute top-3 left-3 z-10 rounded-sm border bg-card p-1 shadow-sm"
			/>

			{refusal ? (
				<div className="-translate-x-1/2 absolute top-3 left-1/2 z-10 max-w-md rounded-sm border border-destructive/40 bg-card px-3 py-1.5 text-meta shadow-sm">
					<span className="text-destructive">Not a stitch. </span>
					<span className="text-muted-foreground">{refusal}</span>
				</div>
			) : build.unresolvedStitches > 0 ? (
				<UnresolvedBanner count={build.unresolvedStitches} />
			) : null}

			{/* What a commit will open (C6), while there is something to commit.
			    A stitch is its own Ask kind — same step card an answer or an
			    import gets — so the shape of the run is knowable before it runs. */}
			{build.stagedCount > 0 && !declaring ? (
				<ThoughtOnCommit staged={build.stagedCount} />
			) : null}

			{/* Docked, not modal. The gesture that opens it is a drag on the two
			    frames behind it, and a scrim over those frames hides the thing the
			    stitch is about (the *Declaring* artboard, T5). */}
			{declaring ? (
				<div className="absolute top-3 right-3 z-20">
					<DeclareStitchPanel
						key={`${declaring.sourceKey}:${declaring.targetKey}`}
						username={username}
						graphSlug={graphSlug}
						initialKind={declaring.kind}
						sourceKey={declaring.sourceKey}
						targetKey={declaring.targetKey}
						onClose={() => setDeclaring(null)}
					/>
				</div>
			) : null}

			<AllModelsLegend frames={frames} onOpenModel={onOpenModel} />
		</div>
	);
}

/**
 * What each colour and each line means.
 *
 * The **counts** are not here. They live on the Models panel's meta line beside
 * this canvas (the *All models* artboard, T1) — a count in two places is a count
 * that can disagree with itself, and the panel is where a person is already
 * reading "5 models · 6 stitches · active".
 */
function AllModelsLegend({
	frames,
	onOpenModel,
}: {
	frames: readonly ModelFrame[];
	onOpenModel?: (modelId: string) => void;
}) {
	return (
		<>
			<div className="absolute bottom-3 left-3 z-10 max-w-[260px] rounded-sm border bg-card p-2 shadow-sm">
				<Legend orientation="column">
					{frames.map((t, i) => (
						<LegendItem
							key={t.modelId}
							color={hueTokenForIndex(i)}
							label={
								onOpenModel ? (
									<button
										type="button"
										className="truncate hover:underline"
										onClick={() => onOpenModel(t.modelId)}
									>
										{t.name}
									</button>
								) : (
									t.name
								)
							}
							count={
								t.versionId ? (
									t.nodeTypes.length
								) : (
									<span className="text-muted-foreground">not published</span>
								)
							}
						/>
					))}
					{/* What each crossing *is*, in the words the declare card uses:
					    a key on each side (ST26), and endpoints from keys or from a
					    dataset (ST27). */}
					<LegendItem
						kind="dashed"
						label="anchor — a key on each side"
						color="var(--muted-foreground)"
					/>
					<LegendItem
						kind="arrow"
						label="relationship — keys, or a dataset"
						color="var(--muted-foreground)"
					/>
				</Legend>
			</div>
		</>
	);
}

/**
 * What a commit opens — `Ask(kind = stitch)` (C6).
 *
 * The same step card an answer or an import gets, with the same statuses and
 * timings, because a stitch *is* a run: it resolves endpoints and writes edges.
 * What it does not have is a dataset, and saying so here is what stops a person
 * looking for one.
 */
function ThoughtOnCommit({ staged }: { staged: number }) {
	const steps = [
		{ id: "resolve", label: "resolve endpoints" },
		{ id: "write", label: "write edges" },
		{ id: "snapshot", label: "snapshot the union" },
	];
	return (
		<div className="absolute top-3 right-3 z-10 w-[276px] border bg-card shadow-md">
			<div className="flex items-center gap-1.5 border-b px-2.5 py-2">
				<Badge variant="soft" tone="primary" size="xs">
					Ask · stitch
				</Badge>
				<span className="flex-1" />
				<span className="text-meta text-muted-foreground">on commit</span>
			</div>
			<p className="px-2.5 py-2 text-meta text-muted-foreground">
				A commit opens <span className="font-mono">Ask(kind = stitch)</span> —
				the same step card an answer or an import gets, with the same statuses
				and timings. A stitch writes edges with no dataset in the picture.
			</p>
			<div className="border-t">
				{steps.map((step) => (
					<div
						key={step.id}
						className="flex items-center gap-2 px-2.5 py-1.5 text-meta"
					>
						<span className="size-1.5 rounded-full bg-muted-foreground" />
						<span className="flex-1">{step.label}</span>
						<span className="font-mono text-muted-foreground">queued</span>
					</div>
				))}
			</div>
			<div className="border-t px-2.5 py-1.5 text-meta text-muted-foreground">
				{staged} staged · nothing runs until you commit
			</div>
		</div>
	);
}

/**
 * A stitch binding a version this canvas is not drawing.
 *
 * Not a stitch that vanished — one whose version needs reviewing (ST16). It sits
 * across the top of the drawing rather than in a corner because it is a thing to
 * *do*, and the models it is about are right underneath it.
 */
function UnresolvedBanner({
	count,
	onReview,
}: {
	count: number;
	onReview?: () => void;
}) {
	return (
		<div className="-translate-x-1/2 absolute top-3 left-1/2 z-10 flex items-center gap-2 border border-warning/35 bg-warning/10 px-3 py-1.5 text-meta shadow-sm">
			<span className="size-1.5 rounded-full bg-warning" />
			<span>
				A published version moved on —{" "}
				<span className="font-mono">
					{count} {count === 1 ? "stitch" : "stitches"} still bind an older one
				</span>
			</span>
			{onReview ? (
				<Button size="xs" variant="outline" onClick={onReview}>
					Review them
				</Button>
			) : null}
		</div>
	);
}
