import { AppLayoutV2 } from "@invana/themes";
import { Separator } from "@invana/ui";
import { Database, GitGraph, Network, Settings } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ThemeToggle } from "../../../components/ThemeToggle";
import { useLegacyGraphConnectionQuery } from "../../../hooks/queries/useGraphs";
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
	const navigate = useNavigate();
	const { id: graphId } = useParams<{ id: string }>();

	const { data: graph } = useLegacyGraphConnectionQuery(graphId ?? "");
	const { mutation, history } = useQueryExecution(graphId ?? "");

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

	// ── Nav ───────────────────────────────────────────────────────────────────
	const leftNav = {
		top: (
			<div className="flex items-center justify-center w-full py-3">
				<div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold text-base select-none">
					I
				</div>
			</div>
		),
		topNavItems: [
			{
				name: "Graphs",
				icon: Database,
				tooltipSide: "right" as const,
				onClick: () => navigate("/graphs"),
			},
			{
				name: "Explorer",
				icon: Network,
				tooltipSide: "right" as const,
				className: "bg-accent text-accent-foreground",
				showSeperator: true,
			},
			{
				name: "Modeller",
				icon: GitGraph,
				tooltipSide: "right" as const,
				onClick: graphId
					? () => navigate(`/graphs/${graphId}/modeller`)
					: undefined,
			},
		],
		bottomNavItems: [
			{
				name: "Settings",
				icon: Settings,
				tooltipSide: "right" as const,
			},
		],
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
			graph={graph}
			nodeCount={nodeCount}
			relationshipCount={relCount}
			queryCount={history.length}
		/>
	);

	return (
		<AppLayoutV2
			leftNav={leftNav}
			header={{
				className: "!h-[38px]",
				left: (
					<div className="flex items-center gap-2 px-2">
						<span className="font-bold text-xl select-none">Invana Studio</span>
						<Separator orientation="vertical" className="h-4" />
						<span className="text-muted-foreground">Explorer</span>
						{graph && (
							<>
								<Separator orientation="vertical" className="h-4" />
								<span className="font-medium">{graph.name}</span>
							</>
						)}
					</div>
				),
				right: (
					<div className="flex items-center gap-1 px-2">
						<ThemeToggle />
					</div>
				),
			}}
			leftSection={{
				defaultSize: "300px",
				minSize: "240px",
				maxSize: "400px",
				collapsible: false,
				content: (
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
