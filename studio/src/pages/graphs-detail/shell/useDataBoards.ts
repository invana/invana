import { sessionsApi } from "@/pages/graphs-detail/features/assistant";
import type { useSessions } from "@/pages/graphs-detail/features/assistant";
import {
	STATE_THUMB_MAX_EDGE,
	captureBanner,
} from "@/pages/graphs-detail/features/boards";
import { useBoardVersions } from "@/pages/graphs-detail/features/boards";
import { boardsApi } from "@/pages/graphs-detail/features/boards/api";
import { useCreateCanvasStateMutation } from "@/pages/graphs-detail/features/boards/queries";
import { useUpdateCanvasMutation } from "@/pages/graphs-detail/features/boards/queries";
import type {
	Board,
	BoardVersionCause,
	CanvasStyling,
} from "@/pages/graphs-detail/features/boards/types";
import { boardVersionsApi } from "@/pages/graphs-detail/features/boards/versionsApi";
import type { CanvasBackend } from "@/pages/graphs-detail/features/explorer";
import type { StyleTypeInfo } from "@/pages/graphs-detail/features/explorer";
import {
	adaptItems,
	isCanvasStateSnapshot,
} from "@/pages/graphs-detail/features/explorer";
import { explorerApi } from "@/pages/graphs-detail/features/explorer/api";
import type { useGraphConnectionQuery } from "@/pages/graphs-detail/features/graphs/queries";
import { useOpenSessionRequest } from "@/pages/graphs-detail/shell/useOpenSessionRequest";
import type { useRightSection } from "@/pages/graphs-detail/shell/useRightSection";
import { type Interaction, measureSync } from "@/services/telemetry/tracer";
import type { QueryResponse, QueryResultItem } from "@/types/query";
import { canUseWebGPU } from "@invana/canvas-react";
import type { GraphCanvas, GraphLayer } from "@invana/graph";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useAssistantCanvasBridge } from "@/pages/graphs-detail/features/assistant";
import type { CanvasKind as DataBoardsCanvasKind } from "@/pages/graphs-detail/features/boards";
import { useCanvasTabs } from "@/pages/graphs-detail/features/boards";
import { useCanvasExpand } from "@/pages/graphs-detail/features/explorer";
import type { useBoardPage } from "@/pages/graphs-detail/shell/useBoardPage";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";

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

	// Session whose canvas is already painted — skip the auto-restore effect for
	// it (a fresh send already painted; reopening another session restores it).
	const restoredRef = useRef<string | null>(null);

	// The tabs — which canvas is open, and opening, starting and closing one.
	const {
		canvasList,
		createCanvas,
		bannerCanvasIdBySession,
		sessionTitleById,
		openCanvasTab,
		handleOpenSession,
		newCanvasTab,
		closeCanvasTab,
	} = useCanvasTabs({
		username,
		graphSlug,
		sessions,
		activeSession,
		activeSessionId,
		openSession,
		backToList,
		refresh,
		openTabs,
		setOpenTabs,
		activeCanvasId,
		restoredRef,
		persistActiveCanvas,
		paintFromCanvas,
		setCanvasData,
		setSeedData,
		setStyling,
		setSelectedId,
		forgetCanvasState,
		setMagnet,
		backend,
		magnet,
		setActiveBoardId,
		setBoardPageId: boardPage.setPageId,
		setWorkKind,
	});

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

	// Node expansion — growing the active canvas under the thread's world.
	const { runExpand, expandSchema, propertyKeys, expandHandlers } =
		useCanvasExpand({
			username,
			graphSlug,
			canvas,
			setCanvasData,
			captureCanvasState,
			activeSessionId,
			threadWorldId,
			refresh,
		});

	// The ask — sending it, and painting and restoring what it returns.
	const {
		resultsByMessageId,
		availableLanguages,
		defaultLanguage,
		handleLoadToCanvasClick,
		handleRun,
		handleRerun,
	} = useAssistantCanvasBridge({
		username,
		graphSlug,
		graph,
		activeSession,
		activeSessionId,
		send,
		rerun,
		recordLoad,
		assistantOpen: right.is("assistant"),
		attachmentDetached,
		cannotAnswer,
		selected,
		streamResultRef,
		runRef,
		paintCanvas,
		captureCanvasState,
		openTabs,
		setOpenTabs,
		createCanvas,
		canvasList,
		openCanvasTab,
		restoredRef,
		backend,
		magnet,
	});

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
