import { CanvasContext } from "@invana/canvas-react";
import type { GraphData as EngineGraphData, GraphCanvas } from "@invana/graph";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { SetupRequiredBanner } from "../../../components/settings/SetupRequiredBanner";
import {
	useGraphConnectionQuery,
	useGraphQuery,
} from "../../../hooks/queries/useGraphs";
import { useLLMProvidersQuery } from "../../../hooks/queries/useLLMProviders";
import { type QueryLanguage, isSetupComplete } from "../../../types/graphs";
import type {
	QueryResponse,
	QueryResultItem,
	QueryRunPayload,
} from "../../../types/query";
import { GraphDetail } from "../components/GraphDetail";
import {
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

	// Collapsed state lives in the URL (`?sessions=closed`), mirroring the
	// Settings panel convention. The header's collapse control sets it; the
	// left-rail Explorer icon navigates to the bare path, which drops the
	// param and brings the panel back.
	const [searchParams, setSearchParams] = useSearchParams();
	const sessionsClosed = searchParams.get("sessions") === "closed";
	const closeSessions = useCallback(() => {
		const next = new URLSearchParams(searchParams);
		next.set("sessions", "closed");
		setSearchParams(next, { replace: true });
	}, [searchParams, setSearchParams]);
	const { data: llmProvidersResponse } = useLLMProvidersQuery(
		username,
		graphSlug,
	);
	const llmProviders = llmProvidersResponse?.items ?? [];

	const [canvasData, setCanvasData] = useState<QueryResultItem[]>([]);
	const [nodeCount, setNodeCount] = useState(0);
	const [relCount, setRelCount] = useState(0);

	// The live canvas engine, lifted out of <Canvas> by <CanvasBridge>. Null until
	// the graph is fully wired; gates the header toolbar that depends on it.
	const [canvas, setCanvas] = useState<GraphCanvas | null>(null);
	const handleReady = useCallback((c: GraphCanvas | null) => setCanvas(c), []);

	// Magnet toggle → hover neighbour radius. On (default): hovering a node lights
	// up its 1st-degree neighbours; off: only the hovered node lights up.
	const [magnet, setMagnet] = useState(true);
	const toggleMagnet = useCallback(() => setMagnet((m) => !m), []);

	// Clicked node/edge id, lifted from the canvas by <InspectorSelectionBridge>.
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const selected: QueryResultItem | null = selectedId
		? (canvasData.find((i) => String(i.id) === selectedId) ?? null)
		: null;

	// Adapt query results to the canvas engine's GraphData shape, carrying the
	// label (as `type`, for colour-by-label + the Inspector's Type row) and
	// properties (as `data`).
	const graphData = useMemo<EngineGraphData>(() => {
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
		return { nodes, edges };
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
		// Path queries (e.g. `MATCH path = (n)-[r]->() RETURN path`) repeat shared
		// endpoints once per row, so the engine returns the same node/edge id many
		// times. The canvas store rejects duplicate ids (GraphStore.addNode), so
		// dedupe by id here — keeping the first occurrence — before painting.
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
		const nodes = [...nodeMap.values()];
		const edges = [...edgeMap.values()];
		setCanvasData([...nodes, ...edges]);
		setNodeCount(nodes.length);
		setRelCount(edges.length);
		setSelectedId(null);
	}, []);

	// Session whose canvas is already painted — skip the auto-restore effect for
	// it (a fresh send already painted; reopening another session restores it).
	const restoredRef = useRef<string | null>(null);

	const handleRun = async (payload: QueryRunPayload) => {
		if (setupIncomplete) {
			toast.error(
				"Finish the setup wizard (Graph Info + Intent) before running queries.",
			);
			return;
		}
		// `send` threads the ask/answer into a session (creating + opening one when
		// none is active) and runs the engine query. NL has no backend yet, so it
		// returns null and the session shows an explanatory reply.
		const { sessionId, result } = await send(payload);
		restoredRef.current = sessionId;
		paintCanvas(result);
	};

	const handleRerun = useCallback(
		async (messageId: string) => {
			paintCanvas(await rerun(messageId));
		},
		[rerun, paintCanvas],
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
		void handleRerun(latest.id);
	}, [activeSession, handleRerun]);

	// Clicking a node/edge feeds `selectedId` via <InspectorSelectionBridge>; the
	// derived `selected` (above) drives the right-side InspectorPanel. The toolbar
	// lives in the header, so the canvas fills the main area edge-to-edge.
	const canvasContent = (
		<div className="relative w-full h-full">
			<ExplorerCanvas
				data={graphData}
				onReady={handleReady}
				onViewTargetChange={setSelectedId}
				magnet={magnet}
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

	return (
		// Lifted context: the live engine reaches the header toolbar, which lives
		// in GraphDetail's header (a sibling of <Canvas>, outside its own provider).
		<CanvasContext.Provider value={canvas}>
			<GraphDetail
				sectionId="explorer"
				pageLabel="Explorer"
				headerCenter={
					canvas ? (
						<ExplorerHeaderToolbar
							magnet={magnet}
							onToggleMagnet={toggleMagnet}
						/>
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
				rightSection={{
					defaultSize: "280px",
					minSize: "240px",
					maxSize: "360px",
					collapsible: false,
					content: <InspectorPanel selected={selected} allItems={canvasData} />,
				}}
				statusMetrics={
					<div className="flex items-center gap-3">
						<span>{nodeCount} nodes</span>
						<span>{relCount} relationships</span>
						<span>
							{sessions.length} session{sessions.length === 1 ? "" : "s"}
						</span>
					</div>
				}
			/>
		</CanvasContext.Provider>
	);
}
