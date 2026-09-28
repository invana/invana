import { attachmentFor } from "@/pages/graphs-detail/features/assistant/SessionComposer";
import type { SessionMessage } from "@/pages/graphs-detail/features/assistant/types";
import type { useSessions } from "@/pages/graphs-detail/features/assistant/useSessions";
import type {
	CaptureCanvasState,
	OpenCanvasTab,
	useCanvasTabs,
} from "@/pages/graphs-detail/features/boards";
import {
	type CanvasBackend,
	resultToItems,
} from "@/pages/graphs-detail/features/explorer";
import type { useGraphConnectionQuery } from "@/pages/graphs-detail/features/graphs";
import type { QueryLanguage } from "@/pages/graphs-detail/features/graphs";
import { type Interaction, startAction } from "@/services/telemetry/tracer";
import type {
	QueryResponse,
	QueryResultItem,
	QueryRunPayload,
} from "@/types/query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { toast } from "sonner";

// Fallback when the engine hasn't reported any query languages yet (e.g. the
// connector class couldn't be loaded server-side). Studio shows both rather
// than blocking the user.
const FALLBACK_QUERY_LANGUAGES: readonly QueryLanguage[] = [
	"cypher",
	"gremlin",
];

type Sessions = ReturnType<typeof useSessions>;
type CanvasTabs = ReturnType<typeof useCanvasTabs>;

/** What the ask reads from the data canvases it paints. */
export interface AssistantCanvasBridgeDeps {
	username: string | undefined;
	graphSlug: string | undefined;
	/** The Graph's connection — which query languages its connector speaks. */
	graph: ReturnType<typeof useGraphConnectionQuery>["data"];
	activeSession: Sessions["activeSession"];
	activeSessionId: Sessions["activeSessionId"];
	send: Sessions["send"];
	rerun: Sessions["rerun"];
	recordLoad: Sessions["recordLoad"];
	/** The assistant holds the right side, so the canvas selection rides along. */
	assistantOpen: boolean;
	/** The canvas selection was taken off the next ask. */
	attachmentDetached: boolean;
	/** The answering gate is shut, so a natural-language ask is refused here. */
	cannotAnswer: boolean;
	selected: QueryResultItem | null;
	/** The page's `useSessions` calls through this; the hook points it at its handler. */
	streamResultRef: MutableRefObject<
		(sessionId: string, messageId: string, result: QueryResponse) => void
	>;
	/** Root span of the in-flight paint, closed by the canvas after its first frame. */
	runRef: MutableRefObject<Interaction | null>;
	paintCanvas: (result: QueryResponse | null) => void;
	captureCanvasState: CaptureCanvasState;
	openTabs: OpenCanvasTab[];
	setOpenTabs: Dispatch<SetStateAction<OpenCanvasTab[]>>;
	createCanvas: CanvasTabs["createCanvas"];
	canvasList: CanvasTabs["canvasList"];
	openCanvasTab: CanvasTabs["openCanvasTab"];
	/** The session whose canvas is already painted, so the restore skips it. */
	restoredRef: MutableRefObject<string | null>;
	backend: CanvasBackend;
	magnet: boolean;
}

/**
 * The ask, and what it paints on the data canvases.
 *
 * Sends an ask (with the canvas selection written into it), opens a new
 * session's canvas the moment the session exists and paints its first result
 * when that lands on the stream, re-runs a reply, loads a result onto the
 * canvas on request, and restores a session's canvas when it opens — from the
 * board's snapshot first, re-running its latest query only when there is none.
 * The results shown inline in the thread are held here, keyed by reply.
 */
export function useAssistantCanvasBridge(deps: AssistantCanvasBridgeDeps) {
	const {
		username,
		graphSlug,
		graph,
		activeSession,
		activeSessionId,
		send,
		rerun,
		recordLoad,
		assistantOpen,
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
	} = deps;

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
	// The engine resolves capabilities from the live connector and returns
	// them on the connection payload. Default to the first language it
	// reports, fall back to allowing both while the engine is still warming
	// up / can't resolve the connector class.
	const availableLanguages: readonly QueryLanguage[] = graph?.query_languages
		?.length
		? graph.query_languages
		: FALLBACK_QUERY_LANGUAGES;
	const defaultLanguage: QueryLanguage = availableLanguages[0] ?? "cypher";
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
		[paintCanvas, username, graphSlug, runRef],
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
			setOpenTabs,
		],
	);

	const handleRun = async (incoming: QueryRunPayload) => {
		// The attachment goes into the ask itself, in words, rather than as a
		// hidden context field: what the thread records has to be what was asked
		// (docs/for-developers/modules/ask/features/the-assistant.md AD2).
		// Removing the chip removes the line — asked without it, and the thread
		// shows that too.
		const attached =
			assistantOpen && !attachmentDetached ? attachmentFor(selected) : null;
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
	}, [
		activeSession,
		canvasList,
		openTabs,
		openCanvasTab,
		handleRerun,
		restoredRef,
	]);

	return {
		resultsByMessageId,
		availableLanguages,
		defaultLanguage,
		handleLoadToCanvasClick,
		handleRun,
		handleRerun,
	};
}
