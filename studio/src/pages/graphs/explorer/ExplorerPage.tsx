import { AppLayoutV2 } from "@invana/themes";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
	GraphCanvas,
	type GraphCanvasEdge,
	type GraphCanvasNode,
} from "../../../components/canvas/GraphCanvas";
import { useAppHeader } from "../../../components/header/useAppHeader";
import { SetupRequiredBanner } from "../../../components/settings/SetupRequiredBanner";
import { useLLMProvidersQuery } from "../../../hooks/queries/useLLMProviders";
import type { QueryLanguage } from "../../../types/graphs";
import type { QueryResultItem } from "../../../types/query";
import { AppVersion } from "../components/AppVersion";
import { GraphStatusBar } from "../components/GraphStatusBar";
import { useGraphWorkspace } from "../shared/useGraphWorkspace";
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
	const {
		username,
		graphSlug,
		graph,
		connectionMissing,
		settingsPanel,
		leftNav,
		withSettingsTakeover,
		withSettingsAsMain,
	} = useGraphWorkspace({ sectionId: "explorer" });

	const { mutation, history } = useQueryExecution(username, graphSlug);
	const { data: llmProvidersResponse } = useLLMProvidersQuery(
		username,
		graphSlug,
	);
	const llmProviders = llmProvidersResponse?.items ?? [];
	const header = useAppHeader({ pageLabel: "Explorer" });

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

	// ── Canvas panel ──────────────────────────────────────────────────────────
	// Selection isn't yet emitted by the shared canvas (canvas-react v0
	// doesn't wrap ClickSelectBehaviour). `selected` stays null until that
	// lands; InspectorPanel falls back to its empty state.
	const canvasContent = (
		<div className="relative w-full h-full">
			<GraphCanvas nodes={canvasNodes} edges={canvasEdges} />
			<CanvasToolbar canvas={null} />
		</div>
	);

	// ── Status bar ────────────────────────────────────────────────────────────
	const footerLeft = (
		<GraphStatusBar
			graph={graph ?? undefined}
			metrics={
				<div className="flex items-center gap-3">
					<span>{nodeCount} nodes</span>
					<span>{relCount} relationships</span>
					<span>{history.length} queries</span>
				</div>
			}
		/>
	);

	// When settings is expanded it takes over the entire content area —
	// drop left + right sections so QueryPanel / Inspector don't sandwich it.
	const settingsExpanded = settingsPanel.isOpen && settingsPanel.expanded;

	return (
		<AppLayoutV2
			leftNav={leftNav}
			header={header}
			leftSection={
				settingsExpanded
					? undefined
					: {
							defaultSize: settingsPanel.isOpen ? "420px" : "300px",
							minSize: settingsPanel.isOpen ? "320px" : "240px",
							// Generous max so long Cypher/Gremlin queries can spread out.
							// mainSection.minSize below still keeps the canvas usable when
							// the user drags the divider far right.
							maxSize: settingsPanel.isOpen ? "800px" : "900px",
							collapsible: false,
							content: withSettingsTakeover(
								connectionMissing ? (
									<SetupRequiredBanner pageLabel="Explorer" />
								) : (
									<QueryPanel
										availableLanguages={availableLanguages}
										defaultLanguage={defaultLanguage}
										llmProviders={llmProviders}
										onRun={handleRun}
										isRunning={mutation.isPending}
										history={history}
									/>
								),
							),
						}
			}
			mainSection={{
				defaultSize: "600px",
				minSize: "300px",
				// Canvas stays in place even when the connection isn't attached
				// — it'll render empty. The leftSection banner is the explainer.
				content: withSettingsAsMain(canvasContent),
			}}
			rightSection={
				settingsExpanded
					? undefined
					: {
							defaultSize: "280px",
							minSize: "240px",
							maxSize: "360px",
							collapsible: false,
							content: (
								<InspectorPanel selected={selected} allItems={canvasData} />
							),
						}
			}
			footer={{
				className: "!h-[25px]",
				left: footerLeft,
				right: (
					<div className="flex items-center gap-3 px-2 text-base text-muted-foreground">
						<AppVersion />
						<span>Explorer</span>
					</div>
				),
			}}
		/>
	);
}
