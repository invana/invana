import {
	CanvasContext,
	CanvasMessageBar,
	GraphStatusBar as CanvasStatusBar,
	canUseWebGPU,
} from "@invana/canvas-react";
import type {
	GraphData as EngineGraphData,
	GraphCanvas,
	GraphLayer,
} from "@invana/graph";
import { Button } from "@invana/ui";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { SetupRequiredBanner } from "../../../components/settings/SetupRequiredBanner";
import {
	useGraphConnectionQuery,
	useGraphQuery,
} from "../../../hooks/queries/useGraphs";
import { useLLMProvidersQuery } from "../../../hooks/queries/useLLMProviders";
import { useActiveVersionQuery } from "../../../hooks/queries/useSchema";
import {
	type Interaction,
	type SpanAttributes,
	endInteraction,
	measureSync,
	startInteraction,
	withInteraction,
} from "../../../services/telemetry/tracer";
import { type QueryLanguage, isSetupComplete } from "../../../types/graphs";
import type {
	QueryResponse,
	QueryResultItem,
	QueryRunPayload,
} from "../../../types/query";
import type {
	ExpandRequest,
	NeighborExpandResponse,
} from "../../../types/traversal";
import { GraphDetail } from "../components/GraphDetail";
import { RendererCapabilityBanner } from "../components/RendererCapabilityBanner";
import { ExpandFineTunePanel } from "./components/ExpandFineTunePanel";
import {
	ACTIVE_LAYOUT_ID,
	type CanvasBackend,
	type ExpandMenuSchema,
	ExplorerCanvas,
	ExplorerHeaderToolbar,
} from "./components/ExplorerCanvas";
import { InspectorPanel } from "./components/InspectorPanel";
import { SessionsPanel } from "./components/SessionsPanel";
import { useExpandNode } from "./hooks/useExpandNode";
import { useSessions } from "./hooks/useSessions";

// Fallback when the engine hasn't reported any query languages yet (e.g. the
// connector class couldn't be loaded server-side). Studio shows both rather
// than blocking the user.
const FALLBACK_QUERY_LANGUAGES: readonly QueryLanguage[] = [
	"cypher",
	"gremlin",
];

// localStorage key persisting the user's render-backend choice across reloads.
const BACKEND_STORAGE_KEY = "explorer.canvas.backend";

// Map query-result items (vertices / edges) to the canvas engine's GraphData
// shape: the label rides as `type` (colour-by-label + the Inspector's Type row)
// and the properties as `data`. Shared by the full-paint seed and the
// incremental node-expand append (RFC-035).
function adaptItems(items: QueryResultItem[]): EngineGraphData {
	const nodes: EngineGraphData["nodes"] = [];
	const edges: EngineGraphData["edges"] = [];
	for (const item of items) {
		if (item.type === "vertex") {
			nodes.push({
				id: String(item.id),
				type: item.label,
				data: item.properties,
			});
		} else if (item.type === "edge") {
			edges.push({
				id: String(item.id),
				source: String(item.source),
				target: String(item.target),
				type: item.label,
				data: item.properties,
			});
		}
	}
	return { nodes, edges };
}

export function ExplorerPage() {
	const { username, graphSlug } = useParams<{
		username: string;
		graphSlug: string;
	}>();
	const { data: graph, isLoading: graphLoading } = useGraphConnectionQuery(
		username,
		graphSlug,
	);
	const connectionMissing = !graphLoading && !graph;

	// The query route is gated server-side by `require_graph_setup_complete`
	// (409 graph_setup_incomplete). Mirror that here so we never let the user
	// fire a query that's guaranteed to bounce — fetch the Graph container for
	// its `setup_state` and gate the panel when required sections are unfinished.
	const { data: graphContainer } = useGraphQuery(username, graphSlug);
	const setupIncomplete = !!graphContainer && !isSetupComplete(graphContainer);

	const {
		sessions,
		activeSession,
		isRunning,
		isRefreshing,
		sort,
		setSort,
		showArchived,
		setShowArchived,
		send,
		rerun,
		stop,
		refresh,
		setPinned,
		setArchived,
		openSession,
		backToList,
	} = useSessions(username, graphSlug);

	// Collapsed state lives in the URL (`?sessions=closed` for the left panel,
	// `?inspector=closed` for the right), mirroring the Settings panel
	// convention. Each panel's header collapse control sets its param; a re-open
	// button in the header (shown only while collapsed) clears it. The left panel
	// also re-opens via the left-rail Explorer icon, which drops the query string.
	const [searchParams, setSearchParams] = useSearchParams();
	const sessionsClosed = searchParams.get("sessions") === "closed";
	const inspectorClosed = searchParams.get("inspector") === "closed";
	const setPanelParam = useCallback(
		(key: string, closed: boolean) => {
			const next = new URLSearchParams(searchParams);
			if (closed) next.set(key, "closed");
			else next.delete(key);
			setSearchParams(next, { replace: true });
		},
		[searchParams, setSearchParams],
	);
	const closeSessions = useCallback(
		() => setPanelParam("sessions", true),
		[setPanelParam],
	);
	const closeInspector = useCallback(
		() => setPanelParam("inspector", true),
		[setPanelParam],
	);
	const openInspector = useCallback(
		() => setPanelParam("inspector", false),
		[setPanelParam],
	);
	const { data: llmProvidersResponse } = useLLMProvidersQuery(
		username,
		graphSlug,
	);
	const llmProviders = llmProvidersResponse?.items ?? [];

	// Full current canvas contents — drives the Inspector (`allItems` / `selected`)
	// and the seed re-fed to a freshly-mounted canvas (e.g. on a backend remount).
	// A fresh query *replaces* it; a node-expand *appends* to it (RFC-035).
	const [canvasData, setCanvasData] = useState<QueryResultItem[]>([]);
	// Mirror in a ref so the imperative expand path and the backend-remount reseed
	// can read the latest contents without re-deriving the GraphLayer seed.
	const canvasDataRef = useRef<QueryResultItem[]>([]);
	useEffect(() => {
		canvasDataRef.current = canvasData;
	}, [canvasData]);

	// What `<GraphLayer data>` is seeded/replaced with. Its *reference* only changes
	// on a full repaint (fresh query / load-to-canvas / restore) or a backend
	// remount — never on a node-expand, which appends straight to the live store
	// (the non-destructive path) so existing node positions survive. Re-feeding the
	// whole dataset here would call the destructive `setData`, wiping every position
	// and re-laying the graph out from the origin on each expand.
	const [seedData, setSeedData] = useState<EngineGraphData>({
		nodes: [],
		edges: [],
	});

	// Per-message query results (RFC-033): transient, keyed by assistant message
	// id, populated on send/rerun and rendered inline in the thread.
	const [resultsByMessageId, setResultsByMessageId] = useState<
		Record<string, QueryResponse | null>
	>({});
	const setResultFor = useCallback(
		(messageId: string, result: QueryResponse | null) =>
			setResultsByMessageId((prev) => ({ ...prev, [messageId]: result })),
		[],
	);

	// Root span for the in-flight query run (RFC-025). Held in a ref so the
	// transform / adapt / layout / render stages — which span several async
	// renders — all attach to the same trace. Set in `handleRun`, closed by the
	// canvas's layout bridge after the first painted frame.
	const runRef = useRef<Interaction | null>(null);

	// The live canvas engine, lifted out of <Canvas> by <CanvasBridge>. Null until
	// the graph is fully wired; gates the header toolbar that depends on it.
	const [canvas, setCanvas] = useState<GraphCanvas | null>(null);
	const handleReady = useCallback((c: GraphCanvas | null) => setCanvas(c), []);

	// Magnet toggle → hover neighbour radius. On (default): hovering a node lights
	// up its 1st-degree neighbours; off: only the hovered node lights up.
	const [magnet, setMagnet] = useState(true);
	const toggleMagnet = useCallback(() => setMagnet((m) => !m), []);

	// Render backend (PixiJS). Defaults to WebGPU when the device can select it
	// (`canUseWebGPU` — API present and not WebKit), else WebGL. The header switcher
	// lets a user pin WebGL explicitly; the choice persists across reloads. The
	// engine itself downgrades/retries to WebGL at init if WebGPU can't actually
	// initialise (e.g. a blocklisted adapter), so no runtime fallback is needed here.
	const [backend, setBackendState] = useState<CanvasBackend>(() => {
		const saved = localStorage.getItem(BACKEND_STORAGE_KEY);
		if (saved === "webgl") return "webgl";
		return canUseWebGPU() ? "webgpu" : "webgl";
	});
	// Switching the backend remounts the canvas (ExplorerCanvas keys on `backend`),
	// which rebuilds the store from the GraphLayer seed. Reseed with the full
	// current contents first — including node-expand additions, which were appended
	// straight to the store and so aren't in the paint-only `seedData` — so nothing
	// is lost across the switch.
	const setBackend = useCallback((b: CanvasBackend) => {
		localStorage.setItem(BACKEND_STORAGE_KEY, b);
		setSeedData(adaptItems(canvasDataRef.current));
		setBackendState(b);
	}, []);

	// Clicked node/edge id, lifted from the canvas by <InspectorSelectionBridge>.
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const selected: QueryResultItem | null = selectedId
		? (canvasData.find((i) => String(i.id) === selectedId) ?? null)
		: null;

	// The engine resolves capabilities from the live connector and returns
	// them on the connection payload. Default to the first language it
	// reports, fall back to allowing both while the engine is still warming
	// up / can't resolve the connector class.
	const availableLanguages: readonly QueryLanguage[] = graph?.query_languages
		?.length
		? graph.query_languages
		: FALLBACK_QUERY_LANGUAGES;
	const defaultLanguage: QueryLanguage = availableLanguages[0] ?? "cypher";

	const paintCanvas = useCallback((result: QueryResponse | null) => {
		if (result?.result_type !== "graph" || !result.data) return;
		const data = result.data;
		// `explorer.transform` span (RFC-025) — time the dedupe of query results
		// before they're handed to the canvas. No-ops when there's no active run.
		measureSync(runRef.current, "explorer.transform", (span) => {
			// Path queries (e.g. `MATCH path = (n)-[r]->() RETURN path`) repeat shared
			// endpoints once per row, so the engine returns the same node/edge id many
			// times. The canvas store rejects duplicate ids (GraphStore.addNode), so
			// dedupe by id here — keeping the first occurrence — before painting.
			const nodeMap = new Map<string, QueryResultItem>();
			for (const n of data.nodes) {
				const id = String(n.id);
				if (!nodeMap.has(id)) nodeMap.set(id, { ...n, type: "vertex" });
			}
			const edgeMap = new Map<string, QueryResultItem>();
			for (const e of data.edges) {
				const id = String(e.id);
				if (!edgeMap.has(id)) edgeMap.set(id, { ...e, type: "edge" });
			}
			const nodes = [...nodeMap.values()];
			const edges = [...edgeMap.values()];
			const items = [...nodes, ...edges];
			setCanvasData(items);
			setSelectedId(null);
			// Replace the canvas seed (full repaint → destructive setData + relayout).
			// `explorer.adapt` span (RFC-025) — time mapping results to GraphData.
			setSeedData(
				measureSync(runRef.current, "explorer.adapt", (adaptSpan) => {
					const seed = adaptItems(items);
					adaptSpan?.setAttribute("explorer.node_count", seed.nodes.length);
					adaptSpan?.setAttribute("explorer.edge_count", seed.edges.length);
					return seed;
				}),
			);
			span?.setAttribute("explorer.raw_nodes", data.nodes.length);
			span?.setAttribute("explorer.raw_edges", data.edges.length);
			span?.setAttribute("explorer.node_count", nodes.length);
			span?.setAttribute("explorer.edge_count", edges.length);
		});
	}, []);

	// ── Node expand / graph traversal (RFC-035) ────────────────────────────────
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
		[canvas],
	);

	const expand = useExpandNode(username, graphSlug);
	const runExpand = useCallback(
		async (req: ExpandRequest): Promise<NeighborExpandResponse | null> => {
			try {
				const res = await expand.mutateAsync(req);
				handleExpandResult(res);
				if (res.returned === 0) toast.info("No more neighbours to load.");
				return res;
			} catch {
				toast.error("Failed to load neighbours.");
				return null;
			}
		},
		[expand, handleExpandResult],
	);

	// Active model schema drives the expand submenus + fine-tune pickers.
	const { data: activeVersion } = useActiveVersionQuery(username, graphSlug);
	const expandSchema = useMemo<ExpandMenuSchema | null>(() => {
		if (!activeVersion) return null;
		return {
			nodeTypes: activeVersion.node_types.map((n) => n.name),
			edgeTypes: activeVersion.edge_types.map((e) => ({
				name: e.name,
				source_node_types: e.source_node_types,
				target_node_types: e.target_node_types,
			})),
		};
	}, [activeVersion]);
	const propertyKeys = useMemo(
		() => (activeVersion?.property_keys ?? []).map((p) => p.name),
		[activeVersion],
	);

	const [fineTuneVertex, setFineTuneVertex] = useState<string | null>(null);
	const expandHandlers = useMemo(
		() => ({
			schema: expandSchema,
			onExpand: (req: ExpandRequest) => void runExpand(req),
			onOpenFineTune: (vertexId: string) => setFineTuneVertex(vertexId),
		}),
		[expandSchema, runExpand],
	);

	// Session whose canvas is already painted — skip the auto-restore effect for
	// it (a fresh send already painted; reopening another session restores it).
	const restoredRef = useRef<string | null>(null);

	// Open one `explorer.query.run` root per user trigger (run / rerun / restore),
	// run `work` inside its context, and paint. Graph results flow on to
	// layout+render, where the canvas bridge closes the root after the first
	// painted frame; everything else (errors / NL / tabular) has nothing more to
	// paint, so we close here in `finally`. `explorer.trigger` distinguishes the
	// three entry points in HyperDX (RFC-026 D2). Running `work` inside the
	// interaction's context makes its API call — and, via traceparent, the whole
	// engine subtree — children of this span.
	const runTraced = useCallback(
		async (
			trigger: "run" | "rerun" | "restore",
			attributes: SpanAttributes,
			work: () => Promise<QueryResponse | null>,
		): Promise<QueryResponse | null> => {
			const interaction = startInteraction("explorer.query.run", {
				"explorer.trigger": trigger,
				...attributes,
			});
			runRef.current = interaction;
			try {
				// A query run no longer paints — its result renders inline in the
				// thread (RFC-033). The canvas pipeline is traced separately, on Load
				// to canvas, so the run span just covers translate + execute.
				return await withInteraction(interaction, work);
			} catch (err) {
				interaction.span.recordException(err as Error);
				throw err;
			} finally {
				endInteraction(runRef, interaction);
			}
		},
		[],
	);

	// Explicit projection of a graph result onto the canvas (RFC-033). Opens its
	// own canvas-render trace; the canvas bridge closes it after the painted frame
	// (the same mechanism the old auto-paint used).
	const handleLoadToCanvas = useCallback(
		(result: QueryResponse) => {
			const interaction = startInteraction("explorer.query.run", {
				"explorer.trigger": "load",
			});
			runRef.current = interaction;
			paintCanvas(result);
		},
		[paintCanvas],
	);

	const handleRun = async (payload: QueryRunPayload) => {
		if (setupIncomplete) {
			toast.error(
				"Finish the setup wizard (Graph Info + Intent) before running queries.",
			);
			return;
		}
		let messageId: string | null = null;
		const result = await runTraced(
			"run",
			{
				"explorer.mode": payload.mode,
				"explorer.language": payload.mode === "ql" ? payload.language : "",
			},
			// `send` threads the ask/answer into a session (creating + opening one
			// when none is active) and runs the engine query, returning the assistant
			// message id so its result can be keyed for inline rendering (RFC-033).
			async () => {
				const { sessionId, messageId: mid, result } = await send(payload);
				restoredRef.current = sessionId;
				messageId = mid;
				return result;
			},
		);
		if (messageId) setResultFor(messageId, result);
	};

	// `rerun` re-issues a stored message's query — triggered by clicking a message
	// (`rerun`) or by the session-restore effect (`restore`). Both are traced and
	// store the result inline against that message.
	const handleRerun = useCallback(
		async (messageId: string, trigger: "rerun" | "restore" = "rerun") => {
			const result = await runTraced(trigger, {}, () => rerun(messageId));
			setResultFor(messageId, result);
		},
		[runTraced, rerun, setResultFor],
	);

	// Re-run the latest query-bearing message when a session is opened, to
	// restore its canvas (RFC-024 Decision 10 — metadata-only, re-run to view).
	useEffect(() => {
		if (!activeSession) {
			restoredRef.current = null;
			return;
		}
		if (restoredRef.current === activeSession.id) return;
		const latest = [...activeSession.messages]
			.reverse()
			.find((m) => m.role === "assistant" && m.sourceQuery);
		if (!latest) return;
		restoredRef.current = activeSession.id;
		void handleRerun(latest.id, "restore");
	}, [activeSession, handleRerun]);

	// Clicking a node/edge feeds `selectedId` via <InspectorSelectionBridge>; the
	// derived `selected` (above) drives the right-side InspectorPanel. The toolbar
	// lives in the header, so the canvas fills the main area edge-to-edge.
	const canvasContent = (
		<div className="relative w-full h-full overflow-hidden">
			<RendererCapabilityBanner />
			<ExplorerCanvas
				data={seedData}
				onReady={handleReady}
				onViewTargetChange={setSelectedId}
				magnet={magnet}
				interactionRef={runRef}
				backend={backend}
				expand={expandHandlers}
			/>
			{fineTuneVertex && (
				<ExpandFineTunePanel
					open
					vertexId={fineTuneVertex}
					schema={expandSchema}
					propertyKeys={propertyKeys}
					onClose={() => setFineTuneVertex(null)}
					onExpand={runExpand}
				/>
			)}
		</div>
	);

	const leftContent = connectionMissing ? (
		<SetupRequiredBanner pageLabel="Explorer" reason="connection" />
	) : setupIncomplete ? (
		<SetupRequiredBanner pageLabel="Explorer" reason="setup" />
	) : (
		<SessionsPanel
			availableLanguages={availableLanguages}
			defaultLanguage={defaultLanguage}
			llmProviders={llmProviders}
			onRun={handleRun}
			onStop={stop}
			isRunning={isRunning}
			sessions={sessions}
			activeSession={activeSession}
			onOpenSession={openSession}
			onBack={backToList}
			onRerun={handleRerun}
			results={resultsByMessageId}
			onLoadToCanvas={handleLoadToCanvas}
			onRefresh={refresh}
			isRefreshing={isRefreshing}
			onClose={closeSessions}
			sort={sort}
			onSortChange={setSort}
			showArchived={showArchived}
			onShowArchivedChange={setShowArchived}
			onPin={setPinned}
			onArchive={setArchived}
		/>
	);

	// Right-panel (inspector) toggle for the page header — always shown, next to
	// the profile menu. The left (sessions) panel is driven by the left nav rail.
	// Reflects the panel's state: a collapse icon while open, an expand icon
	// while collapsed.
	const panelControls = (
		<Button
			variant="ghost"
			size="icon"
			className="h-7 w-7"
			onClick={inspectorClosed ? openInspector : closeInspector}
			title={inspectorClosed ? "Show inspector panel" : "Hide inspector panel"}
		>
			{inspectorClosed ? (
				<PanelRightOpen className="w-4 h-4" />
			) : (
				<PanelRightClose className="w-4 h-4" />
			)}
		</Button>
	);

	return (
		// Lifted context: the live engine reaches the header toolbar, which lives
		// in GraphDetail's header (a sibling of <Canvas>, outside its own provider).
		<CanvasContext.Provider value={canvas}>
			<GraphDetail
				sectionId="explorer"
				pageLabel="Explorer"
				headerPanelControls={panelControls}
				headerCenter={
					canvas ? (
						// Dead-center the toolbar against the full header width (the header
						// nav is `relative`; see useAppHeader). Absolute positioning lifts
						// it out of the flex flow so its midpoint stays at the header's
						// midpoint regardless of the breadcrumb / right-control widths.
						<div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center">
							<ExplorerHeaderToolbar
								magnet={magnet}
								onToggleMagnet={toggleMagnet}
								backend={backend}
								onBackendChange={setBackend}
							/>
						</div>
					) : undefined
				}
				leftSection={
					sessionsClosed
						? undefined
						: {
								// Generous max so long Cypher/Gremlin queries can spread out.
								// mainSection.minSize below still keeps the canvas usable when
								// the user drags the divider far right.
								defaultSize: "300px",
								minSize: "240px",
								maxSize: "900px",
								collapsible: false,
								content: leftContent,
							}
				}
				mainSection={{
					defaultSize: "600px",
					minSize: "300px",
					// Canvas stays in place even when the connection isn't attached
					// — it'll render empty. The leftSection banner is the explainer.
					content: canvasContent,
				}}
				rightSection={
					inspectorClosed
						? undefined
						: {
								defaultSize: "280px",
								minSize: "240px",
								maxSize: "360px",
								collapsible: false,
								content: (
									<InspectorPanel
										selected={selected}
										allItems={canvasData}
										onClose={closeInspector}
									/>
								),
							}
				}
				statusMetrics={
					// Live engine telemetry — node/edge totals, zoom, pan, pointer world
					// position, hovered node/edge, selection counts — self-wired off the
					// lifted CanvasContext (same status bar as the canvas-react story).
					canvas ? <CanvasStatusBar /> : null
				}
				// The shared message bar — shows whatever was last pushed via
				// Canvas.showMessage (e.g. a layout's "Running… / ready"); empty when idle.
				footerRightExtras={canvas ? <CanvasMessageBar /> : null}
			/>
		</CanvasContext.Provider>
	);
}
