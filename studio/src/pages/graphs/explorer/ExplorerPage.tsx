import { AppLayoutV2 } from "@invana/themes";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useAppHeader } from "../../../components/header/useAppHeader";
import { SettingsPanel } from "../../../components/settings/SettingsPanel";
import { useGraphLeftNav } from "../../../components/settings/useGraphLeftNav";
import { useSettingsPanel } from "../../../components/settings/useSettingsPanel";
import { useGraphConnectionQuery } from "../../../hooks/queries/useGraphs";
import type { QueryResultItem } from "../../../types/query";
import { CanvasToolbar } from "./components/CanvasToolbar";
import { ExplorerStatusBar } from "./components/ExplorerStatusBar";
import { GraphCanvas } from "./components/GraphCanvas";
import { InspectorPanel } from "./components/InspectorPanel";
import { QueryPanel } from "./components/QueryPanel";
import { useQueryExecution } from "./hooks/useQueryExecution";

// ── Connector → default language ─────────────────────────────────────────────

const CONNECTOR_LANGUAGE: Record<string, "cypher" | "gremlin"> = {
	"invana_neo4j.connector.Neo4jConnector": "cypher",
	"invana_memgraph.connector.MemgraphConnector": "cypher",
	"invana_arcadedb.connector.ArcadeDBCypherConnector": "cypher",
	"invana_janusgraph.connector.JanusGraphConnector": "gremlin",
	"invana_neptune.connector.NeptuneConnector": "gremlin",
	"invana_tinkergraph.connector.TinkerGraphConnector": "gremlin",
};

export function ExplorerPage() {
	const { username, graphSlug } = useParams<{
		username: string;
		graphSlug: string;
	}>();

	const { data: graph } = useGraphConnectionQuery(username, graphSlug);
	const { mutation, history } = useQueryExecution(username, graphSlug);
	const settingsPanel = useSettingsPanel();
	const leftNav = useGraphLeftNav(username ?? "", graphSlug ?? "", "explorer");
	const header = useAppHeader({ pageLabel: "Explorer" });

	const [canvasData, setCanvasData] = useState<QueryResultItem[]>([]);
	const [selected, setSelected] = useState<QueryResultItem | null>(null);
	const [nodeCount, setNodeCount] = useState(0);
	const [relCount, setRelCount] = useState(0);

	const defaultLanguage: "cypher" | "gremlin" =
		CONNECTOR_LANGUAGE[graph?.connector_class ?? ""] ?? "gremlin";

	const handleRun = async (query: string, language: "cypher" | "gremlin") => {
		const result = await mutation.mutateAsync({ query, language });
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
	const canvasContent = (
		<div className="relative w-full h-full">
			<GraphCanvas
				data={canvasData}
				onSelectionChange={(item) => {
					if (!item) {
						setSelected(null);
						return;
					}
					const full = canvasData.find((d) => d.id === item.id) ?? item;
					setSelected(full);
				}}
			/>
			<CanvasToolbar canvas={null} />
		</div>
	);

	// ── Status bar ────────────────────────────────────────────────────────────
	const footerLeft = (
		<ExplorerStatusBar
			graph={graph ?? undefined}
			nodeCount={nodeCount}
			relationshipCount={relCount}
			queryCount={history.length}
		/>
	);

	return (
		<AppLayoutV2
			leftNav={leftNav}
			header={header}
			leftSection={{
				defaultSize: settingsPanel.isOpen ? "420px" : "300px",
				minSize: settingsPanel.isOpen ? "320px" : "240px",
				maxSize: settingsPanel.isOpen ? "640px" : "400px",
				collapsible: false,
				content:
					settingsPanel.isOpen && username && graphSlug ? (
						<SettingsPanel username={username} graphSlug={graphSlug} />
					) : (
						<QueryPanel
							defaultLanguage={defaultLanguage}
							onRun={handleRun}
							isRunning={mutation.isPending}
							history={history}
						/>
					),
			}}
			mainSection={{
				defaultSize: "600px",
				minSize: "300px",
				content: canvasContent,
			}}
			rightSection={{
				defaultSize: "280px",
				minSize: "240px",
				maxSize: "360px",
				collapsible: false,
				content: <InspectorPanel selected={selected} allItems={canvasData} />,
			}}
			footer={{
				className: "!h-[25px]",
				left: footerLeft,
			}}
		/>
	);
}
