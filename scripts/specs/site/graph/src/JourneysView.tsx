/**
 * The Journeys view: every journey's diagram as one graph — stories and the journeys' own steps, joined by `NEXT`.
 *
 * | Region | What |
 * |---|---|
 * | Left | `TreeFilterPanel` — Product → Feature → Story, and the Journeys; unticking hides, and a dashed bridge of the same journey colour joins what is left either side |
 * | Header | The view switch, *Group by*, the camera controls, the theme |
 * | Canvas | One lane per journey, read left to right from its start (`journeyLanes`); a story wears its product's colour, an edge its journey's, a step its shape. Up close a story reads `id · title` and a step its name; an arrow's label shows on hover and on a selection. `CanvasLegend` sits folded bottom-left, counting what is shown |
 * | Footer | The status bar and the message bar (how much is shown, what is lit) |
 *
 * *Group by* (capability · feature · persona · journey, kept in the address as `?group=`) draws a soft hull around the
 * stories of each group (`journeyGroups`), coloured and labelled like its legend entry. A story in several groups
 * sits in each hull; a story the tree hides leaves its hull; the lanes stay as they are.
 *
 * Selecting a journey in the tree lights its whole path; selecting a story — in the tree or on the canvas — lights
 * every journey it is on; a product or feature lights its stories. Selecting it again clears it.
 *
 * The lanes are a small layout of the site's own, not ELK: layered ELK has no lanes, and its partitioning only orders
 * layers, so it cannot keep a journey in a band. `journeyLanes` is linear in nodes and edges; ELK stays in the header's
 * picker as the alternative.
 */
import type { CanvasConfig, CanvasTelemetryConfig } from "@invana/canvas";
import {
	CanvasLegend,
	CanvasMessageBar,
	GraphCanvasApp,
	GraphControlsToolbar,
	GraphStatusBar,
	hiddenNodeIds,
	type ToolbarItem,
	ToolbarItems,
	type TreeFilterItem,
	TreeFilterPanel,
} from "@invana/canvas-ui";
import {
	ClickInspectBehaviour,
	EdgeLabelLODBehaviour,
	FocusBehaviour,
	type GraphCanvas,
	type GraphLayer,
	LabelCollisionBehaviour,
	type LayoutPositions,
	type LayoutSubgraph,
	NodeLabelLODBehaviour,
	type SubgraphLayoutOptions,
	SubgraphPositionLayout,
	ZoomStateBehaviour,
} from "@invana/graph";
import { BubbleSetsLayer } from "@invana/graph-layer-bubble-sets";
import { ElkLayout } from "@invana/graph-layout-elkjs";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@invana/ui";
import { Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	DETAIL,
	filterGroups,
	GROUP_BY,
	type GroupBy,
	groupByOf,
	highlightOf,
	type JourneyLanes,
	journeyGroups,
	journeyLanes,
	journeyView,
	toJourneyData,
} from "./journeys";
import type { GraphIndex } from "./model";
import { addressParam, setAddressParam } from "./nav";
import { readPalette } from "./palette";

const IDS = {
	graph: "graph",
	lanes: "journeys-lanes",
	elk: "journeys-elk",
	focus: "journeys-focus",
	inspect: "journeys-inspect",
	detail: "journeys-detail",
	nodeLabels: "journeys-node-labels",
	edgeLabels: "journeys-edge-labels",
	collision: "journeys-label-collision",
	groups: "groups",
} as const;

const CONFIG: CanvasConfig = {
	activeLayout: "",
	fitOnLoad: false,
	behaviours: {
		// Each node carries its product's or its step's colour; nothing else may repaint it.
		color: { enabled: false },
		// An edge under the pointer lights too, and with it its label.
		hover: {
			enabled: true,
			state: "highlighted",
			degree: 1,
			hoverEdges: true,
			excludeNodeTypes: ["Lane"],
		},
	},
	layers: {
		background: { type: "pattern", patternType: "dots", alpha: 0.5 },
	},
};

/** The lanes, as a layout: it places each node where `journeyLanes` put it, so *Run* restores them. */
class LaneLayout extends SubgraphPositionLayout {
	override readonly kind = "journey-lanes";
	constructor(
		opts: SubgraphLayoutOptions,
		private readonly lanes: JourneyLanes,
	) {
		super(opts);
	}
	protected computeSubgraphLayout(sub: LayoutSubgraph): LayoutPositions {
		const ids = [...sub.ids];
		const positions = new Float32Array(ids.length * 2);
		ids.forEach((id, i) => {
			const p = this.lanes.positions.get(id) ?? sub.getPosition(id);
			positions[i * 2] = p?.x ?? 0;
			positions[i * 2 + 1] = p?.y ?? 0;
		});
		return { ids, positions };
	}
}

/** ELK layered, left to right — the picker's alternative to the lanes. */
const layered = () =>
	new ElkLayout({
		id: IDS.elk,
		targetLayerId: IDS.graph,
		algorithm: "layered",
		direction: "RIGHT",
		nodeSpacing: 18,
		layerSpacing: 70,
	});
const LAYOUT_LABEL = {
	[IDS.lanes]: "Journey lanes",
	[IDS.elk]: "Layered (ELK)",
};

const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

export function JourneysView({
	index,
	telemetry,
	viewSwitch,
}: {
	index: GraphIndex;
	telemetry: CanvasTelemetryConfig | undefined;
	/** The header's view switch. */
	viewSwitch: ToolbarItem;
}) {
	const view = useMemo(() => journeyView(index), [index]);
	const palette = useMemo(() => readPalette(), []);
	const lanes = useMemo(() => journeyLanes(view), [view]);
	const data = useMemo(
		() => toJourneyData(index, view, palette, lanes),
		[index, view, palette, lanes],
	);
	const layouts = useMemo(
		() => ({
			[IDS.lanes]: () =>
				new LaneLayout({ id: IDS.lanes, targetLayerId: IDS.graph }, lanes),
			[IDS.elk]: layered,
		}),
		[lanes],
	);
	const groups = useMemo(() => filterGroups(index, view), [index, view]);
	const [canvas, setCanvas] = useState<GraphCanvas | null>(null);
	const [hidden, setHidden] = useState<Set<string>>(() => new Set());
	const [groupBy, setGroupBy] = useState<GroupBy>(() =>
		groupByOf(addressParam("group")),
	);
	const hulls = useMemo(
		() => journeyGroups(index, view, groupBy, hiddenNodeIds(groups, hidden)),
		[index, view, groupBy, groups, hidden],
	);
	const [hullLayer, setHullLayer] = useState<BubbleSetsLayer | null>(null);
	const [selected, setSelected] = useState<{
		id: string;
		label: string;
		ids: string[];
	} | null>(null);

	const select = useCallback(
		(item: TreeFilterItem | null) => {
			if (!item) return setSelected(null);
			const leaves = (function walk(i: TreeFilterItem): string[] {
				return i.children?.length ? i.children.flatMap(walk) : [i.id];
			})(item);
			setSelected({
				id: item.id,
				label: item.label,
				ids: highlightOf(view, item.id, leaves),
			});
		},
		[view],
	);
	const selectRef = useRef(select);
	selectRef.current = select;

	const onReady = useCallback(
		(c: GraphCanvas | null) => {
			setCanvas(c);
			// The end-to-end specs read what is drawn — positions and layers — from the live canvas.
			window.specGraphCanvas = c ?? undefined;
			if (!c) {
				setHullLayer(null);
				return;
			}
			// Group by's hulls, under the graph; recomputed after every layout run.
			const hullsLayer = new BubbleSetsLayer({
				id: IDS.groups,
				zIndex: -1,
				hittable: false,
				options: { graphLayerId: IDS.graph, sets: [], smoothness: "chaikin" },
			});
			c.layers.add(hullsLayer);
			setHullLayer(hullsLayer);
			c.behaviours.register(
				new FocusBehaviour({
					id: IDS.focus,
					targetLayerId: IDS.graph,
					frame: false,
					enabled: true,
				}),
			);
			const inspect = new ClickInspectBehaviour({
				id: IDS.inspect,
				targetLayerId: IDS.graph,
				enabled: true,
			});
			c.behaviours.register(inspect);
			// A story clicked on the canvas lights every journey it is on.
			inspect.events.on("inspect:change", (t) => {
				if (t?.kind !== "node" || !view.storyJourneys.has(t.id)) return;
				const n = index.nodes.get(t.id);
				selectRef.current({ id: t.id, label: `${t.id} · ${n?.title ?? ""}` });
			});
			// Up close every node wears `detail`: a story's title, a step's name.
			c.behaviours.register(
				new ZoomStateBehaviour({
					id: IDS.detail,
					targetLayerId: IDS.graph,
					minZoom: DETAIL.minZoom,
					state: DETAIL.state,
					enabled: true,
				}),
			);
			// Labels hold a readable size on screen at any zoom.
			c.behaviours.register(
				new NodeLabelLODBehaviour({
					id: IDS.nodeLabels,
					targetLayerId: IDS.graph,
					minFontPx: 10,
					maxFontPx: 12,
					enabled: true,
				}),
			);
			c.behaviours.register(
				new EdgeLabelLODBehaviour({
					id: IDS.edgeLabels,
					targetLayerId: IDS.graph,
					minFontPx: 9,
					maxFontPx: 11,
					enabled: true,
				}),
			);
			// Where lit labels crowd, the first keeps its place and the rest wait for a closer zoom.
			c.behaviours.register(
				new LabelCollisionBehaviour({
					id: IDS.collision,
					targetLayerId: IDS.graph,
					enabled: true,
				}),
			);
			c.layouts.add(layouts[IDS.lanes]());
			// An un-animated layout leaves the viewport blank until the layer redraws.
			c.events.on("layout:run:end", ({ reason }) => {
				c.layers.get<GraphLayer>(IDS.graph)?.redraw();
				hullsLayer.recompute();
				// The fit control's padding, so labels past the outer nodes stay on screen.
				if (reason === "settled") requestAnimationFrame(() => c.fitView(80));
			});
			c.update({ activeLayout: IDS.lanes });
		},
		[index, view, layouts],
	);

	useEffect(() => {
		const focus = canvas?.store.actions.focus;
		if (!canvas || !focus) return;
		if (selected) focus.set(selected.ids, true);
		else focus.clear();
	}, [canvas, selected]);

	useEffect(() => {
		hullLayer?.setSets(
			hulls.map((g) => ({
				id: g.id,
				members: g.members,
				style: { fill: palette.data(g.slot), stroke: palette.data(g.slot) },
				label: { text: g.label, placement: "centroid" },
			})),
		);
	}, [hullLayer, hulls, palette]);

	const chooseGroupBy = useCallback((by: GroupBy) => {
		setGroupBy(by);
		setAddressParam("group", by === "none" ? null : by);
	}, []);

	const storyTotal = view.storyJourneys.size;
	const journeysOn = view.journeys.filter((j) => !hidden.has(j.id)).length;
	const storiesOff = [...view.storyJourneys.keys()].filter((s) =>
		hidden.has(s),
	).length;
	useEffect(() => {
		canvas?.showMessage(
			selected
				? `${selected.label} · ${selected.ids.length} lit`
				: `${storyTotal - storiesOff} of ${storyTotal} stories · ${journeysOn} of ${view.journeys.length} journeys`,
		);
	}, [canvas, selected, storyTotal, storiesOff, journeysOn, view]);

	return (
		<ResizablePanelGroup orientation="horizontal" className="h-full">
			<ResizablePanel defaultSize="320px" minSize="220px" maxSize="560px">
				<TreeFilterPanel
					canvas={canvas}
					groups={groups}
					hidden={hidden}
					onHiddenChange={setHidden}
					selectedId={selected?.id ?? null}
					onSelect={select}
					defaultExpanded={groups[0]?.items.map((i) => i.id)}
					title="Journeys filter"
				/>
			</ResizablePanel>
			<ResizableHandle />
			<ResizablePanel>
				<GraphCanvasApp
					data={data}
					config={CONFIG}
					instanceKey="journeys"
					onReady={onReady}
					telemetry={telemetry}
					header={{
						title: "Invana journeys",
						center: (
							<GraphControlsToolbar
								layouts={layouts}
								layoutLabel={LAYOUT_LABEL}
							/>
						),
						right: (ctx) => (
							<ToolbarItems
								orientation="horizontal"
								items={[
									viewSwitch,
									{
										type: "select",
										key: "group-by",
										label: "Group by",
										value: groupBy,
										options: GROUP_BY,
										onChange: (v) => chooseGroupBy(groupByOf(v)),
									},
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
				>
					<CanvasLegend
						position="bottom-left"
						defaultCollapsed
						sections={[
							{
								element: "node",
								title: "Kinds",
								groupBy: (n) =>
									n.type === "Step"
										? `Step · ${(n.data as { shape?: string }).shape ?? "step"}`
										: n.type,
								entries: [
									{ value: "Story", kind: "dot" },
									{ value: "Step · step", label: "Step", kind: "box" },
									{
										value: "Step · decision",
										label: "Decision",
										kind: "outline",
									},
									{
										value: "Step · terminal",
										label: "Start or end",
										kind: "ring",
									},
								],
							},
							{
								element: "node",
								title: "Products",
								groupBy: (n) =>
									n.type === "Story"
										? (n.data as { product?: string }).product
										: undefined,
								entries: view.products.map((p) => ({
									value: p,
									label: index.nodes.get(p)?.title ?? p,
									color: hex(palette.data(view.slots.get(p) ?? 0)),
								})),
							},
							{
								element: "edge",
								title: "Journeys",
								groupBy: (e) => (e.data as { journey?: string }).journey,
								entries: view.journeys.map((j) => ({
									value: j.id,
									label: `${j.id} · ${j.title}`,
									color: hex(palette.data(view.slots.get(j.id) ?? 0)),
								})),
							},
						]}
						marks={[
							...(hulls.length
								? [
										{
											title: `Groups · ${GROUP_BY[groupBy]}`,
											entries: hulls.map((g) => ({
												label: g.label,
												color: hex(palette.data(g.slot)),
												kind: "bracket" as const,
											})),
										},
									]
								: []),
							{
								title: "Marks",
								entries: [
									{
										kind: "dashed",
										color: hex(palette.muted),
										label: "Bridged across hidden steps",
									},
								],
							},
						]}
					/>
				</GraphCanvasApp>
			</ResizablePanel>
		</ResizablePanelGroup>
	);
}
