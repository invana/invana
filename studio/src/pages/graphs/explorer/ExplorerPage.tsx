import {
	CanvasContext,
	CanvasMessageBar,
	GraphStatusBar as CanvasStatusBar,
} from "@invana/canvas-react";
import type { GraphData as EngineGraphData, GraphCanvas } from "@invana/graph";
import { Button } from "@invana/ui";
import { PanelLeftOpen, PanelRightOpen } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { SetupRequiredBanner } from "../../../components/settings/SetupRequiredBanner";
import {
	useGraphConnectionQuery,
	useGraphQuery,
} from "../../../hooks/queries/useGraphs";
import { useLLMProvidersQuery } from "../../../hooks/queries/useLLMProviders";
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
import { GraphDetail } from "../components/GraphDetail";
import {
	type CanvasBackend,
	ExplorerCanvas,
	ExplorerHeaderToolbar,
} from "./components/ExplorerCanvas";
import { InspectorPanel } from "./components/InspectorPanel";
import { SessionsPanel } from "./components/SessionsPanel";
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
	const openSessions = useCallback(
		() => setPanelParam("sessions", false),
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

	const [canvasData, setCanvasData] = useState<QueryResultItem[]>([]);

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

	// Render backend (PixiJS). Defaults to WebGL — WebGPU intermittently crashes in
	// PixiJS 8's bind-group setup (null `gpuProgram.layout`). The header switcher
	// lets a user opt into WebGPU; the choice persists across reloads.
	const [backend, setBackendState] = useState<CanvasBackend>(() =>
		localStorage.getItem(BACKEND_STORAGE_KEY) === "webgpu" ? "webgpu" : "webgl",
	);
	const setBackend = useCallback((b: CanvasBackend) => {
		localStorage.setItem(BACKEND_STORAGE_KEY, b);
		setBackendState(b);
	}, []);

	// Clicked node/edge id, lifted from the canvas by <InspectorSelectionBridge>.
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const selected: QueryResultItem | null = selectedId
		? (canvasData.find((i) => String(i.id) === selectedId) ?? null)
		: null;

	// Adapt query results to the canvas engine's GraphData shape, carrying the
	// label (as `type`, for colour-by-label + the Inspector's Type row) and
	// properties (as `data`).
	const graphData = useMemo<EngineGraphData>(() => {
		// `explorer.adapt` span (RFC-025) — time mapping query results to the
		// canvas's GraphData shape. No-ops when there's no active run.
		return measureSync(runRef.current, "explorer.adapt", (span) => {
			const nodes: EngineGraphData["nodes"] = [];
			const edges: EngineGraphData["edges"] = [];
			for (const item of canvasData) {
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
			span?.setAttribute("explorer.node_count", nodes.length);
			span?.setAttribute("explorer.edge_count", edges.length);
			return { nodes, edges };
		});
	}, [canvasData]);

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
			setCanvasData([...nodes, ...edges]);
			setSelectedId(null);
			span?.setAttribute("explorer.raw_nodes", data.nodes.length);
			span?.setAttribute("explorer.raw_edges", data.edges.length);
			span?.setAttribute("explorer.node_count", nodes.length);
			span?.setAttribute("explorer.edge_count", edges.length);
		});
	}, []);

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
		) => {
			const interaction = startInteraction("explorer.query.run", {
				"explorer.trigger": trigger,
				...attributes,
			});
			runRef.current = interaction;
			let willRender = false;
			try {
				const result = await withInteraction(interaction, work);
				willRender = result?.result_type === "graph" && !!result.data;
				paintCanvas(result);
			} catch (err) {
				interaction.span.recordException(err as Error);
				throw err;
			} finally {
				if (!willRender) endInteraction(runRef, interaction);
			}
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
		await runTraced(
			"run",
			{
				"explorer.mode": payload.mode,
				"explorer.language": payload.mode === "ql" ? payload.language : "",
			},
			// `send` threads the ask/answer into a session (creating + opening one
			// when none is active) and runs the engine query. NL has no backend yet,
			// so it returns null and the session shows an explanatory reply.
			async () => {
				const { sessionId, result } = await send(payload);
				restoredRef.current = sessionId;
				return result;
			},
		);
	};

	// `rerun` re-issues a stored message's query — triggered by clicking a message
	// (`rerun`) or by the session-restore effect (`restore`). Both are traced.
	const handleRerun = useCallback(
		(messageId: string, trigger: "rerun" | "restore" = "rerun") =>
			runTraced(trigger, {}, () => rerun(messageId)),
		[runTraced, rerun],
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
			<ExplorerCanvas
				data={graphData}
				onReady={handleReady}
				onViewTargetChange={setSelectedId}
				magnet={magnet}
				interactionRef={runRef}
				backend={backend}
			/>
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
			isRunning={isRunning}
			sessions={sessions}
			activeSession={activeSession}
			onOpenSession={openSession}
			onBack={backToList}
			onRerun={handleRerun}
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

	// Re-open controls for the page header — each appears only while its panel
	// is collapsed.
	const reopenControls =
		sessionsClosed || inspectorClosed ? (
			<div className="flex items-center gap-1">
				{sessionsClosed && (
					<Button
						variant="ghost"
						size="icon"
						className="h-7 w-7"
						onClick={openSessions}
						title="Show sessions panel"
					>
						<PanelLeftOpen className="w-4 h-4" />
					</Button>
				)}
				{inspectorClosed && (
					<Button
						variant="ghost"
						size="icon"
						className="h-7 w-7"
						onClick={openInspector}
						title="Show inspector panel"
					>
						<PanelRightOpen className="w-4 h-4" />
					</Button>
				)}
			</div>
		) : null;

	return (
		// Lifted context: the live engine reaches the header toolbar, which lives
		// in GraphDetail's header (a sibling of <Canvas>, outside its own provider).
		<CanvasContext.Provider value={canvas}>
			<GraphDetail
				sectionId="explorer"
				pageLabel="Explorer"
				headerRightExtras={reopenControls}
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
