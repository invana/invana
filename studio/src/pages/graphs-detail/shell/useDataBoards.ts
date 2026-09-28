import { attachmentFor } from "@/pages/graphs-detail/features/assistant/SessionComposer";
import { sessionsApi } from "@/pages/graphs-detail/features/assistant/api";
import type { SessionMessage } from "@/pages/graphs-detail/features/assistant/types";
import type { useSessions } from "@/pages/graphs-detail/features/assistant/useSessions";
import {
	STATE_THUMB_MAX_EDGE,
	captureBanner,
} from "@/pages/graphs-detail/features/boards";
import { useBoardVersions } from "@/pages/graphs-detail/features/boards";
import { boardsApi } from "@/pages/graphs-detail/features/boards/api";
import { useCreateCanvasStateMutation } from "@/pages/graphs-detail/features/boards/queries";
import {
	useBoardsQuery,
	useCreateCanvasMutation,
	useUpdateCanvasMutation,
} from "@/pages/graphs-detail/features/boards/queries";
import type {
	Board,
	BoardVersionCause,
	CanvasStyling,
} from "@/pages/graphs-detail/features/boards/types";
import { boardVersionsApi } from "@/pages/graphs-detail/features/boards/versionsApi";
import {
	ACTIVE_LAYOUT_ID,
	type CanvasBackend,
	type ExpandMenuSchema,
} from "@/pages/graphs-detail/features/explorer";
import type { StyleTypeInfo } from "@/pages/graphs-detail/features/explorer";
import {
	adaptItems,
	expandRefusal,
	isCanvasStateSnapshot,
	resultToItems,
	useExpandNode,
} from "@/pages/graphs-detail/features/explorer";
import { explorerApi } from "@/pages/graphs-detail/features/explorer/api";
import { useTypeCountsQuery } from "@/pages/graphs-detail/features/explorer/queries";
import type {
	ExpandRequest,
	NeighborExpandResponse,
} from "@/pages/graphs-detail/features/explorer/types";
import type { useGraphConnectionQuery } from "@/pages/graphs-detail/features/graphs/queries";
import type { QueryLanguage } from "@/pages/graphs-detail/features/graphs/types";
import { useActiveVersionQuery } from "@/pages/graphs-detail/features/models/queries";
import { useOpenSessionRequest } from "@/pages/graphs-detail/shell/useOpenSessionRequest";
import type { useRightSection } from "@/pages/graphs-detail/shell/useRightSection";
import { ApiError } from "@/services/api/client";
import {
	type Interaction,
	measureSync,
	startAction,
} from "@/services/telemetry/tracer";
import type {
	QueryResponse,
	QueryResultItem,
	QueryRunPayload,
} from "@/types/query";
import { canUseWebGPU } from "@invana/canvas-react";
import type { GraphCanvas, GraphLayer } from "@invana/graph";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { CanvasKind as DataBoardsCanvasKind } from "@/pages/graphs-detail/features/boards";
import type { useBoardPage } from "@/pages/graphs-detail/shell/useBoardPage";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";

// Fallback when the engine hasn't reported any query languages yet (e.g. the
// connector class couldn't be loaded server-side). Studio shows both rather
// than blocking the user.
const FALLBACK_QUERY_LANGUAGES: readonly QueryLanguage[] = [
	"cypher",
	"gremlin",
];

// localStorage key persisting the user's render-backend choice across reloads.
const BACKEND_STORAGE_KEY = "explorer.canvas.backend";

// Banner capture (a GPU image export) isn't free, so it's throttled: at most one
// fresh capture per this window. Also the cadence of the periodic autosave that
// keeps the sessions-list preview current (docs/for-developers/modules/explore/features/boards.md Part A).
const BANNER_MIN_INTERVAL_MS = 10_000;

type Sessions = ReturnType<typeof useSessions>;

/** What the data canvases read from the page that hosts them. */
export interface DataBoardsDeps {
	username: string | undefined;
	graphSlug: string | undefined;
	/** The Graph's connection — which query languages its connector speaks. */
	graph: ReturnType<typeof useGraphConnectionQuery>["data"];
	sessions: Sessions["sessions"];
	activeSession: Sessions["activeSession"];
	activeSessionId: Sessions["activeSessionId"];
	send: Sessions["send"];
	rerun: Sessions["rerun"];
	recordLoad: Sessions["recordLoad"];
	openSession: Sessions["openSession"];
	backToList: Sessions["backToList"];
	refresh: Sessions["refresh"];
	threadWorldId: Sessions["world"]["threadLensId"];
	right: ReturnType<typeof useRightSection>;
	/** The canvas selection was taken off the next ask. */
	attachmentDetached: boolean;
	/** The answering gate is shut, so a natural-language ask is refused here. */
	cannotAnswer: boolean;
	openInspector: () => void;
	boardPage: ReturnType<typeof useBoardPage>;
	setActiveBoardId: Dispatch<SetStateAction<string | null>>;
	setWorkKind: Dispatch<SetStateAction<DataBoardsCanvasKind | null>>;
	/** The page's `useSessions` calls through this; the hook points it at its handler. */
	streamResultRef: MutableRefObject<
		(sessionId: string, messageId: string, result: QueryResponse) => void
	>;
}

/**
 * The data canvases — one per open session — and everything that draws on them.
 *
 * Holds the live engine and its render settings, the open tabs and which one is
 * active, what each canvas holds (through `useBoardVersions`), the autosave and
 * the version history, node expansion under the thread's world, and the ask:
 * sending it, painting the first result of a new session, re-running a reply,
 * and restoring a session's canvas when it opens. `useSessions` is the page's,
 * because the assistant reads it too; its stream lands here through
 * `streamResultRef`.
 */
export function useDataBoards(deps: DataBoardsDeps) {
	const {
		username,
		graphSlug,
		graph,
		sessions,
		activeSession,
		activeSessionId,
		send,
		rerun,
		recordLoad,
		openSession,
		backToList,
		refresh,
		threadWorldId,
		right,
		attachmentDetached,
		cannotAnswer,
		openInspector,
		boardPage,
		setActiveBoardId,
		setWorkKind,
		streamResultRef,
	} = deps;

	// Full current canvas contents — drives the Inspector (`allItems` / `selected`)
	// and the seed re-fed to a freshly-mounted canvas (e.g. on a backend remount).
	// A fresh query *replaces* it; a node-expand *appends* to it (docs/for-developers/modules/explore/features/graph-canvas.md).
	// Held per canvas by `useBoardVersions` (below), not per page — a second
	// canvas can hold its own contents at the same time. Resolved against the
	// active one, so every caller below reads and writes exactly as before.
	// Elements the graph no longer holds, found when the canvas reopened (GC5).
	// Kept as ids rather than removed from `canvasData`, because the point is that
	// they are still drawn.

	const canvasDataRef = useRef<QueryResultItem[]>([]);

	// What `<GraphLayer data>` is seeded/replaced with. Its *reference* only changes
	// on a full repaint (fresh query / load-to-canvas / restore) or a backend
	// remount — never on a node-expand, which appends straight to the live store
	// (the non-destructive path) so existing node positions survive. Re-feeding the
	// whole dataset here would call the destructive `setData`, wiping every position
	// and re-laying the graph out from the origin on each expand.

	// Per-message query results (docs/for-developers/modules/ask/features/the-answer-surface.md): transient, keyed by assistant message
	// id, populated on send/rerun and rendered inline in the thread.
	const [resultsByMessageId, setResultsByMessageId] = useState<
		Record<string, QueryResponse | null>
	>({});
	const setResultFor = useCallback(
		(messageId: string, result: QueryResponse | null) =>
			setResultsByMessageId((prev) => ({ ...prev, [messageId]: result })),
		[],
	);
	// Sessions whose first result should open + paint their new canvas, and
	// replies whose re-run result should repaint (the restore path). Registered
	// when the run starts; consumed when the result lands on the stream.
	const pendingNewSessionsRef = useRef<Set<string>>(new Set());
	const pendingRestorePaintRef = useRef<Set<string>>(new Set());

	// Root span for the in-flight query run (docs/for-developers/modules/platform/features/telemetry.md). Held in a ref so the
	// transform / adapt / layout / render stages — which span several async
	// renders — all attach to the same trace. Set in `handleRun`, closed by the
	// canvas's layout bridge after the first painted frame.
	const runRef = useRef<Interaction | null>(null);

	// The live canvas engine, lifted out of <Board> by <CanvasBridge>. Null until
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

	// Toggling the left column no longer remounts the canvas: GraphDetail keeps the
	// main (canvas) panel mounted at a stable position and renders the sidebar as a
	// conditional sibling, so the live store — positions and all — survives a panel
	// open/close. No reseed is needed here (an unconditional reseed would itself
	// re-feed `<GraphLayer data>` and force a destructive relayout on every toggle,
	// which is exactly the jump this avoids). Only genuine remounts — the
	// backend switch above, which keys `ExplorerCanvas` on `backend` — reseed.

	// Open canvas tabs (docs/for-developers/modules/explore/features/boards.md) — the main-section tab strip. Each tab is a
	// canvas backed 1:1 by a session; a tab is "active" when its backing session
	// is the active query session, so switching tabs switches the session too and
	// new queries belong to that canvas. `activeCanvasId` is therefore derived.
	// A tab is a canvas bound 1:1 to a session; its label is the session's title
	// (docs/for-developers/modules/explore/features/graph-canvas.md), read live from `sessionTitleById` — so the tab holds no title of
	// its own.
	const [openTabs, setOpenTabs] = useState<{ id: string; sessionId: string }[]>(
		[],
	);
	const createCanvas = useCreateCanvasMutation(username ?? "", graphSlug ?? "");
	// Version history (docs/for-developers/modules/explore/features/boards.md): capture a state after each canvas-mutating turn,
	// and fork a chosen state into a new canvas to "go back in time".
	const createCanvasState = useCreateCanvasStateMutation(
		username ?? "",
		graphSlug ?? "",
	);
	// Used to refresh a canvas' sessions-list banner (and invalidate its cached
	// preview) whenever we capture a new history state — so the banner always
	// shows the latest image (docs/for-developers/modules/explore/features/boards.md).
	const updateCanvas = useUpdateCanvasMutation(username ?? "", graphSlug ?? "");
	const [isRestoring, setIsRestoring] = useState(false);
	// Session tutorial (docs/for-developers/modules/explore/features/graph-canvas.md) — auto-open once on a user's first session,
	// reopenable from the "?" in the canvas header.
	// Per-type styling (docs/for-developers/modules/explore/features/graph-canvas.md) for the active canvas — hydrated from it on open,
	// edited in the StylingPanel, applied live by the renderer + persisted.
	// Board list — used to resolve an existing session's canvas when opening it
	// from the sessions list (`handleOpenSession`). Titles/purposes for the tabs
	// and edit dialog come from the session + a direct canvas fetch, not this.
	const { data: canvasList } = useBoardsQuery(username, graphSlug, {
		limit: 100,
		includeArchived: true,
	});
	const activeCanvasId =
		openTabs.find((t) => t.sessionId === activeSessionId)?.id ?? null;

	// Board contents, per canvas. The five values and five setters below are the
	// ones the page has always used — `useBoardVersions` just resolves them
	// against the active canvas instead of holding one canvas's worth for the
	// whole page (the-shell.md).
	const {
		items: canvasData,
		seed: seedData,
		styling,
		selectedId,
		missingIds,
		setItems: setCanvasData,
		setSeed: setSeedData,
		setStyling,
		setSelectedId,
		setMissingIds,
		forget: forgetCanvasState,
	} = useBoardVersions(activeCanvasId);

	// Switching the backend remounts the canvas (ExplorerCanvas keys on `backend`),
	// which rebuilds the store from the GraphLayer seed. Reseed with the full
	// current contents first — including node-expand additions, which were appended
	// straight to the store and so aren't in the paint-only `seedData` — so nothing
	// is lost across the switch.
	const setBackend = useCallback(
		(b: CanvasBackend) => {
			localStorage.setItem(BACKEND_STORAGE_KEY, b);
			setSeedData(adaptItems(canvasDataRef.current));
			setBackendState(b);
		},
		[setSeedData],
	);

	// Mirror the active canvas's contents in a ref so the imperative expand path
	// and the backend-remount reseed read the latest without re-deriving the seed.
	useEffect(() => {
		canvasDataRef.current = canvasData;
	}, [canvasData]);
	// Mirror in a ref so the delayed state-capture (which runs after the canvas
	// settles) reads the canvas that's active *now*, not the one closed over when
	// the turn fired.
	const activeCanvasIdRef = useRef<string | null>(null);
	useEffect(() => {
		activeCanvasIdRef.current = activeCanvasId;
	}, [activeCanvasId]);
	// Throttle banner capture (docs/for-developers/modules/explore/features/boards.md Part A): the last capture's timestamp + URL,
	// so the periodic autosave and per-turn state-capture can reuse a fresh shot
	// instead of re-extracting from PixiJS on every save.
	const lastBannerAtRef = useRef(0);
	const lastBannerUrlRef = useRef<string | null>(null);
	// sessionId → boardId for canvases that have a banner screenshot (docs/for-developers/modules/explore/features/graph-canvas.md),
	// so the Sessions list can show each session's canvas preview above its title.
	// Only bannered canvases are mapped; their rows lazy-fetch the (heavy) image.
	const bannerCanvasIdBySession = useMemo(() => {
		const m = new Map<string, string>();
		for (const c of canvasList?.items ?? []) {
			if (c.hasBanner) m.set(c.sessionId, c.id);
		}
		return m;
	}, [canvasList]);
	// A session's title is the single name for it and its 1:1 canvas (docs/for-developers/modules/explore/features/graph-canvas.md):
	// the breadcrumb and the canvas tab show the same session title, so there's no
	// separate canvas name to keep in sync. `activeSession` is the freshest source
	// for the open thread (e.g. right after a rename); the list covers the rest.
	const sessionTitleById = useMemo(() => {
		const m = new Map<string, string>();
		for (const s of sessions) m.set(s.id, s.title);
		if (activeSession) m.set(activeSession.id, activeSession.title);
		return m;
	}, [sessions, activeSession]);
	// The session behind the tab being edited (its title is what the edit dialog
	// renames). Read from `openTabs` — always present for an open tab, unlike the
	// canvas list cache which can lag a freshly created canvas.

	// Persist a styling edit onto the active canvas (docs/for-developers/modules/explore/features/graph-canvas.md); applied live via
	// the `styling` state passed to <ExplorerCanvas>.
	const handleStylingChange = useCallback(
		(next: CanvasStyling) => {
			setStyling(next);
			if (activeCanvasId && username && graphSlug) {
				void boardsApi.update(username, graphSlug, activeCanvasId, {
					styling: next,
				});
			}
		},
		[activeCanvasId, username, graphSlug, setStyling],
	);

	// Node/edge types currently on the canvas (+ their property keys) — the rows
	// the StylingPanel offers. Derived from the painted data (docs/for-developers/modules/explore/features/graph-canvas.md).
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
		[openInspector, setSelectedId],
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

	const paintCanvas = useCallback(
		(result: QueryResponse | null) => {
			if (result?.result_type !== "graph" || !result.data) return;
			const data = result.data;
			// `explorer.transform` span (docs/for-developers/modules/platform/features/telemetry.md) — time the dedupe of query results
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
				// `explorer.adapt` span (docs/for-developers/modules/platform/features/telemetry.md) — time mapping results to GraphData.
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
		},
		[setCanvasData, setSeedData, setSelectedId],
	);

	// ── Saved canvases + tabs (docs/for-developers/modules/explore/features/boards.md) ─────────────────────────────────────────
	// Node positions from the live canvas store, keyed by id — captured on save so
	// a canvas reopens to the exact layout it was left in.
	const capturePositions = useCallback(() => {
		const store = canvas?.layers.get<GraphLayer>("graph")?.store;
		const positions: Record<string, { x: number; y: number }> = {};
		if (!store) return positions;
		// Iterate the live store (source of truth for what's painted) rather than
		// canvasData, which can lag/diverge across restore + backend remount.
		for (const n of store.nodes()) {
			const p = store.getPosition(String(n.id));
			if (p) positions[String(n.id)] = { x: p.x, y: p.y };
		}
		return positions;
	}, [canvas]);

	// The items actually painted on the live canvas, reconstructed from the
	// GraphLayer store. `adaptItems` maps a QueryResultItem's label→node.type and
	// properties→node.data, so this is the exact inverse. Used as the source of
	// truth for saves, because canvasData can go stale (e.g. a canvas restored by
	// re-running its base query paints the store but leaves canvasData empty).
	const itemsFromStore = useCallback((): QueryResultItem[] => {
		const store = canvas?.layers.get<GraphLayer>("graph")?.store;
		if (!store || store.nodeCount() === 0) return [];
		const items: QueryResultItem[] = [];
		for (const n of store.nodes()) {
			items.push({
				id: String(n.id),
				type: "vertex",
				label: typeof n.type === "string" ? n.type : "",
				properties: (n.data as Record<string, unknown>) ?? {},
			});
		}
		for (const e of store.edges()) {
			items.push({
				id: String(e.id),
				type: "edge",
				label: typeof e.type === "string" ? e.type : "",
				source: String(e.source),
				target: String(e.target),
				properties: (e.data as Record<string, unknown>) ?? {},
			});
		}
		return items;
	}, [canvas]);

	// Paint the Explorer canvas from a saved canvas: repaint its snapshot and seed
	// each node at its saved position (the force layout then only relaxes),
	// mirroring the node-expand seeding path. Also restores the magnet toggle.
	//
	// The snapshot is checked against the graph **under the picked world** before
	// anything is drawn (graph-canvas.md GC14). What is gone is kept and marked
	// missing (GC5); what the world excludes comes back in neither list and is
	// simply not drawn — the canvas is never told why. The saved snapshot is
	// untouched, so clearing the world brings it back.
	const paintFromCanvas = useCallback(
		(c: Board) => {
			const saved = c.snapshot?.items ?? [];
			setSelectedId(null);
			if (typeof c.settings?.magnet === "boolean") setMagnet(c.settings.magnet);
			setStyling(c.styling ?? {});

			const paint = (items: QueryResultItem[], missing: string[]) => {
				setCanvasData(items);
				const seed = adaptItems(items);
				for (const n of seed.nodes) {
					const p = c.positions?.[n.id];
					if (p) n.position = { x: p.x, y: p.y };
				}
				setSeedData(seed);
				setMissingIds(new Set(missing));
				if (missing.length > 0)
					toast.warning(
						`${missing.length} element${missing.length === 1 ? "" : "s"} on this canvas ${
							missing.length === 1 ? "is" : "are"
						} no longer in the graph — kept and marked.`,
					);
			};

			const vertexIds = saved
				.filter((i) => i.type === "vertex")
				.map((i) => String(i.id));
			if (!username || !graphSlug || vertexIds.length === 0) {
				paint(saved, []);
				return;
			}
			const lensId = threadWorldId;
			void explorerApi
				.resolveElements(username, graphSlug, vertexIds, lensId)
				.then(({ present, missing }) => {
					const kept = new Set([...present, ...missing]);
					paint(
						saved.filter((i) =>
							i.type === "vertex"
								? kept.has(String(i.id))
								: kept.has(String(i.source)) && kept.has(String(i.target)),
						),
						missing,
					);
				})
				.catch(() => {
					// A connection that is down does not make the drawing wrong — but
					// under a world it cannot be checked, and an unchecked snapshot
					// could show what the world excludes, so nothing is drawn.
					if (lensId) {
						paint([], []);
						toast.error("This canvas could not be checked against the world.");
					} else {
						paint(saved, []);
					}
				});
		},
		[
			username,
			graphSlug,
			threadWorldId,
			setCanvasData,
			setSeedData,
			setStyling,
			setSelectedId,
			setMissingIds,
		],
	);

	// Capture a downscaled banner screenshot (docs/for-developers/modules/explore/features/graph-canvas.md), honouring the throttle
	// (docs/for-developers/modules/explore/features/boards.md Part A): "force" always captures; "throttle" reuses a shot younger
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
			const b = captureBanner(canvas);
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
	// autosave (`banner:"throttle"`, docs/for-developers/modules/explore/features/boards.md). Non-fatal on failure so tab
	// switching never blocks.
	const persistActiveCanvas = useCallback(
		async (opts?: { banner?: "force" | "throttle" | "off" }) => {
			if (!activeCanvasId || !username || !graphSlug) return;
			// Source of truth for what's painted: canvasData, falling back to the live
			// store when they've diverged (a canvas restored by re-running its base
			// query paints the store but leaves canvasData empty). Never overwrite a
			// saved snapshot with an empty one — with nothing painted there's nothing
			// worth persisting, so skip.
			const items =
				canvasDataRef.current.length > 0
					? canvasDataRef.current
					: itemsFromStore();
			if (items.length === 0) return;
			// The base query to restore the canvas from — the latest real query, never
			// an expand/load operation turn (those don't repaint the whole canvas).
			const src = [...(activeSession?.messages ?? [])]
				.reverse()
				.find(
					(m) => m.role === "assistant" && m.sourceQuery && !m.operation,
				)?.sourceQuery;
			const banner = await captureBannerThrottled(opts?.banner ?? "force");
			try {
				await boardsApi.update(username, graphSlug, activeCanvasId, {
					snapshot: { items },
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
			itemsFromStore,
			backend,
			magnet,
		],
	);

	// Capture a version of the canvas after a canvas-mutating turn (docs/for-developers/modules/explore/features/boards.md). Runs
	// on a short delay so the force layout / render settles before we snapshot the
	// positions + banner. Best-effort: a failure never disturbs the turn. Reads
	// the *ref* for the active canvas so a delayed capture targets the right one.
	const captureCanvasState = useCallback(
		(
			kind: BoardVersionCause,
			opts?: { messageId?: string; immediate?: boolean },
		): Promise<{ ok: true } | { ok: false; reason: string }> => {
			// Auto-captures wait for the force layout / render to settle; a manual
			// save (immediate) fires now — the canvas is already settled.
			const delay = opts?.immediate ? 0 : 1200;
			return new Promise((resolve) => {
				setTimeout(async () => {
					const boardId = activeCanvasIdRef.current;
					if (!boardId || !username || !graphSlug) {
						return resolve({ ok: false, reason: "No active canvas." });
					}
					if (!canvas) {
						return resolve({
							ok: false,
							reason: "Board isn't ready yet — try again in a moment.",
						});
					}
					// Count straight from the live store — the source of truth for what's
					// painted (canvasData can lag/diverge across restore + remount).
					const store = canvas.layers.get<GraphLayer>("graph")?.store;
					const nodeCount = store?.nodeCount() ?? 0;
					const edgeCount = store?.edgeCount() ?? 0;
					if (nodeCount === 0) {
						return resolve({
							ok: false,
							reason: "Nothing painted on the canvas to save.",
						});
					}
					// The faithful, engine-native snapshot (camera / styling / positions /
					// layer data) — restored later via `canvas.importState`.
					if (typeof canvas.exportState !== "function") {
						return resolve({
							ok: false,
							reason:
								"This canvas build can't export state (update @invana/canvas).",
						});
					}
					let snapshot: Record<string, unknown>;
					try {
						snapshot = canvas.exportState() as unknown as Record<
							string,
							unknown
						>;
					} catch (e) {
						console.error("[canvas-state] exportState() threw", e);
						return resolve({
							ok: false,
							reason: "Couldn't snapshot the canvas — see console.",
						});
					}
					const verb =
						kind === "query"
							? "Ran query"
							: kind === "expand"
								? "Expanded neighbours"
								: kind === "load"
									? "Loaded result"
									: "Saved snapshot";
					const label = `${verb} — ${nodeCount} nodes, ${edgeCount} edges`;
					const src = [...(activeSession?.messages ?? [])]
						.reverse()
						.find(
							(m) => m.role === "assistant" && m.sourceQuery && !m.operation,
						)?.sourceQuery;
					// A small, self-contained thumbnail for the history timeline (docs/for-developers/modules/explore/features/boards.md
					// storage optimisation) — the engine's export sizes it directly via
					// maxSize, so no separate downscale step.
					const banner = captureBanner(canvas, STATE_THUMB_MAX_EDGE);
					try {
						await createCanvasState.mutateAsync({
							boardId,
							body: {
								cause: kind,
								label,
								// Engine-native state (positions live inside it, so no separate
								// `positions`); restored via importState.
								snapshot,
								...(src ? { source_query: src } : {}),
								styling,
								settings: { backend, magnet },
								...(banner ? { banner } : {}),
								node_count: nodeCount,
								edge_count: edgeCount,
								...(opts?.messageId ? { message_id: opts.messageId } : {}),
							},
						});
						resolve({ ok: true });
					} catch (e) {
						console.error("[canvas-state] save failed", e);
						resolve({ ok: false, reason: "Failed to save — see console." });
						return;
					}
					// History just changed → refresh the canvas' sessions-list banner to
					// this same (latest) capture, and invalidate its cached preview so the
					// list shows it immediately. Best-effort, non-blocking.
					const listBanner = captureBanner(canvas);
					if (listBanner) {
						updateCanvas
							.mutateAsync({ id: boardId, data: { banner: listBanner } })
							.catch(() => {});
					}
				}, delay);
			});
		},
		[
			username,
			graphSlug,
			activeSession,
			canvas,
			createCanvasState,
			updateCanvas,
			styling,
			backend,
			magnet,
		],
	);

	// Explicit "Save current state" (docs/for-developers/modules/explore/features/boards.md): capture the live canvas now as a
	// `manual` state, toasting the outcome. Lets the user snapshot a good layout
	// on demand, independent of the per-turn auto-captures.
	const handleSaveState = useCallback(async () => {
		if (!activeCanvasId) return;
		const res = await captureCanvasState("manual", { immediate: true });
		if (res.ok) toast.success("Board state saved to history.");
		else toast.error(res.reason);
	}, [activeCanvasId, captureCanvasState]);

	// Open a canvas as a tab: save the outgoing one, hydrate this one, add the tab,
	// and switch the active session to its backing session (queries then belong to
	// this canvas). Paint from the snapshot — mark the session already-restored so
	// the restore effect doesn't re-run its query over our snapshot.
	const openCanvasTab = useCallback(
		async (id: string) => {
			if (id === activeCanvasId) return;
			await persistActiveCanvas();
			try {
				const c = await boardsApi.get(
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
			setCanvasData,
			setStyling,
			setSelectedId,
		],
	);

	// Opening a session opens its 1:1 canvas and makes it the active page (G45):
	// an open tab is focused, a closed one is loaded, and a session with no canvas
	// yet gets one created — the restore effect then paints its last query.
	// Whatever page was in front steps behind it; nothing is closed.
	const handleOpenSession = useCallback(
		(sessionId: string) => {
			setActiveBoardId(null);
			boardPage.setPageId(null);
			setWorkKind(null);
			const existing = openTabs.find((t) => t.sessionId === sessionId);
			if (existing) {
				if (existing.id === activeCanvasId) openSession(sessionId);
				else void openCanvasTab(existing.id);
				return;
			}
			const canvas = canvasList?.items.find((c) => c.sessionId === sessionId);
			if (canvas) {
				void openCanvasTab(canvas.id);
				return;
			}
			void (async () => {
				await persistActiveCanvas();
				try {
					const created = await createCanvas.mutateAsync({
						session_id: sessionId,
						snapshot: { items: [] },
						settings: { backend, magnet },
					});
					setSelectedId(null);
					setCanvasData([]);
					setStyling({});
					restoredRef.current = null;
					setOpenTabs((tabs) =>
						tabs.some((t) => t.id === created.id)
							? tabs
							: [...tabs, { id: created.id, sessionId }],
					);
				} catch {
					toast.error("Failed to load this session's canvas.");
				}
				openSession(sessionId);
			})();
		},
		[
			boardPage.setPageId,
			setWorkKind,
			openTabs,
			activeCanvasId,
			canvasList,
			openCanvasTab,
			openSession,
			persistActiveCanvas,
			createCanvas,
			backend,
			magnet,
			setCanvasData,
			setStyling,
			setSelectedId,
			setActiveBoardId,
		],
	);

	// A session row in the graph info panel asks for a session by id
	// (graph-detail-page.md G22). The panel is rendered by the shell and cannot
	// reach `handleOpenSession`, so the request travels instead of the callback;
	// the page answers it exactly as it answers a row in the assistant's own
	// list, then clears it so one ask opens one session.
	const { request: openSessionRequest, clear: clearOpenSessionRequest } =
		useOpenSessionRequest();
	useEffect(() => {
		if (!openSessionRequest) return;
		handleOpenSession(openSessionRequest.sessionId);
		clearOpenSessionRequest();
	}, [openSessionRequest, handleOpenSession, clearOpenSessionRequest]);

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
		setCanvasData,
		setSeedData,
		setStyling,
		setSelectedId,
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
			// The canvas is gone, so its contents are too — otherwise the record
			// keeps every canvas the session ever opened.
			forgetCanvasState(id);
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
		[
			openTabs,
			activeSessionId,
			persistActiveCanvas,
			openCanvasTab,
			backToList,
			forgetCanvasState,
			setCanvasData,
			setSeedData,
			setSelectedId,
		],
	);

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

	// Session whose canvas is already painted — skip the auto-restore effect for
	// it (a fresh send already painted; reopening another session restores it).
	const restoredRef = useRef<string | null>(null);
	// Sessions whose board we have already tried to paint from. The restore
	// effect below opens the board first and re-runs only when that left the
	// canvas empty; without this the same tab would be opened forever and the
	// heal path (CV16) would never be reached.
	const snapshotTriedRef = useRef<Set<string>>(new Set());

	// Explicit projection of a graph result onto the canvas (docs/for-developers/modules/ask/features/the-answer-surface.md). Opens its
	// own canvas-render trace; the canvas bridge closes it after the painted frame
	// (the same mechanism the old auto-paint used).
	const handleLoadToCanvas = useCallback(
		(result: QueryResponse) => {
			// `ui.explorer.load` spans transform → adapt → layout → render; the
			// canvas bridge ends it after the first painted frame.
			runRef.current = startAction("explorer", "load", {
				"invana.graph": `${username}/${graphSlug}`,
			});
			paintCanvas(result);
		},
		[paintCanvas, username, graphSlug],
	);

	// Explicit "Load to canvas" click (docs/for-developers/modules/explore/features/boards.md): paint, then log a `load` turn in
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
			// Capture the loaded canvas as a version (docs/for-developers/modules/explore/features/boards.md).
			void captureCanvasState("load", { messageId: message.id });
		},
		[handleLoadToCanvas, recordLoad, captureCanvasState],
	);

	// Sessions we've already spun a canvas for, so the two triggers below (session
	// created, then result returned) create exactly one canvas. A ref, not state,
	// so the guard is synchronous across a single run's two calls.
	const canvasedSessionsRef = useRef<Set<string>>(new Set());

	// A newly-started session gets its own canvas (docs/for-developers/modules/explore/features/boards.md): create a canvas backed
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
				// version (docs/for-developers/modules/explore/features/boards.md). The canvas tab registers below; the delayed
				// capture reads the (by-then active) canvas from the ref.
				void captureCanvasState("query");
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

	const handleRun = async (incoming: QueryRunPayload) => {
		// The attachment goes into the ask itself, in words, rather than as a
		// hidden context field: what the thread records has to be what was asked
		// (docs/for-developers/modules/ask/features/the-assistant.md AD2).
		// Removing the chip removes the line — asked without it, and the thread
		// shows that too.
		const attached =
			right.is("assistant") && !attachmentDetached
				? attachmentFor(selected)
				: null;
		const payload: QueryRunPayload =
			attached && incoming.mode === "nl"
				? {
						...incoming,
						query: `${incoming.query}\n\n(About ${attached.kind} ${attached.label}.)`,
					}
				: incoming;
		if (cannotAnswer && incoming.mode === "nl") {
			toast.error(
				"This graph has no LLM provider yet — add one and ping it before asking.",
			);
			return;
		}
		// A run with no active session creates one; detect that so the first
		// result paints onto the new session's canvas when it lands.
		const priorSessionId = activeSessionId;
		// One trace from this click to the run's terminal frame: `send` passes the
		// action to its requests and to the run stream, which ends it.
		const action = startAction("assistant", "ask", {
			"invana.graph": `${username}/${graphSlug}`,
			"invana.ask.mode": payload.mode,
			...(payload.mode === "ql"
				? { "invana.ask.language": payload.language }
				: {}),
		});
		// `send` records the ask into a session (creating + opening one when none
		// is active) and opens a run. It returns as soon as the engine has
		// accepted the ask; the result arrives on the run's stream and is handled
		// by `handleStreamResult`.
		const { sessionId } = await send(payload, {
			action,
			// The session exists now — open its canvas immediately (named after the
			// session) so it's there while the query runs, not only after.
			onSessionCreated: (s) => void openCanvasForNewSession(s.id, null),
		});
		restoredRef.current = sessionId;
		if (sessionId && sessionId !== priorSessionId) {
			pendingNewSessionsRef.current.add(sessionId);
		}
	};

	// A query result landed on a run's stream (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md): render it inline
	// against its reply, and paint it when the run asked for that — the first
	// result of a new session (onto the canvas created above) or a restore.
	streamResultRef.current = (sessionId, messageId, result) => {
		setResultFor(messageId, result);
		if (pendingNewSessionsRef.current.delete(sessionId)) {
			// The canvas was created on session-create; this paints the result onto
			// it (the idempotent guard skips re-creating).
			void openCanvasForNewSession(sessionId, result);
			return;
		}
		if (pendingRestorePaintRef.current.delete(messageId)) paintCanvas(result);
	};

	// `rerun` re-issues a stored message's query — triggered by clicking a message
	// (`rerun`) or by the session-restore effect (`restore`). Both are traced and
	// store the result inline against that message.
	const handleRerun = useCallback(
		async (messageId: string, trigger: "rerun" | "restore" = "rerun") => {
			// Opening a session should show its graph: when the restore path runs
			// because the saved snapshot was empty, paint the re-run result onto the
			// canvas once it lands. A manual re-run just renders inline (Load to canvas).
			if (trigger === "restore") pendingRestorePaintRef.current.add(messageId);
			const action = startAction("assistant", "rerun", {
				"invana.graph": `${username}/${graphSlug}`,
				"invana.ask.trigger": trigger,
			});
			await rerun(messageId, action);
		},
		[rerun, username, graphSlug],
	);

	// Restore a session's canvas when it is opened — **from the record first**
	// (docs/for-developers/modules/ask/features/the-answer-surface.md AS13): the
	// board's snapshot is what was drawn, and the reply's emissions are what was
	// answered, so a reload renders both without asking the graph anything. A
	// re-run is the fallback for a board with no snapshot to paint
	// (docs/for-developers/modules/explore/features/boards.md CV16) — a board
	// saved before autosave existed — and never what a refresh does.
	useEffect(() => {
		if (!activeSession) {
			restoredRef.current = null;
			return;
		}
		if (restoredRef.current === activeSession.id) return;
		// Restore from the latest real query, skipping expand/load operation turns
		// (they don't repaint the whole canvas — re-running one would drop the base
		// graph, docs/for-developers/modules/explore/features/boards.md).
		const latest = [...activeSession.messages]
			.reverse()
			.find((m) => m.role === "assistant" && m.sourceQuery && !m.operation);
		if (!latest) return;
		// Wait for the board list rather than deciding without it — a re-run
		// started here would race the snapshot it is meant to replace.
		if (!canvasList) return;
		const board = canvasList.items.find(
			(c) => c.sessionId === activeSession.id,
		);
		if (
			board &&
			!openTabs.some((t) => t.id === board.id) &&
			!snapshotTriedRef.current.has(activeSession.id)
		) {
			// `openCanvasTab` paints the snapshot and marks the session restored; an
			// empty one leaves it unmarked, and this effect then falls through to the
			// re-run on its next pass.
			snapshotTriedRef.current.add(activeSession.id);
			void openCanvasTab(board.id);
			return;
		}
		restoredRef.current = activeSession.id;
		void handleRerun(latest.id, "restore");
	}, [activeSession, canvasList, openTabs, openCanvasTab, handleRerun]);

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

	// Periodic autosave (docs/for-developers/modules/explore/features/boards.md Part A): every ~10s while a canvas is open, save
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
	}, [activeSessionId, setCanvasData, setSeedData, setSelectedId]);

	// Returning to the list (breadcrumb) closes the thread. Flush the canvas first
	// so the last edits before the debounced autosave aren't lost, then hand off to
	// the list — the effect above clears the canvas once the session deselects.
	const handleBack = useCallback(() => {
		void persistActiveCanvas({ banner: "off" });
		backToList();
	}, [persistActiveCanvas, backToList]);

	// "Go back in time" (docs/for-developers/modules/explore/features/boards.md): fork the chosen state into a fresh session +
	// canvas (the current one is untouched). We hydrate the *live* canvas from the
	// saved engine snapshot via `canvas.importState` (faithful — camera / styling /
	// positions), then let the normal autosave persist it onto the new canvas row
	// in the standard {items} shape (so it reopens through the usual path — no
	// format drift). We deliberately don't touch `seedData` here: importState
	// mutates the store directly, and a competing setData would double-seed the
	// WebGPU renderer (a known crash).
	const handleForkState = useCallback(
		async (versionId: string) => {
			if (!activeCanvasId || !canvas || !username || !graphSlug) return;
			setIsRestoring(true);
			try {
				const state = await boardVersionsApi.get(
					username,
					graphSlug,
					activeCanvasId,
					versionId,
				);
				const session = await sessionsApi.create(username, graphSlug, {});
				const created = await createCanvas.mutateAsync({
					session_id: session.id,
					snapshot: { items: [] },
					settings: { backend, magnet },
				});
				// Hydrate the live canvas from the saved engine state. The row is
				// typed `Record<string, unknown>` because it round-trips through
				// JSON, so it is checked rather than asserted — a state written by
				// an older engine reaches us as an ordinary object, and refusing it
				// here beats throwing inside the renderer.
				if (!isCanvasStateSnapshot(state.snapshot)) {
					toast.error("That saved state is not readable by this version.");
					return;
				}
				canvas.importState(state.snapshot);
				// Sync the React mirrors to what importState painted, and adopt the new
				// tab. Mark restored so the restore effect doesn't re-run a base query
				// over the imported view. The change autosave then persists {items}.
				setSelectedId(null);
				setCanvasData(itemsFromStore());
				setStyling(state.styling ?? {});
				if (typeof state.settings?.magnet === "boolean") {
					setMagnet(state.settings.magnet);
				}
				setOpenTabs((tabs) => [
					...tabs,
					{ id: created.id, sessionId: session.id },
				]);
				restoredRef.current = session.id;
				openSession(session.id);
				refresh();
			} catch {
				toast.error("Failed to restore this state.");
			} finally {
				setIsRestoring(false);
			}
		},
		[
			activeCanvasId,
			canvas,
			username,
			graphSlug,
			createCanvas,
			backend,
			magnet,
			itemsFromStore,
			openSession,
			refresh,
			setCanvasData,
			setStyling,
			setSelectedId,
		],
	);

	return {
		resultsByMessageId,
		runRef,
		canvas,
		handleReady,
		magnet,
		toggleMagnet,
		backend,
		openTabs,
		createCanvasState,
		isRestoring,
		activeCanvasId,
		canvasData,
		seedData,
		styling,
		missingIds,
		setSelectedId,
		setBackend,
		bannerCanvasIdBySession,
		sessionTitleById,
		handleStylingChange,
		styleTypes,
		selected,
		handleShowDetail,
		availableLanguages,
		defaultLanguage,
		handleSaveState,
		openCanvasTab,
		handleOpenSession,
		newCanvasTab,
		closeCanvasTab,
		runExpand,
		expandSchema,
		propertyKeys,
		expandHandlers,
		handleLoadToCanvasClick,
		handleRun,
		handleRerun,
		handleBack,
		handleForkState,
	};
}
