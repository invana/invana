import { sessionsApi } from "@/pages/graphs-detail/features/assistant/api";
import type { useSessions } from "@/pages/graphs-detail/features/assistant/useSessions";
import { boardsApi } from "@/pages/graphs-detail/features/boards/api";
import type { CanvasKind } from "@/pages/graphs-detail/features/boards/boardKinds";
import {
	useBoardsQuery,
	useCreateCanvasMutation,
} from "@/pages/graphs-detail/features/boards/queries";
import type { Board } from "@/pages/graphs-detail/features/boards/types";
import type { useBoardVersions } from "@/pages/graphs-detail/features/boards/useBoardVersions";
import type { CanvasBackend } from "@/pages/graphs-detail/features/explorer";
import { ApiError } from "@/services/api/client";
import { useCallback, useMemo } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { toast } from "sonner";

type Sessions = ReturnType<typeof useSessions>;
type BoardContents = ReturnType<typeof useBoardVersions>;

/** A data canvas open as a tab, bound 1:1 to the session behind it. */
export interface OpenCanvasTab {
	id: string;
	sessionId: string;
}

/** What the tab actions read from the data canvases that host them. */
export interface CanvasTabsDeps {
	username: string | undefined;
	graphSlug: string | undefined;
	sessions: Sessions["sessions"];
	activeSession: Sessions["activeSession"];
	activeSessionId: Sessions["activeSessionId"];
	openSession: Sessions["openSession"];
	backToList: Sessions["backToList"];
	refresh: Sessions["refresh"];
	openTabs: OpenCanvasTab[];
	setOpenTabs: Dispatch<SetStateAction<OpenCanvasTab[]>>;
	activeCanvasId: string | null;
	/** The session whose canvas is already painted, so the restore skips it. */
	restoredRef: MutableRefObject<string | null>;
	persistActiveCanvas: (opts?: {
		banner?: "force" | "throttle" | "off";
	}) => Promise<void>;
	paintFromCanvas: (c: Board) => void;
	setCanvasData: BoardContents["setItems"];
	setSeedData: BoardContents["setSeed"];
	setStyling: BoardContents["setStyling"];
	setSelectedId: BoardContents["setSelectedId"];
	forgetCanvasState: BoardContents["forget"];
	setMagnet: Dispatch<SetStateAction<boolean>>;
	backend: CanvasBackend;
	magnet: boolean;
	setActiveBoardId: Dispatch<SetStateAction<string | null>>;
	/** Clears `?page=` when a session's canvas comes in front of a board. */
	setBoardPageId: (id: string | null) => void;
	setWorkKind: Dispatch<SetStateAction<CanvasKind | null>>;
}

/**
 * The data canvases' tabs — one per open session.
 *
 * Opens a canvas as a tab (saving the outgoing one and painting this one from
 * its snapshot), opens a session's canvas from the sessions list, creating it
 * when the session has none, starts a blank canvas on a fresh session, and
 * closes a tab without deleting its canvas. Also names each tab after its
 * session and maps each session to its bannered canvas for the list preview.
 *
 * The tab list itself is held by the caller, because which canvas is active
 * decides whose contents `useBoardVersions` resolves — and that has to be known
 * before the save and paint these actions call.
 */
export function useCanvasTabs(deps: CanvasTabsDeps) {
	const {
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
		setBoardPageId,
		setWorkKind,
	} = deps;

	const createCanvas = useCreateCanvasMutation(username ?? "", graphSlug ?? "");
	// Board list — used to resolve an existing session's canvas when opening it
	// from the sessions list (`handleOpenSession`). Titles/purposes for the tabs
	// and edit dialog come from the session + a direct canvas fetch, not this.
	const { data: canvasList } = useBoardsQuery(username, graphSlug, {
		limit: 100,
		includeArchived: true,
	});
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
			setOpenTabs,
			setMagnet,
			restoredRef,
		],
	);

	// Opening a session opens its 1:1 canvas and makes it the active page (G45):
	// an open tab is focused, a closed one is loaded, and a session with no canvas
	// yet gets one created — the restore effect then paints its last query.
	// Whatever page was in front steps behind it; nothing is closed.
	const handleOpenSession = useCallback(
		(sessionId: string) => {
			setActiveBoardId(null);
			setBoardPageId(null);
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
			setBoardPageId,
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
			setOpenTabs,
			restoredRef,
		],
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
		setCanvasData,
		setSeedData,
		setStyling,
		setSelectedId,
		setOpenTabs,
		restoredRef,
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
			setOpenTabs,
		],
	);

	return {
		canvasList,
		createCanvas,
		bannerCanvasIdBySession,
		sessionTitleById,
		openCanvasTab,
		handleOpenSession,
		newCanvasTab,
		closeCanvasTab,
	};
}
