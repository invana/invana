/**
 * The graph-thinking overlays, configured from released canvas packages onto a live `GraphCanvas`.
 *
 * | Overlay | Canvas piece | What it draws |
 * |---|---|---|
 * | Highlight | `FocusBehaviour` over `store.actions.focus` | A blast radius, a path, a loop or a gap list: those nodes emphasised, the rest dimmed, framed |
 * | Groups | `BubbleSetsLayer` | A hull around each product's nodes, or around each loop's |
 * | Unready density | `DensityContourFillLayer` | Bands where `idea` and placeholder nodes crowd |
 *
 * The contour layer weighs every node of the graph layer it reads, and has no filter. So it reads a second, hidden
 * `GraphLayer` that holds only the unready nodes, at the positions the main layer's layout gave them — copied after
 * every layout run ({@link Overlays.syncPositions}).
 *
 * ```ts
 * const overlays = installOverlays(canvas, "graph");
 * overlays.setGroups(productSets(index, ids), colourOf);
 * overlays.setUnready(unreadyIds(index, ids));
 * overlays.setContour(true);
 * overlays.highlight(["MO-F01", "MO-01"]);
 * ```
 */

import { FocusBehaviour, type GraphCanvas, GraphLayer } from "@invana/graph";
import {
	type BubbleSet,
	BubbleSetsLayer,
} from "@invana/graph-layer-bubble-sets";
import { DensityContourFillLayer } from "@invana/graph-layer-d3-contour";
import type { NodeSet } from "./thinking";

const IDS = {
	focus: "highlight",
	groups: "groups",
	unready: "unready",
	density: "unready-density",
} as const;

/** The node type of the hidden unready layer; every node of it is drawn hidden. */
const UNREADY_TYPE = "Unready";

export interface Overlays {
	/** Emphasise `ids`, dim the rest and frame them; `null` clears. */
	highlight(ids: Iterable<string> | null): void;
	/** Draw a hull around each set; an empty list draws none. */
	setGroups(sets: NodeSet[], colour: (setId: string) => number): void;
	/** The nodes the density contour weighs. */
	setUnready(ids: string[]): void;
	/** Show or hide the density contour, its bands ramped from `range[0]` (sparse) to `range[1]` (dense). */
	setContour(on: boolean, range: [number, number]): void;
	/** Copy the unready nodes' positions from the main layer and recompute the overlays that follow them. */
	syncPositions(): void;
}

/** Register the overlays on `canvas`, over the graph layer `graphLayerId`. Call once per canvas. */
export function installOverlays(
	canvas: GraphCanvas,
	graphLayerId: string,
): Overlays {
	canvas.behaviours.register(
		new FocusBehaviour({
			id: IDS.focus,
			targetLayerId: graphLayerId,
			frame: true,
			enabled: true,
		}),
	);
	const groups = new BubbleSetsLayer({
		id: IDS.groups,
		zIndex: -1,
		hittable: false,
		options: { graphLayerId, sets: [], smoothness: "chaikin" },
	});
	canvas.layers.add(groups);
	const unready = new GraphLayer({
		id: IDS.unready,
		visible: false,
		hittable: false,
		options: { hiddenTypes: { node: [UNREADY_TYPE] } },
	});
	canvas.layers.add(unready);
	let unreadyIds: string[] = [];
	let density: DensityContourFillLayer | null = null;

	const main = () => canvas.layers.get<GraphLayer>(graphLayerId);
	const syncPositions = () => {
		const store = main()?.store;
		if (!store) return;
		const placed = unreadyIds.filter((id) => store.hasPosition(id));
		const xy = new Float32Array(placed.length * 2);
		placed.forEach((id, i) => {
			const p = store.getPosition(id);
			xy[i * 2] = p?.x ?? 0;
			xy[i * 2 + 1] = p?.y ?? 0;
		});
		unready.store.setPositionsBulk(placed, xy);
		density?.recompute();
		groups.recompute();
	};

	return {
		highlight(ids) {
			const actions = canvas.store.actions.focus;
			if (ids === null) actions.clear();
			else actions.set(ids, true);
		},
		setGroups(sets, colour) {
			groups.setSets(
				sets.map(
					(s): BubbleSet => ({
						id: s.id,
						members: s.members,
						style: { fill: colour(s.id), stroke: colour(s.id) },
						label: { text: s.label, placement: "centroid" },
					}),
				),
			);
		},
		setUnready(ids) {
			unreadyIds = ids;
			unready.setData({
				nodes: ids.map((id) => ({ id, type: UNREADY_TYPE, data: {} })),
				edges: [],
			});
			syncPositions();
		},
		setContour(on, range) {
			if (on && !density) {
				density = new DensityContourFillLayer({
					id: IDS.density,
					zIndex: -2,
					hittable: false,
					options: {
						graphLayerId: IDS.unready,
						recompute: "manual",
						bandwidth: 40,
						thresholds: 8,
						cellSize: 8,
						paletteRangeStart: range[0],
						paletteRangeEnd: range[1],
						fillOpacity: 0.35,
					},
				});
				canvas.layers.add(density);
				density.recompute();
			} else if (!on && density) {
				canvas.layers.remove(IDS.density);
				density = null;
			}
		},
		syncPositions,
	};
}
