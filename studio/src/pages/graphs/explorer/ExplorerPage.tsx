import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import {
	GraphCanvas,
	type GraphCanvasEdge,
	type GraphCanvasNode,
} from "../../../components/canvas/GraphCanvas";
import { SetupRequiredBanner } from "../../../components/settings/SetupRequiredBanner";
import {
	useGraphConnectionQuery,
	useGraphQuery,
} from "../../../hooks/queries/useGraphs";
import { useLLMProvidersQuery } from "../../../hooks/queries/useLLMProviders";
import { type QueryLanguage, isSetupComplete } from "../../../types/graphs";
import type { QueryResultItem } from "../../../types/query";
import { GraphDetail } from "../components/GraphDetail";
import { CanvasToolbar } from "./components/CanvasToolbar";
import { InspectorPanel } from "./components/InspectorPanel";
import { QueryPanel, type QueryRunPayload } from "./components/QueryPanel";
import { useQueryExecution } from "./hooks/useQueryExecution";

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

	const { mutation, history } = useQueryExecution(username, graphSlug);
	const { data: llmProvidersResponse } = useLLMProvidersQuery(
		username,
		graphSlug,
	);
	const llmProviders = llmProvidersResponse?.items ?? [];

	const [canvasData, setCanvasData] = useState<QueryResultItem[]>([]);
	const [selected, setSelected] = useState<QueryResultItem | null>(null);
	const [nodeCount, setNodeCount] = useState(0);
	const [relCount, setRelCount] = useState(0);

	// Adapt query results to the shared canvas's stable node/edge shape.
	const { nodes: canvasNodes, edges: canvasEdges } = useMemo(() => {
		const nodes: GraphCanvasNode[] = [];
		const edges: GraphCanvasEdge[] = [];
		for (const item of canvasData) {
			if (item.type === "vertex") {
				nodes.push({ id: String(item.id) });
			} else if (item.type === "edge") {
				edges.push({
					id: String(item.id),
					source: String(item.source),
					target: String(item.target),
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

	const handleRun = async (payload: QueryRunPayload) => {
		if (setupIncomplete) {
			toast.error(
				"Finish the setup wizard (Graph Info + Intent) before running queries.",
			);
			return;
		}
		if (payload.mode === "nl") {
			// NL execution isn't wired yet — the engine only exposes the QL
			// `/query` endpoint today. Surface that clearly instead of silently
			// sending an NL prompt as Cypher/Gremlin.
			toast.info(
				"Natural-language queries aren't wired to the engine yet. Pick Query Language to run.",
			);
			return;
		}
		const result = await mutation.mutateAsync({
			query: payload.query,
			language: payload.language,
		});
		if (result.result_type === "graph" && result.data) {
			const nodes: QueryResultItem[] = result.data.nodes.map((n) => ({
				...n,
				type: "vertex" as const,
			}));
			const edges: QueryResultItem[] = result.data.edges.map((e) => ({
				...e,
				type: "edge" as const,
			}));
			const items = [...nodes, ...edges];
			setCanvasData(items);
			setNodeCount(nodes.length);
			setRelCount(edges.length);
			setSelected(null);
		}
	};

	// Selection isn't yet emitted by the shared canvas (canvas-react v0
	// doesn't wrap ClickSelectBehaviour). `selected` stays null until that
	// lands; InspectorPanel falls back to its empty state.
	const canvasContent = (
		<div className="relative w-full h-full">
			<GraphCanvas nodes={canvasNodes} edges={canvasEdges} />
			<CanvasToolbar canvas={null} />
		</div>
	);

	const leftContent = connectionMissing ? (
		<SetupRequiredBanner pageLabel="Explorer" reason="connection" />
	) : setupIncomplete ? (
		<SetupRequiredBanner pageLabel="Explorer" reason="setup" />
	) : (
		<QueryPanel
			availableLanguages={availableLanguages}
			defaultLanguage={defaultLanguage}
			llmProviders={llmProviders}
			onRun={handleRun}
			isRunning={mutation.isPending}
			history={history}
		/>
	);

	return (
		<GraphDetail
			sectionId="explorer"
			pageLabel="Explorer"
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
					<span>{history.length} queries</span>
				</div>
			}
		/>
	);
}
