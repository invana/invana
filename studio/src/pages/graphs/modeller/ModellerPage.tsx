import { Button, ScrollArea, Skeleton } from "@invana/ui";
import { ChevronLeft, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { SetupRequiredBanner } from "../../../components/settings/SetupRequiredBanner";
import { useGraphConnectionQuery } from "../../../hooks/queries/useGraphs";
import {
	useModelActiveVersionQuery,
	useModelsQuery,
} from "../../../hooks/queries/useModels";
import { graphsApi } from "../../../services/api/graphs";
import { PERSONA_OPTIONS } from "../../../types/models";
import { GraphDetail } from "../components/GraphDetail";
import type { SelectedItem } from "./components/DetailPanel";
import { DetailPanel } from "./components/DetailPanel";
import { ModelListPanel } from "./components/ModelListPanel";
import { SchemaCanvas } from "./components/SchemaCanvas";
import { SchemaNav } from "./components/SchemaNav";

function personaLabel(persona: string): string {
	return PERSONA_OPTIONS.find((o) => o.value === persona)?.label ?? persona;
}

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

	const { data: models, isLoading: modelsLoading } = useModelsQuery(
		username,
		graphSlug,
	);
	// `modelId === undefined` → show the model list; set → drill into that model.
	const [modelId, setModelId] = useState<string | undefined>();
	const [selected, setSelected] = useState<SelectedItem>(null);
	const [introspecting, setIntrospecting] = useState(false);

	const { data: version, isLoading: versionLoading } =
		useModelActiveVersionQuery(username, graphSlug, modelId);

	const selectedModel = models?.find((m) => m.id === modelId);

	const openModel = (id: string) => {
		setModelId(id);
		setSelected(null);
	};
	const backToList = () => {
		setModelId(undefined);
		setSelected(null);
	};

	const handleIntrospect = async () => {
		if (!username || !graphSlug) return;
		setIntrospecting(true);
		try {
			await graphsApi.pingConnection(username, graphSlug);
			await graphsApi.introspectConnection(username, graphSlug);
			toast.success("Introspection started — refresh in a few seconds.");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Unknown error");
		} finally {
			setIntrospecting(false);
		}
	};

	const nodeTypes = version?.node_types ?? [];
	const edgeTypes = version?.edge_types ?? [];
	const propertyKeys = version?.property_keys ?? [];
	const constraints = version?.constraints ?? [];
	const indexes = version?.indexes ?? [];
	const isLoading = graphLoading || modelsLoading;
	const noModels = !modelsLoading && (models?.length ?? 0) === 0;

	// ── Left section ───────────────────────────────────────────────────────────
	let leftContent: React.ReactNode;
	if (isLoading) {
		leftContent = (
			<div className="p-3 flex flex-col gap-2">
				<Skeleton className="h-4 w-3/4" />
				<Skeleton className="h-4 w-1/2" />
				<Skeleton className="h-4 w-2/3" />
			</div>
		);
	} else if (connectionMissing) {
		leftContent = <SetupRequiredBanner pageLabel="Modeller" />;
	} else if (noModels) {
		leftContent = (
			<div className="flex flex-col items-center justify-center h-full gap-3 p-4 text-center text-muted-foreground">
				<p>No graph models yet.</p>
				<p className="text-xs">
					Models are created when you import a dataset. Or run Introspect to
					seed one from the connected database.
				</p>
			</div>
		);
	} else if (!modelId || !selectedModel) {
		leftContent = <ModelListPanel models={models ?? []} onSelect={openModel} />;
	} else {
		leftContent = (
			<div className="flex h-full flex-col">
				<div className="border-b border-border px-2 py-2 flex flex-col gap-1">
					<button
						type="button"
						onClick={backToList}
						className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
					>
						<ChevronLeft className="w-3 h-3" />
						All models
					</button>
					<div className="px-1">
						<div className="font-semibold truncate">{selectedModel.name}</div>
						<div className="text-xs text-muted-foreground">
							{personaLabel(selectedModel.persona)}
							{version?.version ? ` · v${version.version}` : ""}
						</div>
					</div>
				</div>
				<div className="flex-1 min-h-0">
					{versionLoading ? (
						<div className="p-3 flex flex-col gap-2">
							<Skeleton className="h-4 w-2/3" />
							<Skeleton className="h-4 w-1/2" />
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
					)}
				</div>
			</div>
		);
	}

	// ── Right section ──────────────────────────────────────────────────────────
	const rightContent =
		isLoading || (modelId && versionLoading) ? (
			<div className="p-6 flex flex-col gap-3">
				<Skeleton className="h-6 w-48" />
				<Skeleton className="h-4 w-full" />
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
			}
			leftSection={{
				defaultSize: "260px",
				minSize: "200px",
				maxSize: "900px",
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
			statusMetrics={
				modelId && version ? (
					<div className="flex items-center gap-3">
						<span>{nodeTypes.length} node types</span>
						<span>{edgeTypes.length} edge types</span>
					</div>
				) : null
			}
			footerRightExtras={
				selectedModel ? (
					<span title="Open model">
						{selectedModel.name}
						{version?.version ? ` · v${version.version}` : ""}
					</span>
				) : null
			}
		/>
	);
}
