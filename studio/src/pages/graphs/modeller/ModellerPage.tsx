import { AppLayoutV2 } from "@invana/themes";
import { Button, ScrollArea, Skeleton } from "@invana/ui";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAppHeader } from "../../../components/header/useAppHeader";
import { SetupRequiredBanner } from "../../../components/settings/SetupRequiredBanner";
import { useActiveVersionQuery } from "../../../hooks/queries/useSchema";
import { graphsApi } from "../../../services/api/graphs";
import { useGraphWorkspace } from "../shared/useGraphWorkspace";
import type { SelectedItem } from "./components/DetailPanel";
import { DetailPanel } from "./components/DetailPanel";
import { SchemaCanvas } from "./components/SchemaCanvas";
import { SchemaNav } from "./components/SchemaNav";

export function ModellerPage() {
	const {
		username,
		graphSlug,
		graph,
		graphLoading,
		connectionMissing,
		settingsPanel,
		leftNav,
		withSettingsTakeover,
		withSettingsAsMain,
	} = useGraphWorkspace({ sectionId: "modeller" });
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

	const header = useAppHeader({
		pageLabel: "Modeller",
		rightExtras: (
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
		),
	});

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

	// When settings is expanded it takes over the entire content area —
	// drop left + right sections so SchemaNav / right panel don't sandwich it.
	const settingsExpanded = settingsPanel.isOpen && settingsPanel.expanded;

	return (
		<AppLayoutV2
			leftNav={leftNav}
			header={header}
			leftSection={
				settingsExpanded
					? undefined
					: {
							defaultSize: settingsPanel.isOpen ? "420px" : "260px",
							minSize: settingsPanel.isOpen ? "320px" : "180px",
							// Generous max so wide schema lists (long type names, deep
							// trees) can spread out. mainSection.minSize keeps the canvas
							// usable.
							maxSize: settingsPanel.isOpen ? "800px" : "900px",
							collapsible: false,
							content: withSettingsTakeover(leftContent),
						}
			}
			mainSection={{
				defaultSize: "600px",
				minSize: "300px",
				// Canvas stays in place even when the connection isn't attached
				// — it'll render empty. The leftSection banner is the explainer.
				content: withSettingsAsMain(
					<SchemaCanvas
						nodeTypes={nodeTypes}
						edgeTypes={edgeTypes}
						selected={selected}
						onSelect={setSelected}
					/>,
				),
			}}
			rightSection={
				settingsExpanded
					? undefined
					: {
							defaultSize: "360px",
							minSize: "240px",
							maxSize: "600px",
							collapsible: false,
							content: rightContent,
						}
			}
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
