import type { GraphCanvas, GraphLayer } from "@invana/graph";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import type {
	CaptureCanvasState,
	useBoardVersions,
} from "@/pages/graphs-detail/features/boards";
import {
	adaptItems,
	expandRefusal,
} from "@/pages/graphs-detail/features/explorer/canvasItems";
import {
	ACTIVE_LAYOUT_ID,
	type ExpandMenuSchema,
} from "@/pages/graphs-detail/features/explorer/ExplorerCanvas";
import { useTypeCountsQuery } from "@/pages/graphs-detail/features/explorer/queries";
import type {
	ExpandRequest,
	NeighborExpandResponse,
} from "@/pages/graphs-detail/features/explorer/types";
import { useExpandNode } from "@/pages/graphs-detail/features/explorer/useExpandNode";
import { useActiveVersionQuery } from "@/pages/graphs-detail/features/models";
import type { QueryResultItem } from "@/types/query";

/** What node expansion reads from the data canvas it grows. */
export interface CanvasExpandDeps {
	username: string | undefined;
	graphSlug: string | undefined;
	/** The live engine; null until the canvas is wired. */
	canvas: GraphCanvas | null;
	setCanvasData: ReturnType<typeof useBoardVersions>["setItems"];
	captureCanvasState: CaptureCanvasState;
	activeSessionId: string | null;
	/** The open thread's world; null is *Everything*. */
	threadWorldId: string | null;
	/** Refetches the thread, so an expansion shows as a turn. */
	refresh: () => void;
}

/**
 * Node expansion on a data canvas.
 *
 * Runs an expansion as a turn in the active session under the thread's world,
 * appends what comes back straight to the live store — each new node born on a
 * ring around the node it grew from, so existing positions survive — and
 * captures a version when the canvas grew. Also offers the expand menus only
 * what the world holds, read from the active model and the world's type counts.
 */
export function useCanvasExpand(deps: CanvasExpandDeps) {
	const {
		username,
		graphSlug,
		canvas,
		setCanvasData,
		captureCanvasState,
		activeSessionId,
		threadWorldId,
		refresh,
	} = deps;

	// ── Node expand / graph traversal (docs/for-developers/modules/explore/features/graph-canvas.md) ────────────────────────────────
	// Append expanded neighbours straight to the live store (the non-destructive
	// path) rather than re-feeding the whole dataset through `<GraphLayer data>`,
	// which calls the destructive `setData` — wiping every node's position and
	// re-laying the graph out from the origin on each expand. `store.addData`
	// flushes once and emits `data:changed (addedNodes>0)`, which re-runs the
	// active layout (d3-force, seeded from each node's *current* position).
	//
	// The catch: a brand-new node has no stored position, so it's born at the
	// world origin (0,0). The existing graph, however, has already been laid out
	// and framed *away* from the origin — so every new neighbour spawns in the
	// same empty spot, and a single seeded force pass can't drag them across the
	// canvas to their parent before it settles: they stay piled on that one point.
	// (The canvas-react streaming-demo dodges this only because its graph lives
	// permanently at the origin under a continuously-running live sim.)
	//
	// Fix: birth each new node *next to the existing node it attaches to* (an even
	// ring around that anchor), so it spawns where it belongs. d3-force then just
	// relaxes the ring locally — placed nodes stay put, neighbours fan out from
	// their parent. `canvasData` (the Inspector list) is merged in parallel so the
	// right panel sees the additions.
	const handleExpandResult = useCallback(
		(res: NeighborExpandResponse) => {
			const store = canvas?.layers.get<GraphLayer>("graph")?.store;
			// Genuinely-new items only — `store.addData` uses `addNode`, which throws
			// on a duplicate id, so drop anything already in the store (a re-returned
			// origin node / shared neighbour) and any id repeated within this response
			// (path-style results echo shared endpoints).
			const seenNodes = new Set<string>();
			const seenEdges = new Set<string>();
			const newNodeIds = new Set<string>();
			const newItems: QueryResultItem[] = [];
			for (const n of res.data.nodes) {
				const id = String(n.id);
				if (seenNodes.has(id) || store?.hasNode(id)) continue;
				seenNodes.add(id);
				newNodeIds.add(id);
				newItems.push({ ...n, type: "vertex" });
			}
			for (const e of res.data.edges) {
				const id = String(e.id);
				if (seenEdges.has(id) || store?.hasEdge(id)) continue;
				seenEdges.add(id);
				newItems.push({ ...e, type: "edge" });
			}
			if (newItems.length === 0) return;
			// Inspector list — additive.
			setCanvasData((prev) => [...prev, ...newItems]);
			// When the canvas isn't live yet there's no store; the canvasData merge
			// above still lands and the next paint/remount seeds it.
			if (!store) return;

			// Anchor each new node to the *existing* endpoint of a connecting edge —
			// the node it was expanded from. (Edges among the new nodes themselves
			// are ignored here; those settle under the force pass.)
			const anchorOf = new Map<string, string>();
			for (const e of res.data.edges) {
				const s = String(e.source);
				const t = String(e.target);
				if (newNodeIds.has(t) && !anchorOf.has(t) && store.hasNode(s))
					anchorOf.set(t, s);
				if (newNodeIds.has(s) && !anchorOf.has(s) && store.hasNode(t))
					anchorOf.set(s, t);
			}

			// Birth new nodes on an even ring around their anchor's current position,
			// distributing siblings of the same anchor around the circle so they don't
			// stack. The ring is sized to *hold* them: a hub with many neighbours gets
			// a wider ring (circumference ≥ one node-spacing per leaf), so a dense fan
			// starts pre-separated and the force pass just relaxes it instead of having
			// to shove 40 overlapping nodes apart from a tight cluster. Nodes with no
			// resolved anchor (rare — a disconnected return) keep the default origin.
			const MIN_RING_RADIUS = 60;
			const NODE_SPACING = 40; // ≈ 2 × collide radius; arc length wanted per leaf
			const ringSeen = new Map<string, number>();
			const ringTotal = new Map<string, number>();
			for (const id of newNodeIds) {
				const a = anchorOf.get(id);
				if (a) ringTotal.set(a, (ringTotal.get(a) ?? 0) + 1);
			}
			const seed = adaptItems(newItems);
			for (const node of seed.nodes) {
				const anchorId = anchorOf.get(node.id);
				if (!anchorId) continue;
				const base = store.getPosition(anchorId);
				if (!base) continue;
				const total = ringTotal.get(anchorId) ?? 1;
				const i = ringSeen.get(anchorId) ?? 0;
				ringSeen.set(anchorId, i + 1);
				const radius = Math.max(
					MIN_RING_RADIUS,
					(NODE_SPACING * total) / (2 * Math.PI),
				);
				const angle = (2 * Math.PI * i) / total;
				node.position = {
					x: base.x + radius * Math.cos(angle),
					y: base.y + radius * Math.sin(angle),
				};
			}

			// Append, then relax: d3-force seeds from the ring positions we just set,
			// so existing nodes stay put and the new neighbours spread around their
			// anchor. (`runLayout` is explicit rather than leaning on the engine's
			// data:changed → active-layout wiring, so the re-layout is guaranteed.)
			store.addData(seed);
			void canvas?.runLayout(ACTIVE_LAYOUT_ID);
		},
		[canvas, setCanvasData],
	);

	const expand = useExpandNode(username, graphSlug);
	const runExpand = useCallback(
		async (req: ExpandRequest): Promise<NeighborExpandResponse | null> => {
			// An expansion is a run under the canvas's lens (graph-canvas.md GC6 ·
			// GC11): the picked world rides along exactly as it does on an ask, and
			// the active session makes the run a turn in its thread (GC12).
			const tagged = {
				...req,
				body: {
					...req.body,
					...(activeSessionId ? { session_id: activeSessionId } : {}),
					...(threadWorldId ? { lens_id: threadWorldId } : {}),
				},
			} as ExpandRequest;
			try {
				const res = await expand.mutateAsync(tagged);
				handleExpandResult(res);
				if (res.returned === 0) {
					toast.info("No more neighbours to load.");
				} else {
					// The canvas grew — capture a version (docs/for-developers/modules/explore/features/boards.md).
					void captureCanvasState("expand");
				}
				return res;
			} catch (err) {
				toast.error(expandRefusal(err));
				return null;
			} finally {
				// Every expansion is a turn, an empty one and a refusal included —
				// refetch the thread so it shows.
				if (activeSessionId) refresh();
			}
		},
		[
			expand,
			handleExpandResult,
			activeSessionId,
			threadWorldId,
			refresh,
			captureCanvasState,
		],
	);

	// The expand submenus and the fine-tune pickers offer only what the picked
	// world holds (graph-canvas.md GC13): node types from the world's own type
	// counts, and edge types the world allows whose both ends it allows too. The
	// active model supplies each edge's endpoints. The Model panel loads its own
	// version, because it may be looking at a draft.
	const { data: activeVersion } = useActiveVersionQuery(username, graphSlug);
	const { data: worldTypes } = useTypeCountsQuery(
		username,
		graphSlug,
		threadWorldId,
	);
	const expandSchema = useMemo<ExpandMenuSchema | null>(() => {
		if (!activeVersion || !worldTypes) return null;
		const nodes = new Set(worldTypes.nodes.map((t) => t.name));
		const edges = new Set(worldTypes.edges.map((t) => t.name));
		return {
			nodeTypes: activeVersion.node_types
				.map((n) => n.name)
				.filter((n) => nodes.has(n)),
			edgeTypes: activeVersion.edge_types
				.filter((e) => edges.has(e.name))
				.map((e) => ({
					name: e.name,
					source_node_types: e.source_node_types.filter((t) => nodes.has(t)),
					target_node_types: e.target_node_types.filter((t) => nodes.has(t)),
				}))
				.filter(
					(e) =>
						e.source_node_types.length > 0 && e.target_node_types.length > 0,
				),
		};
	}, [activeVersion, worldTypes]);
	const propertyKeys = useMemo(
		() => (activeVersion?.property_keys ?? []).map((p) => p.name),
		[activeVersion],
	);

	const expandHandlers = useMemo(
		() => ({
			schema: expandSchema,
			onExpand: (req: ExpandRequest) => void runExpand(req),
		}),
		[expandSchema, runExpand],
	);

	return { runExpand, expandSchema, propertyKeys, expandHandlers };
}
