import { AppLayoutV2 } from "@invana/themes";
import { Button, ScrollArea, Separator, Skeleton } from "@invana/ui";
import { Database, GitGraph, Network, RefreshCw, Settings } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ThemeToggle } from "../../../components/ThemeToggle";
import { useGraphConnectionQuery } from "../../../hooks/queries/useGraphs";
import { useActiveVersionQuery } from "../../../hooks/queries/useSchema";
import { graphsApi } from "../../../services/api/graphs";
import type { SelectedItem } from "./components/DetailPanel";
import { DetailPanel } from "./components/DetailPanel";
import { SchemaCanvas } from "./components/SchemaCanvas";
import { SchemaNav } from "./components/SchemaNav";

export function ModellerPage() {
	const navigate = useNavigate();
	const { username, slug } = useParams<{ username: string; slug: string }>();
	const { data: graph, isLoading: graphLoading } = useGraphConnectionQuery(
		username,
		slug,
	);
	const graphId = graph?.id;
	const {
		data: version,
		isLoading: versionLoading,
		refetch,
	} = useActiveVersionQuery(graph?.schema_id);
	const [selected, setSelected] = useState<SelectedItem>(null);
	const [introspecting, setIntrospecting] = useState(false);

	const handleIntrospect = async () => {
		if (!graphId) return;
		setIntrospecting(true);
		try {
			await graphsApi.reconnect(graphId);
			const res = await fetch(
				`${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8200"}/api/v1/graphs/${graphId}/introspect`,
				{ method: "POST" },
			);
			if (!res.ok) throw new Error("Introspection failed");
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

	// ── Shared left nav (icon rail) ───────────────────────────────────────────
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
				showSeperator: true,
				onClick:
					username && slug
						? () => navigate(`/u/${username}/${slug}/explorer`)
						: undefined,
			},
			{
				name: "Modeller",
				icon: GitGraph,
				tooltipSide: "right" as const,
				className: "bg-accent text-accent-foreground",
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

	return (
		<AppLayoutV2
			leftNav={leftNav}
			header={{
				className: "!h-[38px]",
				left: (
					<div className="flex items-center gap-2 px-2">
						<span className="font-bold text-xl select-none">Invana Studio</span>
						<Separator orientation="vertical" className="h-4" />
						<span className="text-muted-foreground">Modeller</span>
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
						<ThemeToggle />
					</div>
				),
			}}
			leftSection={{
				defaultSize: "260px",
				minSize: "180px",
				maxSize: "480px",
				collapsible: false,
				content: leftContent,
			}}
			mainSection={{
				defaultSize: "600px",
				minSize: "300px",
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
			footer={{
				className: "!h-[25px]",
				left: (
					<div className="flex items-center gap-4 px-2 text-base text-muted-foreground">
						{graph && (
							<>
								<span>{graph.name}</span>
								<span>•</span>
								<span
									className={
										graph.status === "ACTIVE"
											? "text-green-500"
											: "text-destructive"
									}
								>
									{graph.status}
								</span>
							</>
						)}
						{version && (
							<>
								<span>•</span>
								<span>{nodeTypes.length} node types</span>
								<span>•</span>
								<span>{edgeTypes.length} edge types</span>
							</>
						)}
					</div>
				),
				right: (
					<div className="flex items-center gap-3 px-2 text-base text-muted-foreground">
						{version?.version && <span>v{version.version}</span>}
						<span>Modeller</span>
					</div>
				),
			}}
		/>
	);
}
