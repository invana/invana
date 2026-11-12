/**
 * The spec graph page: `specs-graph.json` on `@invana/canvas`, with canvas-ui's own chrome.
 *
 * | Region | What |
 * |---|---|
 * | Header | The camera and select controls (`GraphControlsToolbar`), the layout picker, the side-panel toggles, the minimap and the theme |
 * | Right | One side panel at a time: Filters (kind · status · persona · product), Find, Legend, Element |
 * | Footer | The status bar and the message bar (what is shown, and the focused node) |
 *
 * It is the *Spec graph* view; the page opens on the *Journeys* view (`JourneysView`) unless `?focus=` or
 * `?view=spec` asks for this one, and the header's *View* switches between them.
 *
 * A click on a node shows it in the Element panel, whose *Open spec page* opens the page it is read from; a
 * double-click, or *Open spec page* on its right-click menu, opens it straight away. `?focus=<id>` — the site's
 * *Show in graph* link — frames and selects that node once the layout settles.
 *
 * Each layout remounts the canvas (`instanceKey`): the hierarchy layout draws a different edge set (the containment
 * tree), and a fresh engine never runs a layout over the wrong one.
 */
import type { CanvasConfig, CanvasTelemetryConfig } from "@invana/canvas";
import {
	CanvasMessageBar,
	ElementViewPanel,
	FindInCanvasViewPanel,
	GraphCanvasApp,
	GraphControlsToolbar,
	GraphNodeContextMenu,
	GraphStatusBar,
	LegendViewPanel,
	MiniMapToggleButton,
	type ToolbarItem,
	ToolbarItems,
	typeColor,
	useSidePanels,
} from "@invana/canvas-ui";
import {
	ClickInspectBehaviour,
	type ClickSelectBehaviour,
	type GraphCanvas,
	type GraphLayer,
} from "@invana/graph";
import { D3HierarchyLayout } from "@invana/graph-layout-d3-hierarchy";
import { D3SankeyLayout } from "@invana/graph-layout-d3-sankey";
import { ElkLayout } from "@invana/graph-layout-elkjs";
import { GeometricLayout } from "@invana/graph-layout-geometric";
import { Button, EmptyState } from "@invana/ui";
import {
	ExternalLink,
	Filter,
	Flag,
	Info,
	List,
	Moon,
	Radiation,
	Route,
	Search,
	Sun,
	Waves,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnalysisPanel, type Highlight } from "./AnalysisPanel";
import { FiltersPanel } from "./FiltersPanel";
import { JourneysView } from "./JourneysView";
import {
	defaultFilters,
	type Filters,
	type GraphIndex,
	indexGraph,
	LAYOUTS,
	type LayoutId,
	pageUrl,
	type SpecGraph,
	toGraphData,
} from "./model";
import { initialFocus, initialView, openPage, type ViewId } from "./nav";
import { installOverlays, type Overlays } from "./overlays";
import { readPalette } from "./palette";
import { pageTelemetry } from "./telemetry";
import {
	blastRadius,
	loopSets,
	productSets,
	readAnalysis,
	shortestPath,
	unreadyIds,
} from "./thinking";

declare global {
	interface Window {
		/** The live canvas of the view shown, for the end-to-end specs; unset while none is mounted. */
		specGraphCanvas?: GraphCanvas;
	}
}

/** The groups the bubble-sets layer can draw. */
const GROUPS = {
	none: "No groups",
	product: "Group by product",
	loop: "Group by loop",
} as const;
type GroupBy = keyof typeof GROUPS;

/** The canvas ids this page registers beside the app bundle's. */
const IDS = {
	graph: "graph",
	inspect: "click-inspect",
	select: "click-select",
	force: "graph-force",
} as const;

/** The one-shot layouts, registered by id when the canvas is ready; force is the bundle's own. */
const ONE_SHOT: Partial<
	Record<
		LayoutId,
		() => ElkLayout | D3HierarchyLayout | GeometricLayout | D3SankeyLayout
	>
> = {
	sankey: () =>
		new D3SankeyLayout({
			id: "sankey",
			targetLayerId: IDS.graph,
			size: [1600, 2400],
			nodeWidth: 14,
			nodePadding: 4,
			nodeAlign: "left",
		}),
	elk: () =>
		new ElkLayout({
			id: "elk",
			targetLayerId: IDS.graph,
			algorithm: "layered",
			direction: "RIGHT",
			nodeSpacing: 16,
			layerSpacing: 90,
		}),
	hierarchy: () =>
		new D3HierarchyLayout({
			id: "hierarchy",
			targetLayerId: IDS.graph,
			mode: "radial-tree",
			radius: 900,
		}),
	radial: () =>
		new GeometricLayout({
			id: "radial",
			targetLayerId: IDS.graph,
			mode: "circular",
			nodeSpacing: 26,
		}),
};

/**
 * Loads the parse and draws it; says so when it cannot. The canvas reads its telemetry once, at start, so it waits
 * for the collector probe as well as the parse (the probe gives up within 1.5 s).
 */
export function App() {
	const [graph, setGraph] = useState<SpecGraph | null>(null);
	const [telemetry, setTelemetry] = useState<
		CanvasTelemetryConfig | undefined | null
	>(null);
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		fetch("specs-graph.json")
			.then((r) =>
				r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)),
			)
			.then((g: SpecGraph) => setGraph(g))
			.catch((e: Error) => setError(e.message));
		pageTelemetry().then(setTelemetry);
	}, []);
	const index = useMemo(() => (graph ? indexGraph(graph) : null), [graph]);
	if (error)
		return (
			<EmptyState
				title="The spec graph did not load"
				description={`specs-graph.json: ${error}. Build the site, or run check.py --graph for the dev server.`}
			/>
		);
	if (!index || telemetry === null)
		return <EmptyState title="Loading the spec graph…" />;
	return <Views index={index} telemetry={telemetry} />;
}

/** The two views, one at a time; each remounts its canvas when switched to. */
function Views({
	index,
	telemetry,
}: {
	index: GraphIndex;
	telemetry: CanvasTelemetryConfig | undefined;
}) {
	const [view, setView] = useState<ViewId>(() => initialView());
	const viewSwitch: ToolbarItem = {
		type: "select",
		key: "view",
		label: "View",
		value: view,
		options: VIEWS,
		onChange: (v) => setView(v as ViewId),
	};
	return view === "journeys" ? (
		<JourneysView index={index} telemetry={telemetry} viewSwitch={viewSwitch} />
	) : (
		<GraphView index={index} telemetry={telemetry} viewSwitch={viewSwitch} />
	);
}

/** The views the header switches between. */
const VIEWS: Record<ViewId, string> = {
	journeys: "Journeys",
	spec: "Spec graph",
};

function GraphView({
	index,
	telemetry,
	viewSwitch,
}: {
	index: GraphIndex;
	telemetry: CanvasTelemetryConfig | undefined;
	viewSwitch: ToolbarItem;
}) {
	const analysis = useMemo(() => readAnalysis(index.graph.analysis), [index]);
	const [groups, setGroups] = useState<GroupBy>("none");
	const [contour, setContour] = useState(false);
	const [highlight, setHighlight] = useState<Highlight | null>(null);
	const [pathStart, setPathStart] = useState<string | null>(null);
	const [overlays, setOverlays] = useState<Overlays | null>(null);
	const focus = useMemo(() => {
		const id = initialFocus();
		return id && index.nodes.has(id) ? id : null;
	}, [index]);
	const [layout, setLayout] = useState<LayoutId>("force");
	const [filters, setFilters] = useState<Filters>(() =>
		defaultFilters(index, focus),
	);
	const [canvas, setCanvas] = useState<GraphCanvas | null>(null);
	const palette = useMemo(() => readPalette(), []);
	const data = useMemo(
		() => toGraphData(index, filters, layout, palette),
		[index, filters, layout, palette],
	);

	const urlOf = useCallback(
		(id: string) => pageUrl(index.nodes.get(id)?.path ?? null),
		[index],
	);

	const dock = useSidePanels(
		[
			{
				id: "filters",
				icon: Filter,
				label: "Filters",
				render: () => (
					<FiltersPanel index={index} filters={filters} onChange={setFilters} />
				),
			},
			{
				id: "analysis",
				icon: Flag,
				label: "Analysis",
				render: () => (
					<AnalysisPanel
						analysis={analysis}
						highlight={highlight}
						onHighlight={setHighlight}
					/>
				),
			},
			{
				id: "find",
				icon: Search,
				label: "Find",
				render: (c) => <FindInCanvasViewPanel canvas={c} focusZoom={1.5} />,
			},
			{
				id: "legend",
				icon: List,
				label: "Legend",
				render: (c) => (
					<LegendViewPanel canvas={c} colorForType={legendColour} toggleTypes />
				),
			},
			{
				id: "element",
				icon: Info,
				label: "Element",
				render: (c) => (
					<ElementViewPanel
						canvas={c}
						focusZoom={1.5}
						footer={(element, kind) => {
							const url = kind === "node" ? urlOf(element.id) : null;
							return url === null ? null : (
								<Button size="sm" onClick={() => openPage(url)}>
									<ExternalLink />
									Open spec page
								</Button>
							);
						}}
					/>
				),
			},
		],
		{
			defaultOpenId: "filters",
			section: { defaultSize: "340px", maxSize: "460px" },
		},
	);
	const openDock = useRef(dock.open);
	openDock.current = dock.open;

	const config: CanvasConfig = useMemo(
		() => ({
			activeLayout: layout === "force" ? IDS.force : "",
			// A focused node frames itself; the load-time fit would frame everything over it.
			fitOnLoad: !focus,
			behaviours: {
				// Each node carries its kind's colour; nothing else may repaint it.
				color: { enabled: false },
				hover: { enabled: true, state: "highlighted", degree: 1 },
				// A flow's columns are the picture; a dragged node would only break its ribbons.
				"drag-node": { enabled: layout !== "sankey" },
			},
			layers: {
				background: { type: "pattern", patternType: "dots", alpha: 0.5 },
			},
			layouts: {
				[IDS.force]: {
					charge: { strength: -220 },
					link: {},
					collide: {},
					animate: false,
				},
			},
		}),
		[layout, focus],
	);

	// The focused node is framed once, after the first settled layout.
	const focused = useRef(false);
	const onReady = useCallback(
		(c: GraphCanvas | null) => {
			setCanvas(c);
			// The end-to-end specs read what is drawn — positions and layers — from the live canvas.
			window.specGraphCanvas = c ?? undefined;
			if (!c) {
				setOverlays(null);
				return;
			}
			const over = installOverlays(c, IDS.graph);
			setOverlays(over);
			const inspect = new ClickInspectBehaviour({
				id: IDS.inspect,
				targetLayerId: IDS.graph,
				enabled: true,
			});
			c.behaviours.register(inspect);
			inspect.events.on("inspect:change", (t) => {
				if (t?.kind === "node") openDock.current("element");
			});
			const make = ONE_SHOT[layout];
			if (make) {
				c.layouts.add(make());
				c.update({ activeLayout: layout });
			}
			c.events.on("layout:run:end", ({ reason }) => {
				const layer = c.layers.get(IDS.graph) as GraphLayer | undefined;
				layer?.redraw();
				over.syncPositions();
				if (reason !== "settled") return;
				// Every settled run is framed — a one-shot layout runs after the load-time fit — unless a focus is due.
				if (!focus || focused.current) {
					requestAnimationFrame(() => c.fitView(40));
					return;
				}
				focused.current = true;
				// A frame later, so the camera moves after the run's own last paint.
				requestAnimationFrame(() => {
					layer?.focusNode(focus, { zoom: 1.5 });
					c.behaviours
						.get<ClickSelectBehaviour>(IDS.select)
						?.select(focus, "shape");
					inspect.setTarget({ kind: "node", id: focus });
					c.showMessage(`Focused on ${focus}`);
				});
			});
		},
		[layout, focus],
	);

	// A double-click on a node opens its page: the first click of the pair has already inspected it.
	useEffect(() => {
		if (!canvas) return;
		const onDouble = (e: MouseEvent) => {
			if (!(e.target instanceof HTMLCanvasElement)) return;
			const t = canvas.behaviours
				.get<ClickInspectBehaviour>(IDS.inspect)
				?.getTarget();
			const url = t?.kind === "node" ? urlOf(t.id) : null;
			if (url !== null) openPage(url);
		};
		document.addEventListener("dblclick", onDouble);
		return () => document.removeEventListener("dblclick", onDouble);
	}, [canvas, urlOf]);

	useEffect(() => {
		canvas?.showMessage(
			`${data.nodes.length} of ${index.graph.nodes.length} nodes · ${data.edges.length} edges`,
		);
	}, [canvas, data, index]);

	/** The ids drawn now. */
	const shown = useMemo(() => new Set(data.nodes.map((n) => n.id)), [data]);

	useEffect(() => {
		overlays?.setGroups(
			groups === "product"
				? productSets(index, shown)
				: groups === "loop"
					? loopSets(analysis, shown)
					: [],
			palette.type,
		);
	}, [overlays, groups, index, analysis, shown, palette]);

	useEffect(() => {
		overlays?.setUnready(unreadyIds(index, shown));
	}, [overlays, index, shown]);

	useEffect(() => {
		overlays?.setContour(contour, [palette.muted, palette.alert]);
	}, [overlays, contour, palette]);

	// Only what is drawn can be emphasised; the message says how much of the highlight the filters hide.
	useEffect(() => {
		if (!overlays) return;
		if (!highlight) {
			overlays.highlight(null);
			return;
		}
		const on = highlight.ids.filter((id) => shown.has(id));
		overlays.highlight(on);
		const hidden = new Set(highlight.ids).size - on.length;
		canvas?.showMessage(
			`${highlight.label} · ${on.length} shown${hidden ? ` · ${hidden} hidden by filters` : ""}`,
		);
	}, [overlays, highlight, shown, canvas]);

	const showBlast = useCallback(
		(id: string) => {
			const reach = blastRadius(index, id);
			setHighlight({
				label: `Blast radius of ${id} · ${reach.size - 1} reached`,
				ids: [...reach.keys()],
			});
		},
		[index],
	);

	const showPath = useCallback(
		(from: string, to: string) => {
			setPathStart(null);
			const path = shortestPath(index, from, to, shown);
			if (!path) {
				setHighlight(null);
				canvas?.showMessage(`No path from ${from} to ${to} in this view`);
				return;
			}
			setHighlight({
				label: `Path ${path.nodes.join(" → ")}`,
				ids: path.nodes,
			});
		},
		[index, shown, canvas],
	);

	return (
		<GraphCanvasApp
			data={data}
			config={config}
			instanceKey={layout}
			onReady={onReady}
			telemetry={telemetry}
			header={{
				title: "Invana specs graph",
				// The page's own Layout select picks the layout; the toolbar's would only name its default force.
				center: <GraphControlsToolbar sections={{ layout: false }} />,
				right: (ctx) => (
					<>
						<ToolbarItems
							orientation="horizontal"
							items={[
								viewSwitch,
								{
									type: "select",
									key: "layout",
									label: "Layout",
									value: layout,
									options: LAYOUTS,
									onChange: (v) => {
										focused.current = false;
										setLayout(v as LayoutId);
									},
								},
								{
									type: "select",
									key: "groups",
									label: "Groups",
									value: groups,
									options: GROUPS,
									onChange: (v) => setGroups(v as GroupBy),
								},
								{
									type: "toggle",
									key: "contour",
									icon: Waves,
									label: "Show where idea and placeholder nodes crowd",
									activeLabel: "Hide the unready density",
									active: contour,
									onToggle: () => setContour((on) => !on),
								},
								...dock.items,
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
						<MiniMapToggleButton defaultOn backgroundLayerId="background" />
					</>
				),
			}}
			footer={{ left: <GraphStatusBar />, right: <CanvasMessageBar /> }}
			right={dock.region}
		>
			<GraphNodeContextMenu
				items={({ id }) => {
					const url = urlOf(id);
					return [
						{
							id: "open",
							label: "Open spec page",
							icon: ExternalLink,
							disabled: url === null,
							onClick: () => url !== null && openPage(url),
						},
						{
							id: "blast",
							label: "Blast radius",
							icon: Radiation,
							onClick: () => {
								showBlast(id);
								dock.open("analysis");
							},
						},
						pathStart === null || pathStart === id
							? {
									id: "path-from",
									label: "Path from here…",
									icon: Route,
									onClick: () => {
										setPathStart(id);
										canvas?.showMessage(
											`Path from ${id} — right-click another node for Path to here`,
										);
									},
								}
							: {
									id: "path-to",
									label: `Path from ${pathStart} to here`,
									icon: Route,
									onClick: () => {
										showPath(pathStart, id);
										dock.open("analysis");
									},
								},
					];
				}}
			/>
		</GraphCanvasApp>
	);
}

/** The legend's swatch for a type — the same token colour the canvas paints it. */
function legendColour(type: string): string {
	return `#${typeColor(type).toString(16).padStart(6, "0")}`;
}
