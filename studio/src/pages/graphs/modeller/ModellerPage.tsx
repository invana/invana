import { Button, ScrollArea, Skeleton } from "@invana/ui";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { SetupRequiredBanner } from "../../../components/settings/SetupRequiredBanner";
import { useGraphConnectionQuery } from "../../../hooks/queries/useGraphs";
import { useActiveVersionQuery } from "../../../hooks/queries/useSchema";
import { graphsApi } from "../../../services/api/graphs";
import { GraphDetail } from "../components/GraphDetail";
import type { SelectedItem } from "./components/DetailPanel";
import { DetailPanel } from "./components/DetailPanel";
import { SchemaCanvas } from "./components/SchemaCanvas";
import { SchemaNav } from "./components/SchemaNav";

export function ModellerPage() {
	const { username, graphSlug } = useParams<{
		username: string;
		graphSlug: string;
	}>();
	const { data: graph, isLoading: graphLoading } = useGraphConnectionQuery(
		username,
		graphSlug,
	);
	const connectionMissing = !graphLoading && !graph;
	const {
		data: version,
		isLoading: versionLoading,
		refetch,
	} = useActiveVersionQuery(username, graphSlug);
	const [selected, setSelected] = useState<SelectedItem>(null);
	const [introspecting, setIntrospecting] = useState(false);

	const handleIntrospect = async () => {
		if (!username || !graphSlug) return;
		setIntrospecting(true);
		try {
			await graphsApi.pingConnection(username, graphSlug);
			await graphsApi.introspectConnection(username, graphSlug);
			toast.success("Introspection started — refresh in a few seconds.");
			setTimeout(() => refetch(), 4000);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Unknown error");
		} finally {
			setIntrospecting(false);
		}
	};

	const isLoading = graphLoading || versionLoading;
	const nodeTypes = version?.node_types ?? [];
	const edgeTypes = version?.edge_types ?? [];
	const propertyKeys = version?.property_keys ?? [];
	const constraints = version?.constraints ?? [];
	const indexes = version?.indexes ?? [];

	// ── Left section content ──────────────────────────────────────────────────
	const leftContent = isLoading ? (
		<div className="p-3 flex flex-col gap-2">
			<Skeleton className="h-4 w-3/4" />
			<Skeleton className="h-4 w-1/2" />
			<Skeleton className="h-4 w-2/3" />
		</div>
	) : connectionMissing ? (
		<SetupRequiredBanner pageLabel="Modeller" />
	) : !graph?.schema_id ? (
		<div className="flex flex-col items-center justify-center h-full gap-3 p-4 text-muted-foreground">
			<p className="text-center">
				No schema yet — run Introspect to discover your database schema.
			</p>
		</div>
	) : (
		<SchemaNav
			nodeTypes={nodeTypes}
			edgeTypes={edgeTypes}
			propertyKeyCount={propertyKeys.length}
			constraintCount={constraints.length}
			indexCount={indexes.length}
			selected={selected}
			onSelect={setSelected}
		/>
	);

	// ── Right section content ─────────────────────────────────────────────────
	const rightContent = isLoading ? (
		<div className="p-6 flex flex-col gap-3">
			<Skeleton className="h-6 w-48" />
			<Skeleton className="h-4 w-full" />
			<Skeleton className="h-4 w-3/4" />
		</div>
	) : (
		<ScrollArea className="h-full">
			<div className="p-6">
				<DetailPanel
					selected={selected}
					nodeTypes={nodeTypes}
					edgeTypes={edgeTypes}
					propertyKeys={propertyKeys}
					constraints={constraints}
					indexes={indexes}
				/>
			</div>
		</ScrollArea>
	);

	return (
		<GraphDetail
			sectionId="modeller"
			pageLabel="Modeller"
			headerRightExtras={
				<>
					<Button
						variant="outline"
						size="sm"
						className="h-7"
						onClick={() => refetch()}
					>
						<RefreshCw className="w-3 h-3 mr-1" />
						Refresh
					</Button>
					<Button
						variant="outline"
						size="sm"
						className="h-7"
						onClick={handleIntrospect}
						disabled={introspecting}
					>
						<RefreshCw
							className={`w-3 h-3 mr-1 ${introspecting ? "animate-spin" : ""}`}
						/>
						{introspecting ? "Introspecting…" : "Introspect"}
					</Button>
				</>
			}
			leftSection={{
				// Generous max so wide schema lists (long type names, deep trees)
				// can spread out. mainSection.minSize keeps the canvas usable.
				defaultSize: "260px",
				minSize: "180px",
				maxSize: "900px",
				collapsible: false,
				content: leftContent,
			}}
			mainSection={{
				defaultSize: "600px",
				minSize: "300px",
				// Canvas stays in place even when the connection isn't attached
				// — it'll render empty. The leftSection banner is the explainer.
				content: (
					<SchemaCanvas
						nodeTypes={nodeTypes}
						edgeTypes={edgeTypes}
						selected={selected}
						onSelect={setSelected}
					/>
				),
			}}
			rightSection={{
				defaultSize: "360px",
				minSize: "240px",
				maxSize: "600px",
				collapsible: false,
				content: rightContent,
			}}
			statusMetrics={
				version ? (
					<div className="flex items-center gap-3">
						<span>{nodeTypes.length} node types</span>
						<span>{edgeTypes.length} edge types</span>
					</div>
				) : null
			}
			footerRightExtras={
				version?.version ? (
					<span title="Active schema version">schema v{version.version}</span>
				) : null
			}
		/>
	);
}
