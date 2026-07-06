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
import { Network } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { SetupRequiredBanner } from "../../../components/settings/SetupRequiredBanner";
import { useSettingsPanel } from "../../../components/settings/useSettingsPanel";
import {
	useCreateCanvasStateMutation,
	useForkCanvasStateMutation,
} from "../../../hooks/queries/useCanvasStates";
import {
	useCanvasesQuery,
	useCreateCanvasMutation,
} from "../../../hooks/queries/useCanvases";
import {
	useGraphConnectionQuery,
	useGraphQuery,
} from "../../../hooks/queries/useGraphs";
import { useLLMProvidersQuery } from "../../../hooks/queries/useLLMProviders";
import { useActiveVersionQuery } from "../../../hooks/queries/useSchema";
import { canvasesApi } from "../../../services/api/canvases";
import { ApiError } from "../../../services/api/client";
import { sessionsApi } from "../../../services/api/sessions";
import {
	type Interaction,
	type SpanAttributes,
	endInteraction,
	measureSync,
	startInteraction,
	withInteraction,
} from "../../../services/telemetry/tracer";
import type {
	Canvas,
	CanvasStateKind,
	CanvasStyling,
} from "../../../types/canvas";
import { type QueryLanguage, isSetupComplete } from "../../../types/graphs";
import type {
	QueryResponse,
	QueryResultItem,
	QueryRunPayload,
} from "../../../types/query";
import type { SessionMessage } from "../../../types/session";
import type {
	ExpandRequest,
	NeighborExpandResponse,
} from "../../../types/traversal";
import { GraphDetail } from "../components/GraphDetail";
import { RendererCapabilityBanner } from "../components/RendererCapabilityBanner";
import { CanvasFormDialog } from "./components/CanvasFormDialog";
import { CanvasHistoryPanel } from "./components/CanvasHistoryPanel";
import { CanvasTabsBar } from "./components/CanvasTabsBar";
import { ExpandFineTunePanel } from "./components/ExpandFineTunePanel";
import {
	ACTIVE_LAYOUT_ID,
	type CanvasBackend,
	type ExpandMenuSchema,
	ExplorerCanvas,
	ExplorerHeaderToolbar,
} from "./components/ExplorerCanvas";
import { InspectorPanel } from "./components/InspectorPanel";
import { SchemaBrowser } from "./components/SchemaBrowser";
import {
	SessionTutorialModal,
	hasSeenSessionTutorial,
	markSessionTutorialSeen,
} from "./components/SessionTutorialModal";
import { SessionsPanel } from "./components/SessionsPanel";
import { type StyleTypeInfo, StylingPanel } from "./components/StylingPanel";
import { useExpandNode } from "./hooks/useExpandNode";
import { useSessions } from "./hooks/useSessions";
import {
	STATE_THUMB_MAX_EDGE,
	captureBanner,
	downscaleDataUrl,
} from "./lib/captureBanner";

// Fallback when the engine hasn't reported any query languages yet (e.g. the
// connector class couldn't be loaded server-side). Studio shows both rather
// than blocking the user.
const FALLBACK_QUERY_LANGUAGES: readonly QueryLanguage[] = [
	"cypher",
	"gremlin",
];

// localStorage key persisting the user's render-backend choice across reloads.
const BACKEND_STORAGE_KEY = "explorer.canvas.backend";

// Banner capture is expensive (PixiJS extract + downscale), so it's throttled:
// at most one fresh capture per this window. Also the cadence of the periodic
// autosave that keeps the sessions-list preview current (RFC-047 Part A).
const BANNER_MIN_INTERVAL_MS = 10_000;

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

// Dedupe a graph query result into canvas items (vertices + edges), keeping the
// first occurrence of each id — the same normalization `paintCanvas` does, reused
// to seed a new canvas's snapshot. Empty for a non-graph / null result.
function resultToItems(result: QueryResponse | null): QueryResultItem[] {
	if (result?.result_type !== "graph" || !result.data) return [];
	const nodeMap = new Map<string, QueryResultItem>();
	for (const n of result.data.nodes) {
		const id = String(n.id);
		if (!nodeMap.has(id)) nodeMap.set(id, { ...n, type: "vertex" });
	}
	const edgeMap = new Map<string, QueryResultItem>();
	for (const e of result.data.edges) {
		const id = String(e.id);
		if (!edgeMap.has(id)) edgeMap.set(id, { ...e, type: "edge" });
	}
	return [...nodeMap.values(), ...edgeMap.values()];
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
		activeSessionId,
		isRunning,
		isRefreshing,
		sort,
		setSort,
		showArchived,
		setShowArchived,
		send,
		rerun,
		recordLoad,
		fetchContext,
		setFeedback,
		stop,
		refresh,
		setPinned,
		setArchived,
		renameSession,
		openSession,
		backToList,
	} = useSessions(username, graphSlug);

	// Panel state lives in the URL. The left (sessions) panel defaults OPEN
	// (`?sessions=closed` hides it). The right (inspector / property detail) panel
	// defaults CLOSED — it's only useful with a node selected, so it stays out of
	// the way until the user opens it (`?inspector=open`); navigating to Explorer
	// never auto-opens it.
	const [searchParams, setSearchParams] = useSearchParams();
	const inspectorClosed = searchParams.get("inspector") !== "open";
	// The sessions panel is just the Explorer's entry in the shared single-open
	// left-rail param (`?settings=sessions`) — same toggle as every other icon.
	const settingsPanel = useSettingsPanel();
	const setPanelParam = useCallback(
		(key: string, value: string | null) => {
			const next = new URLSearchParams(searchParams);
			if (value === null) next.delete(key);
			else next.set(key, value);
			setSearchParams(next, { replace: true });
		},
		[searchParams, setSearchParams],
	);
	const closeSessions = settingsPanel.close;
	const closeInspector = useCallback(
		() => setPanelParam("inspector", null),
		[setPanelParam],
	);
	const openInspector = useCallback(
		() => setPanelParam("inspector", "open"),
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

	// Toggling the left column no longer remounts the canvas: GraphDetail keeps the
	// main (canvas) panel mounted at a stable position and renders the sidebar as a
	// conditional sibling, so the live store — positions and all — survives a panel
	// open/close. No reseed is needed here (an unconditional reseed would itself
	// re-feed `<GraphLayer data>` and force a destructive relayout on every toggle,
	// which is exactly the jump this avoids). Only genuine remounts — the
	// backend switch above, which keys `ExplorerCanvas` on `backend` — reseed.

	// Open canvas tabs (RFC-043) — the main-section tab strip. Each tab is a
	// canvas backed 1:1 by a session; a tab is "active" when its backing session
	// is the active query session, so switching tabs switches the session too and
	// new queries belong to that canvas. `activeCanvasId` is therefore derived.
	// A tab is a canvas bound 1:1 to a session; its label is the session's title
	// (RFC-045), read live from `sessionTitleById` — so the tab holds no title of
	// its own.
	const [openTabs, setOpenTabs] = useState<{ id: string; sessionId: string }[]>(
		[],
	);
	const [editingCanvasId, setEditingCanvasId] = useState<string | null>(null);
	const createCanvas = useCreateCanvasMutation(username ?? "", graphSlug ?? "");
	// Version history (RFC-047): capture a state after each canvas-mutating turn,
	// and fork a chosen state into a new canvas to "go back in time".
	const createCanvasState = useCreateCanvasStateMutation(
		username ?? "",
		graphSlug ?? "",
	);
	const forkCanvasState = useForkCanvasStateMutation(
		username ?? "",
		graphSlug ?? "",
	);
	const [historyOpen, setHistoryOpen] = useState(false);
	// Session tutorial (RFC-045) — auto-open once on a user's first session,
	// reopenable from the "?" in the canvas header.
	const [tutorialOpen, setTutorialOpen] = useState(
		() => !hasSeenSessionTutorial(),
	);
	const closeTutorial = useCallback(() => {
		markSessionTutorialSeen();
		setTutorialOpen(false);
	}, []);
	// Per-type styling (RFC-045) for the active canvas — hydrated from it on open,
	// edited in the StylingPanel, applied live by the renderer + persisted.
	const [styling, setStyling] = useState<CanvasStyling>({});
	const [stylingOpen, setStylingOpen] = useState(false);
	// Canvas list — used to resolve an existing session's canvas when opening it
	// from the sessions list (`handleOpenSession`). Titles/purposes for the tabs
	// and edit dialog come from the session + a direct canvas fetch, not this.
	const { data: canvasList } = useCanvasesQuery(username, graphSlug, {
		limit: 100,
		includeArchived: true,
	});
	const activeCanvasId =
		openTabs.find((t) => t.sessionId === activeSessionId)?.id ?? null;
	// Mirror in a ref so the delayed state-capture (which runs after the canvas
	// settles) reads the canvas that's active *now*, not the one closed over when
	// the turn fired.
	const activeCanvasIdRef = useRef<string | null>(null);
	useEffect(() => {
		activeCanvasIdRef.current = activeCanvasId;
	}, [activeCanvasId]);
	// Throttle banner capture (RFC-047 Part A): the last capture's timestamp + URL,
	// so the periodic autosave and per-turn state-capture can reuse a fresh shot
	// instead of re-extracting from PixiJS on every save.
	const lastBannerAtRef = useRef(0);
	const lastBannerUrlRef = useRef<string | null>(null);
	// sessionId → canvasId for canvases that have a banner screenshot (RFC-045),
	// so the Sessions list can show each session's canvas preview above its title.
	// Only bannered canvases are mapped; their rows lazy-fetch the (heavy) image.
	const bannerCanvasIdBySession = useMemo(() => {
		const m = new Map<string, string>();
		for (const c of canvasList?.items ?? []) {
			if (c.hasBanner) m.set(c.sessionId, c.id);
		}
		return m;
	}, [canvasList]);
	// A session's title is the single name for it and its 1:1 canvas (RFC-045):
	// the breadcrumb and the canvas tab show the same session title, so there's no
	// separate canvas name to keep in sync. `activeSession` is the freshest source
	// for the open thread (e.g. right after a rename); the list covers the rest.
	const sessionTitleById = useMemo(() => {
		const m = new Map<string, string>();
		for (const s of sessions) m.set(s.id, s.title);
		if (activeSession) m.set(activeSession.id, activeSession.title);
		return m;
	}, [sessions, activeSession]);
	const tabItems = useMemo(
		() =>
			openTabs.map((t) => ({
				id: t.id,
				title: sessionTitleById.get(t.sessionId) ?? "",
			})),
		[openTabs, sessionTitleById],
	);

	// The session behind the tab being edited (its title is what the edit dialog
	// renames). Read from `openTabs` — always present for an open tab, unlike the
	// canvas list cache which can lag a freshly created canvas.
	const editingSessionId = editingCanvasId
		? (openTabs.find((t) => t.id === editingCanvasId)?.sessionId ?? null)
		: null;

	// Persist a styling edit onto the active canvas (RFC-045); applied live via
	// the `styling` state passed to <ExplorerCanvas>.
	const handleStylingChange = useCallback(
		(next: CanvasStyling) => {
			setStyling(next);
			if (activeCanvasId && username && graphSlug) {
				void canvasesApi.update(username, graphSlug, activeCanvasId, {
					styling: next,
				});
			}
		},
		[activeCanvasId, username, graphSlug],
	);

	// Node/edge types currently on the canvas (+ their property keys) — the rows
	// the StylingPanel offers. Derived from the painted data (RFC-045).
	const styleTypes = useMemo(() => {
		const nodes = new Map<string, Set<string>>();
		const edges = new Map<string, Set<string>>();
		for (const item of canvasData) {
			const map =
				item.type === "vertex" ? nodes : item.type === "edge" ? edges : null;
			if (!map) continue;
			const label = String(item.label ?? "");
			if (!label) continue;
			const set = map.get(label) ?? new Set<string>();
			for (const k of Object.keys(item.properties ?? {})) set.add(k);
			map.set(label, set);
		}
		const toArr = (m: Map<string, Set<string>>): StyleTypeInfo[] =>
			[...m.entries()]
				.map(([name, props]) => ({ name, properties: [...props].sort() }))
				.sort((a, b) => a.name.localeCompare(b.name));
		return { nodeTypes: toArr(nodes), edgeTypes: toArr(edges) };
	}, [canvasData]);

	// Clicked node/edge id, lifted from the canvas by <InspectorSelectionBridge>.
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const selected: QueryResultItem | null = selectedId
		? (canvasData.find((i) => String(i.id) === selectedId) ?? null)
		: null;

	// "Node details" / "Edge details" context-menu items — select the element and
	// open the (default-closed) inspector so its properties show on the right.
	const handleShowDetail = useCallback(
		(id: string) => {
			setSelectedId(id);
			openInspector();
		},
		[openInspector],
	);

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

	// ── Saved canvases + tabs (RFC-043) ─────────────────────────────────────────
	// Node positions from the live canvas store, keyed by id — captured on save so
	// a canvas reopens to the exact layout it was left in.
	const capturePositions = useCallback(() => {
		const store = canvas?.layers.get<GraphLayer>("graph")?.store;
		const positions: Record<string, { x: number; y: number }> = {};
		if (!store) return positions;
		for (const item of canvasDataRef.current) {
			if (item.type !== "vertex") continue;
			const p = store.getPosition(String(item.id));
			if (p) positions[String(item.id)] = { x: p.x, y: p.y };
		}
		return positions;
	}, [canvas]);

	// Paint the Explorer canvas from a saved canvas: repaint its snapshot and seed
	// each node at its saved position (the force layout then only relaxes),
	// mirroring the node-expand seeding path. Also restores the magnet toggle.
	const paintFromCanvas = useCallback((c: Canvas) => {
		const items = c.snapshot?.items ?? [];
		setCanvasData(items);
		setSelectedId(null);
		const seed = adaptItems(items);
		for (const n of seed.nodes) {
			const p = c.positions?.[n.id];
			if (p) n.position = { x: p.x, y: p.y };
		}
		setSeedData(seed);
		if (typeof c.settings?.magnet === "boolean") setMagnet(c.settings.magnet);
		setStyling(c.styling ?? {});
	}, []);

	// Capture a downscaled banner screenshot (RFC-045), honouring the throttle
	// (RFC-047 Part A): "force" always captures; "throttle" reuses a shot younger
	// than BANNER_MIN_INTERVAL_MS (else captures a fresh one); "off" never does.
	// Successful captures update the shared last-banner refs so the per-turn state
	// capture can reuse them instead of re-extracting from PixiJS.
	const captureBannerThrottled = useCallback(
		async (mode: "force" | "throttle" | "off"): Promise<string | null> => {
			if (mode === "off") return null;
			const now = Date.now();
			if (
				mode === "throttle" &&
				lastBannerUrlRef.current &&
				now - lastBannerAtRef.current < BANNER_MIN_INTERVAL_MS
			) {
				return lastBannerUrlRef.current;
			}
			const b = await captureBanner(canvas);
			if (b) {
				lastBannerAtRef.current = now;
				lastBannerUrlRef.current = b;
			}
			return b;
		},
		[canvas],
	);

	// Persist the current view (snapshot + positions + latest query) into the
	// active canvas. Called on blur (tab switch/close — `banner:"force"`), on the
	// frequent change autosave (`banner:"off"`, cheap), and on the periodic
	// autosave (`banner:"throttle"`, RFC-047). Non-fatal on failure so tab
	// switching never blocks.
	const persistActiveCanvas = useCallback(
		async (opts?: { banner?: "force" | "throttle" | "off" }) => {
			if (!activeCanvasId || !username || !graphSlug) return;
			// Never overwrite a saved snapshot with an empty one: a reopen paints the
			// (empty) snapshot, and a blur-save of that emptiness used to wipe the
			// record for good, leaving canvases permanently blank. With nothing
			// painted there's nothing worth persisting, so skip.
			if (canvasDataRef.current.length === 0) return;
			// The base query to restore the canvas from — the latest real query, never
			// an expand/load operation turn (those don't repaint the whole canvas).
			const src = [...(activeSession?.messages ?? [])]
				.reverse()
				.find(
					(m) => m.role === "assistant" && m.sourceQuery && !m.operation,
				)?.sourceQuery;
			const banner = await captureBannerThrottled(opts?.banner ?? "force");
			try {
				await canvasesApi.update(username, graphSlug, activeCanvasId, {
					snapshot: { items: canvasDataRef.current },
					positions: capturePositions(),
					...(src ? { source_query: src } : {}),
					...(banner ? { banner } : {}),
					settings: { backend, magnet },
				});
			} catch {
				// Best-effort autosave — don't block the tab switch.
			}
		},
		[
			activeCanvasId,
			username,
			graphSlug,
			activeSession,
			capturePositions,
			captureBannerThrottled,
			backend,
			magnet,
		],
	);

	// Capture a version of the canvas after a canvas-mutating turn (RFC-047). Runs
	// on a short delay so the force layout / render settles before we snapshot the
	// positions + banner. Best-effort: a failure never disturbs the turn. Reads
	// the *ref* for the active canvas so a delayed capture targets the right one.
	const captureCanvasState = useCallback(
		(kind: CanvasStateKind, opts?: { messageId?: string }) => {
			setTimeout(async () => {
				const canvasId = activeCanvasIdRef.current;
				const items = canvasDataRef.current;
				if (!canvasId || !username || !graphSlug || items.length === 0) return;
				const nodeCount = items.filter((i) => i.type === "vertex").length;
				const edgeCount = items.length - nodeCount;
				const verb =
					kind === "query"
						? "Ran query"
						: kind === "expand"
							? "Expanded neighbours"
							: "Loaded result";
				const label = `${verb} — ${nodeCount} nodes, ${edgeCount} edges`;
				const src = [...(activeSession?.messages ?? [])]
					.reverse()
					.find(
						(m) => m.role === "assistant" && m.sourceQuery && !m.operation,
					)?.sourceQuery;
				// Reuse the throttled full-size banner but store a much smaller
				// thumbnail for the history timeline (RFC-047 storage optimisation) —
				// a cheap re-downscale, no extra PixiJS extract.
				const full = await captureBannerThrottled("throttle");
				const banner = full
					? await downscaleDataUrl(full, STATE_THUMB_MAX_EDGE)
					: null;
				try {
					await createCanvasState.mutateAsync({
						canvasId,
						body: {
							kind,
							label,
							snapshot: { items },
							positions: capturePositions(),
							...(src ? { source_query: src } : {}),
							styling,
							settings: { backend, magnet },
							...(banner ? { banner } : {}),
							node_count: nodeCount,
							edge_count: edgeCount,
							...(opts?.messageId ? { message_id: opts.messageId } : {}),
						},
					});
				} catch {
					// Best-effort history — a failed capture just skips this state.
				}
			}, 1200);
		},
		[
			username,
			graphSlug,
			activeSession,
			capturePositions,
			captureBannerThrottled,
			createCanvasState,
			styling,
			backend,
			magnet,
		],
	);

	// Open a canvas as a tab: save the outgoing one, hydrate this one, add the tab,
	// and switch the active session to its backing session (queries then belong to
	// this canvas). Paint from the snapshot — mark the session already-restored so
	// the restore effect doesn't re-run its query over our snapshot.
	const openCanvasTab = useCallback(
		async (id: string) => {
			if (id === activeCanvasId) return;
			await persistActiveCanvas();
			try {
				const c = await canvasesApi.get(
					username as string,
					graphSlug as string,
					id,
				);
				const hasSnapshot = (c.snapshot?.items?.length ?? 0) > 0;
				if (hasSnapshot) {
					// Painted from a real snapshot → mark restored so the restore effect
					// doesn't re-run the query over it.
					paintFromCanvas(c);
					restoredRef.current = c.sessionId;
				} else {
					// Empty snapshot: seeding the canvas empty and then repainting from
					// the restore re-run is a double re-seed (setData([]) → setData(full))
					// that crashes the PixiJS WebGPU renderer. Restore selection/styling
					// only — leave the GraphLayer seed untouched — and let the restore
					// effect paint the base query in a single pass (heals canvases saved
					// blank before autosave existed).
					setSelectedId(null);
					setCanvasData([]);
					if (typeof c.settings?.magnet === "boolean")
						setMagnet(c.settings.magnet);
					setStyling(c.styling ?? {});
					restoredRef.current = null;
				}
				setOpenTabs((tabs) =>
					tabs.some((t) => t.id === id)
						? tabs
						: [...tabs, { id, sessionId: c.sessionId }],
				);
				openSession(c.sessionId);
			} catch {
				toast.error("Failed to open canvas.");
			}
		},
		[
			activeCanvasId,
			persistActiveCanvas,
			username,
			graphSlug,
			paintFromCanvas,
			openSession,
		],
	);

	// Opening a session from the list opens (and paints) its 1:1 canvas if it
	// isn't already a tab, so the canvas area follows the session you pick. If the
	// canvas is already the active tab, just focus the thread; a session with no
	// canvas yet falls back to the plain thread (the restore effect repaints).
	const handleOpenSession = useCallback(
		(sessionId: string) => {
			const existing = openTabs.find((t) => t.sessionId === sessionId);
			if (existing) {
				if (existing.id === activeCanvasId) openSession(sessionId);
				else void openCanvasTab(existing.id);
				return;
			}
			const canvas = canvasList?.items.find((c) => c.sessionId === sessionId);
			if (canvas) void openCanvasTab(canvas.id);
			else openSession(sessionId);
		},
		[openTabs, activeCanvasId, canvasList, openCanvasTab, openSession],
	);

	// "+" — a blank canvas: create a fresh session + a canvas backed by it, clear
	// the painted graph, open it as the active tab, and make its session active so
	// the composer's next query belongs to this canvas.
	const newCanvasTab = useCallback(async () => {
		if (!username || !graphSlug) return;
		await persistActiveCanvas();
		try {
			const session = await sessionsApi.create(username, graphSlug, {});
			const created = await createCanvas.mutateAsync({
				session_id: session.id,
				snapshot: { items: [] },
				settings: { backend, magnet },
			});
			setCanvasData([]);
			setSelectedId(null);
			setSeedData({ nodes: [], edges: [] });
			setStyling({});
			setOpenTabs((tabs) => [
				...tabs,
				{ id: created.id, sessionId: session.id },
			]);
			restoredRef.current = session.id;
			refresh();
			openSession(session.id);
		} catch (err) {
			toast.error(
				err instanceof ApiError ? err.message : "Failed to create canvas.",
			);
		}
	}, [
		username,
		graphSlug,
		persistActiveCanvas,
		createCanvas,
		backend,
		magnet,
		refresh,
		openSession,
	]);

	// Close a tab (does NOT delete the canvas). If it was active, save it and fall
	// back to the last remaining tab, or clear the canvas when none are left.
	const closeCanvasTab = useCallback(
		async (id: string) => {
			const tab = openTabs.find((t) => t.id === id);
			if (!tab) return;
			const wasActive = tab.sessionId === activeSessionId;
			if (wasActive) await persistActiveCanvas();
			const remaining = openTabs.filter((t) => t.id !== id);
			setOpenTabs(remaining);
			if (!wasActive) return;
			const next = remaining[remaining.length - 1];
			if (next) {
				void openCanvasTab(next.id);
			} else {
				setCanvasData([]);
				setSelectedId(null);
				setSeedData({ nodes: [], edges: [] });
				backToList();
			}
		},
		[openTabs, activeSessionId, persistActiveCanvas, openCanvasTab, backToList],
	);

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
			// Tag the expand with the active session so the engine logs it as a turn
			// in that session's thread (RFC-046). No session → just paints, no log.
			const tagged = activeSessionId
				? ({
						...req,
						body: { ...req.body, session_id: activeSessionId },
					} as ExpandRequest)
				: req;
			try {
				const res = await expand.mutateAsync(tagged);
				handleExpandResult(res);
				if (res.returned === 0) {
					toast.info("No more neighbours to load.");
				} else {
					// The canvas grew — capture a version (RFC-047).
					captureCanvasState("expand");
					if (activeSessionId) {
						// The engine recorded an expand turn — refetch the thread so it shows.
						refresh();
					}
				}
				return res;
			} catch {
				toast.error("Failed to load neighbours.");
				return null;
			}
		},
		[expand, handleExpandResult, activeSessionId, refresh, captureCanvasState],
	);

	// Active model schema drives the expand submenus + fine-tune pickers, and the
	// read-only model browser (SchemaBrowser) docked under `?settings=model`.
	const { data: activeVersion, isLoading: activeVersionLoading } =
		useActiveVersionQuery(username, graphSlug);
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

	// Explicit "Load to canvas" click (RFC-046): paint, then log a `load` turn in
	// the thread referencing the query that produced the result. Only the click
	// logs — the automatic paints (session create / restore) call
	// `handleLoadToCanvas` directly and stay silent.
	const handleLoadToCanvasClick = useCallback(
		(result: QueryResponse, message: SessionMessage) => {
			handleLoadToCanvas(result);
			if (result.result_type !== "graph") return;
			void recordLoad({
				kind: "load",
				source_query: message.sourceQuery,
				query_language: message.language,
				row_count: result.row_count,
				node_count: result.data?.nodes.length ?? 0,
				edge_count: result.data?.edges.length ?? 0,
				execution_time_ms: result.execution_time_ms,
			});
			// Capture the loaded canvas as a version (RFC-047).
			captureCanvasState("load", { messageId: message.id });
		},
		[handleLoadToCanvas, recordLoad, captureCanvasState],
	);

	// Sessions we've already spun a canvas for, so the two triggers below (session
	// created, then result returned) create exactly one canvas. A ref, not state,
	// so the guard is synchronous across a single run's two calls.
	const canvasedSessionsRef = useRef<Set<string>>(new Set());

	// A newly-started session gets its own canvas (RFC-043): create a canvas backed
	// by that session (the engine copies its title + latest query) and open it as
	// the active tab, then paint the result once it lands. Called first the moment
	// the session is created — so the canvas shows up named after the session right
	// away, before the query returns — and again when the result arrives (to paint
	// it). Idempotent per session via `canvasedSessionsRef`. Mirrors "+" (blank
	// canvas) for the composer-driven path — starting a session starts a canvas.
	const openCanvasForNewSession = useCallback(
		async (sessionId: string, result: QueryResponse | null) => {
			if (!username || !graphSlug) return;
			if (result) {
				handleLoadToCanvas(result);
				// First paint of the new session's canvas — capture it as the opening
				// version (RFC-047). The canvas tab registers below; the delayed
				// capture reads the (by-then active) canvas from the ref.
				captureCanvasState("query");
			}
			if (canvasedSessionsRef.current.has(sessionId)) return;
			if (openTabs.some((t) => t.sessionId === sessionId)) return;
			canvasedSessionsRef.current.add(sessionId);
			try {
				const created = await createCanvas.mutateAsync({
					session_id: sessionId,
					snapshot: { items: resultToItems(result) },
					settings: { backend, magnet },
				});
				setOpenTabs((tabs) =>
					tabs.some((t) => t.sessionId === sessionId)
						? tabs
						: [...tabs, { id: created.id, sessionId }],
				);
			} catch {
				// Non-fatal — e.g. the session already has a canvas (409). Drop the
				// guard so a later trigger can retry. The thread still renders; the
				// user can Save view manually.
				canvasedSessionsRef.current.delete(sessionId);
			}
		},
		[
			username,
			graphSlug,
			handleLoadToCanvas,
			openTabs,
			createCanvas,
			backend,
			magnet,
			captureCanvasState,
		],
	);

	const handleRun = async (payload: QueryRunPayload) => {
		if (setupIncomplete) {
			toast.error(
				"Finish the setup wizard (Graph Info + Intent) before running queries.",
			);
			return;
		}
		let messageId: string | null = null;
		// A run with no active session creates one; detect that so we can spin up a
		// canvas tab for the new session below.
		const priorSessionId = activeSessionId;
		let newSessionId: string | null = null;
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
				const {
					sessionId,
					messageId: mid,
					result,
				} = await send(payload, {
					// The session exists now — open its canvas immediately (named after
					// the session) so it's there while the query runs, not only after.
					onSessionCreated: (s) => void openCanvasForNewSession(s.id, null),
				});
				restoredRef.current = sessionId;
				messageId = mid;
				if (sessionId && sessionId !== priorSessionId) newSessionId = sessionId;
				return result;
			},
		);
		if (messageId) setResultFor(messageId, result);
		// The canvas was created on session-create above; this second call paints the
		// result onto it (the idempotent guard skips re-creating).
		if (newSessionId) void openCanvasForNewSession(newSessionId, result);
	};

	// `rerun` re-issues a stored message's query — triggered by clicking a message
	// (`rerun`) or by the session-restore effect (`restore`). Both are traced and
	// store the result inline against that message.
	const handleRerun = useCallback(
		async (messageId: string, trigger: "rerun" | "restore" = "rerun") => {
			const result = await runTraced(trigger, {}, () => rerun(messageId));
			setResultFor(messageId, result);
			// Opening a session should show its graph: when the restore path runs
			// because the saved snapshot was empty, paint the re-run result onto the
			// canvas. A manual re-run still just renders inline (Load to canvas).
			if (trigger === "restore" && result) paintCanvas(result);
		},
		[runTraced, rerun, setResultFor, paintCanvas],
	);

	// Re-run the latest query-bearing message when a session is opened, to
	// restore its canvas (RFC-024 Decision 10 — metadata-only, re-run to view).
	useEffect(() => {
		if (!activeSession) {
			restoredRef.current = null;
			return;
		}
		if (restoredRef.current === activeSession.id) return;
		// Restore from the latest real query, skipping expand/load operation turns
		// (they don't repaint the whole canvas — re-running one would drop the base
		// graph, RFC-046).
		const latest = [...activeSession.messages]
			.reverse()
			.find((m) => m.role === "assistant" && m.sourceQuery && !m.operation);
		if (!latest) return;
		restoredRef.current = activeSession.id;
		void handleRerun(latest.id, "restore");
	}, [activeSession, handleRerun]);

	// Autosave the live canvas (snapshot + positions) shortly after it changes, so
	// a query result and every node-expand survive a reopen — the record used to
	// be written only on tab blur, so anything built up in a single sitting was
	// lost. Debounced to coalesce rapid expands, and banner-less to stay cheap
	// (the periodic + blur saves refresh the banner).
	useEffect(() => {
		if (!activeCanvasId || canvasData.length === 0) return;
		const t = setTimeout(
			() => void persistActiveCanvas({ banner: "off" }),
			800,
		);
		return () => clearTimeout(t);
	}, [canvasData, activeCanvasId, persistActiveCanvas]);

	// Periodic autosave (RFC-047 Part A): every ~10s while a canvas is open, save
	// with a throttled banner so the sessions-list preview stays current — not
	// only on blur. Also catches layout-only changes (node drags) the change
	// effect above misses (it keys on `canvasData`, not live positions).
	useEffect(() => {
		if (!activeCanvasId) return;
		const t = setInterval(() => {
			if (canvasDataRef.current.length === 0) return;
			void persistActiveCanvas({ banner: "throttle" });
		}, BANNER_MIN_INTERVAL_MS);
		return () => clearInterval(t);
	}, [activeCanvasId, persistActiveCanvas]);

	// A canvas is a session's 1:1 layer — with no session open (the list view),
	// tear the canvas down so no graph shows there. Also drops the live engine so
	// the header toolbar / status bar hide. Reopening a session remounts a fresh
	// canvas, which also sidesteps the WebGPU re-seed crash.
	useEffect(() => {
		if (activeSessionId) return;
		setCanvas(null);
		setSeedData({ nodes: [], edges: [] });
		setCanvasData([]);
		setSelectedId(null);
	}, [activeSessionId]);

	// Returning to the list (breadcrumb) closes the thread. Flush the canvas first
	// so the last edits before the debounced autosave aren't lost, then hand off to
	// the list — the effect above clears the canvas once the session deselects.
	const handleBack = useCallback(() => {
		void persistActiveCanvas({ banner: "off" });
		backToList();
	}, [persistActiveCanvas, backToList]);

	// "Go back in time" (RFC-047): fork the chosen state into a fresh session +
	// canvas (the current one is untouched), then open it as a new tab.
	const handleForkState = useCallback(
		async (stateId: string) => {
			if (!activeCanvasId) return;
			try {
				const created = await forkCanvasState.mutateAsync({
					canvasId: activeCanvasId,
					stateId,
				});
				setHistoryOpen(false);
				await openCanvasTab(created.id);
			} catch {
				toast.error("Failed to restore this state.");
			}
		},
		[activeCanvasId, forkCanvasState, openCanvasTab],
	);

	// Clicking a node/edge feeds `selectedId` via <InspectorSelectionBridge>; the
	// derived `selected` (above) drives the right-side InspectorPanel. The
	// main-section header carries the canvas tabs (RFC-043) + the canvas toolbar;
	// the canvas fills the area below.
	const canvasContent = (
		<div className="flex h-full w-full flex-col overflow-hidden">
			<CanvasTabsBar
				tabs={tabItems}
				activeId={activeCanvasId}
				onSelect={(id) => void openCanvasTab(id)}
				onClose={(id) => void closeCanvasTab(id)}
				onEdit={(id) => setEditingCanvasId(id)}
				onNew={() => void newCanvasTab()}
				isCreating={createCanvas.isPending}
				onHelp={() => setTutorialOpen(true)}
				onStyle={() => setStylingOpen((o) => !o)}
				onHistory={() => setHistoryOpen((o) => !o)}
				inspectorClosed={inspectorClosed}
				onToggleInspector={inspectorClosed ? openInspector : closeInspector}
			/>
			<div className="relative min-h-0 w-full flex-1 overflow-hidden">
				<RendererCapabilityBanner />
				<ExplorerCanvas
					data={seedData}
					onReady={handleReady}
					onViewTargetChange={setSelectedId}
					magnet={magnet}
					interactionRef={runRef}
					backend={backend}
					expand={expandHandlers}
					onShowDetail={handleShowDetail}
					styling={styling}
				/>
				<StylingPanel
					open={stylingOpen}
					onClose={() => setStylingOpen(false)}
					nodeTypes={styleTypes.nodeTypes}
					edgeTypes={styleTypes.edgeTypes}
					styling={styling}
					onChange={handleStylingChange}
				/>
				<CanvasHistoryPanel
					open={historyOpen}
					onClose={() => setHistoryOpen(false)}
					username={username}
					graphSlug={graphSlug}
					canvasId={activeCanvasId}
					onFork={(stateId) => void handleForkState(stateId)}
					isForking={forkCanvasState.isPending}
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
			<CanvasFormDialog
				open={editingCanvasId !== null}
				username={username as string}
				graphSlug={graphSlug as string}
				canvasId={editingCanvasId}
				sessionId={editingSessionId}
				sessionTitle={
					editingSessionId ? (sessionTitleById.get(editingSessionId) ?? "") : ""
				}
				onRenameSession={renameSession}
				onClose={() => setEditingCanvasId(null)}
			/>
			<SessionTutorialModal open={tutorialOpen} onClose={closeTutorial} />
		</div>
	);

	// The left rail is single-open: `?settings=model` docks the read-only model
	// browser; otherwise the page shows its Sessions panel (or a setup banner).
	const sessionsContent = connectionMissing ? (
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
			username={username}
			graphSlug={graphSlug}
			bannerCanvasIdBySession={bannerCanvasIdBySession}
			onOpenSession={handleOpenSession}
			onBack={handleBack}
			onRerun={handleRerun}
			onFetchContext={fetchContext}
			onSetFeedback={setFeedback}
			results={resultsByMessageId}
			onLoadToCanvas={handleLoadToCanvasClick}
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

	// RFC-045: Sessions is the single primary sidebar list; a session's canvas is
	// its 1:1 visual layer (painted on open), so there's no separate Canvases panel.
	const leftContent =
		settingsPanel.section === "model" ? (
			<SchemaBrowser
				version={activeVersion}
				isLoading={activeVersionLoading}
				backend={backend}
				onClose={closeSessions}
			/>
		) : (
			sessionsContent
		);

	return (
		// Lifted context: the live engine reaches the header toolbar, which lives
		// in GraphDetail's header (a sibling of <Canvas>, outside its own provider).
		<CanvasContext.Provider value={canvas}>
			<GraphDetail
				sectionId="explorer"
				pageLabel="Explorer"
				headerCenter={
					canvas && activeSessionId ? (
						// The canvas toolbar reads the live camera; it only initialises
						// correctly mounted in the app header (in the main-section tab bar
						// the camera reads null and `HeaderToolbarItems` throws). It sits
						// directly above the canvas tabs. Dead-centre it against the full
						// header width (the header nav is `relative`; see useAppHeader).
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
				// GraphDetail shows this only while `?settings=sessions` is the open
				// rail panel; otherwise it docks a settings section or nothing.
				leftSection={{
					// Generous max so long Cypher/Gremlin queries can spread out.
					// mainSection.minSize below still keeps the canvas usable when
					// the user drags the divider far right.
					defaultSize: "300px",
					minSize: "240px",
					maxSize: "900px",
					collapsible: false,
					content: leftContent,
				}}
				mainSection={{
					defaultSize: "600px",
					minSize: "300px",
					// A canvas belongs to a session — on the list view (no session open)
					// show a placeholder instead of a stray graph. Opening a session
					// mounts its canvas fresh.
					content: activeSessionId ? (
						canvasContent
					) : (
						<div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
							<Network className="h-10 w-10 opacity-20" />
							<p className="max-w-xs text-sm">
								Open a session or start a new one to see its canvas.
							</p>
						</div>
					),
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
					canvas && activeSessionId ? <CanvasStatusBar /> : null
				}
				// The shared message bar — shows whatever was last pushed via
				// Canvas.showMessage (e.g. a layout's "Running… / ready"); empty when idle.
				footerRightExtras={
					canvas && activeSessionId ? <CanvasMessageBar /> : null
				}
			/>
		</CanvasContext.Provider>
	);
}
