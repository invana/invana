import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Badge,
	Button,
	ScrollArea,
	Skeleton,
	TabbedPanel,
} from "@invana/ui";
import { useQueryClient } from "@tanstack/react-query";
import {
	ChevronRight,
	Pencil,
	RefreshCw,
	Save,
	Send,
	Workflow,
} from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { SetupRequiredBanner } from "../../../components/settings/SetupRequiredBanner";
import { useGraphConnectionQuery } from "../../../hooks/queries/useGraphs";
import {
	useActivateVersionMutation,
	useCreateDraftMutation,
	useDeleteEdgeTypeMutation,
	useDeleteNodeTypeMutation,
	useModelVersionQuery,
	useModelVersionsQuery,
	useModelsQuery,
} from "../../../hooks/queries/useModels";
import { ApiError } from "../../../services/api/client";
import { graphsApi } from "../../../services/api/graphs";
import type { GraphModelSummary } from "../../../types/models";
import type {
	EdgeTypeResponse,
	NodeTypeResponse,
} from "../../../types/schemas";
import { GraphDetail } from "../components/GraphDetail";
import { CompatibilityBanner } from "./components/CompatibilityBanner";
import type { SelectedItem } from "./components/DetailPanel";
import { DetailPanel } from "./components/DetailPanel";
import { EdgeTypeFormDialog } from "./components/EdgeTypeFormDialog";
import { ModelFormDialog } from "./components/ModelFormDialog";
import { ModelListPanel } from "./components/ModelListPanel";
import { NodeTypeFormDialog } from "./components/NodeTypeFormDialog";
import { SchemaCanvas } from "./components/SchemaCanvas";
import { SchemaNav } from "./components/SchemaNav";
import type { ModelEditCtx } from "./components/editing";

type PendingDelete = { kind: "node" | "edge"; id: string; name: string } | null;

export function ModellerPage() {
	const { username, graphSlug } = useParams<{
		username: string;
		graphSlug: string;
	}>();
	const u = username ?? "";
	const g = graphSlug ?? "";
	const qc = useQueryClient();

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

	// Dialog + confirm state for the authoring UI.
	const [modelForm, setModelForm] = useState<{
		open: boolean;
		model: GraphModelSummary | null;
	}>({ open: false, model: null });
	const [nodeForm, setNodeForm] = useState<{
		open: boolean;
		nodeType: NodeTypeResponse | null;
	}>({ open: false, nodeType: null });
	const [edgeForm, setEdgeForm] = useState<{
		open: boolean;
		edgeType: EdgeTypeResponse | null;
	}>({ open: false, edgeType: null });
	const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);

	// Resolve which version is on screen: prefer the editable draft, else the
	// published (active) version, else the model's single initial draft.
	const { data: versions } = useModelVersionsQuery(
		username,
		graphSlug,
		modelId,
	);
	const draftSummary = versions?.find((v) => v.status === "draft");
	const activeSummary = versions?.find((v) => v.status === "active");
	const targetVersionId =
		draftSummary?.id ??
		activeSummary?.id ??
		(versions && versions.length > 0
			? versions[versions.length - 1].id
			: undefined);

	const { data: version, isLoading: versionLoading } = useModelVersionQuery(
		username,
		graphSlug,
		modelId,
		targetVersionId,
	);

	const createDraft = useCreateDraftMutation(u, g);
	const publish = useActivateVersionMutation(u, g);
	const deleteNode = useDeleteNodeTypeMutation(u, g);
	const deleteEdge = useDeleteEdgeTypeMutation(u, g);

	const selectedModel = models?.find((m) => m.id === modelId);

	const openModel = (id: string) => {
		setModelId(id);
		setSelected(null);
	};
	const backToList = () => {
		setModelId(undefined);
		setSelected(null);
	};

	const isDraft = version?.status === "draft";
	// The system "global" model mirrors the physical DB — read-only, refreshed by Introspect.
	const isSystem = selectedModel?.origin === "introspected";
	const editable = isDraft && !isSystem;
	const ctx: ModelEditCtx | undefined =
		editable && modelId && version
			? { username: u, graphSlug: g, modelId, versionId: version.id }
			: undefined;

	const nodeTypes = version?.node_types ?? [];
	const edgeTypes = version?.edge_types ?? [];
	const propertyKeys = version?.property_keys ?? [];
	const constraints = version?.constraints ?? [];
	const indexes = version?.indexes ?? [];
	const isLoading = graphLoading || modelsLoading;
	const canPublish =
		isDraft && nodeTypes.length + edgeTypes.length + propertyKeys.length > 0;

	const handleIntrospect = async () => {
		if (!username || !graphSlug) return;
		setIntrospecting(true);
		try {
			await graphsApi.pingConnection(username, graphSlug);
			await graphsApi.introspectConnection(username, graphSlug);
			toast.success(
				"Introspecting the database — the global model will appear shortly.",
			);
			// Introspection runs asynchronously server-side (202). Refetch the model
			// list a couple of times so the new/updated global model shows up without
			// a manual reload.
			const refresh = () =>
				qc.invalidateQueries({ queryKey: ["models", u, g] });
			setTimeout(refresh, 1500);
			setTimeout(refresh, 4000);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Unknown error");
		} finally {
			setIntrospecting(false);
		}
	};

	const handleCreateDraft = async () => {
		if (!modelId) return;
		try {
			await createDraft.mutateAsync({
				modelId,
				basedOn: activeSummary?.version ?? null,
			});
			toast.success("Draft created — you can now edit this model.");
		} catch (err) {
			toast.error(
				err instanceof ApiError ? err.message : "Failed to create draft.",
			);
		}
	};

	// Edits persist to the draft as they're made; "Save" confirms and closes the
	// editor (the model stays a draft until Publish).
	const handleSaveDraft = () => {
		toast.success("Draft saved.");
		backToList();
	};

	const handlePublish = async () => {
		if (!modelId || !draftSummary) return;
		try {
			await publish.mutateAsync({ modelId, versionId: draftSummary.id });
			toast.success("Model published.");
			setSelected(null);
		} catch (err) {
			toast.error(err instanceof ApiError ? err.message : "Failed to publish.");
		}
	};

	const confirmDelete = async () => {
		if (!pendingDelete || !modelId || !version) return;
		const args = {
			modelId,
			versionId: version.id,
			typeId: pendingDelete.id,
		};
		try {
			if (pendingDelete.kind === "node") await deleteNode.mutateAsync(args);
			else await deleteEdge.mutateAsync(args);
			if (selected && "id" in selected && selected.id === pendingDelete.id) {
				setSelected(null);
			}
			toast.success("Type deleted.");
		} catch (err) {
			toast.error(err instanceof ApiError ? err.message : "Failed to delete.");
		} finally {
			setPendingDelete(null);
		}
	};

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
	} else if (!modelId || !selectedModel) {
		leftContent = (
			<ModelListPanel
				models={models ?? []}
				onSelect={openModel}
				username={u}
				graphSlug={g}
				onNewModel={() => setModelForm({ open: true, model: null })}
				onEditModel={(m) => setModelForm({ open: true, model: m })}
				onIntrospect={handleIntrospect}
				introspecting={introspecting}
			/>
		);
	} else {
		// Lifecycle controls — pinned to the bottom of the tab content. (TabbedPanel's
		// own footerContent doesn't shrink the body, so it would overflow; a bottom bar
		// inside the height-constrained body scrolls the nav above instead.)
		const lifecycleFooter = (
			<div className="flex flex-col gap-2 p-2 w-full border-t border-border shrink-0">
				<div className="flex items-center gap-1">
					{isSystem ? (
						<Button
							variant="outline"
							size="sm"
							className="h-7 flex-1"
							onClick={handleIntrospect}
							disabled={introspecting}
							title="Regenerate this model from the live database schema"
						>
							<RefreshCw
								className={`w-3 h-3 mr-1 ${introspecting ? "animate-spin" : ""}`}
							/>
							{introspecting ? "Introspecting…" : "Refresh from DB"}
						</Button>
					) : isDraft ? (
						<>
							<Button
								variant="outline"
								size="sm"
								className="h-7 flex-1"
								onClick={handleSaveDraft}
								title="Keep these edits as a draft (saved automatically as you go)"
							>
								<Save className="w-3 h-3 mr-1" />
								Save
							</Button>
							<Button
								size="sm"
								className="h-7 flex-1"
								onClick={handlePublish}
								disabled={!canPublish || publish.isPending}
							>
								<Send className="w-3 h-3 mr-1" />
								{publish.isPending ? "Publishing…" : "Publish"}
							</Button>
						</>
					) : (
						<Button
							variant="outline"
							size="sm"
							className="h-7 flex-1"
							onClick={handleCreateDraft}
							disabled={createDraft.isPending}
						>
							<Pencil className="w-3 h-3 mr-1" />
							{createDraft.isPending ? "Creating…" : "Create draft"}
						</Button>
					)}
				</div>
				{isSystem && (
					<p className="text-xs text-muted-foreground">
						Read-only — mirrors the live database schema.
					</p>
				)}
			</div>
		);
		const detailBody = (
			<div className="flex h-full flex-col">
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
							editable={editable}
							onAddNodeType={() => setNodeForm({ open: true, nodeType: null })}
							onAddEdgeType={() => setEdgeForm({ open: true, edgeType: null })}
							onDeleteNodeType={(id) => {
								const nt = nodeTypes.find((n) => n.id === id);
								if (nt) setPendingDelete({ kind: "node", id, name: nt.name });
							}}
							onDeleteEdgeType={(id) => {
								const et = edgeTypes.find((e) => e.id === id);
								if (et) setPendingDelete({ kind: "edge", id, name: et.name });
							}}
						/>
					)}
				</div>
				{lifecycleFooter}
			</div>
		);
		const breadcrumb = (
			<span className="flex items-center gap-1.5">
				{/* biome-ignore lint/a11y/useSemanticElements: this crumb renders inside the tab trigger (a <button>); a nested <button> is invalid DOM, so a keyboard-accessible role="link" span is used. */}
				<span
					role="link"
					tabIndex={0}
					onClick={(e) => {
						e.stopPropagation();
						backToList();
					}}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.stopPropagation();
							backToList();
						}
					}}
					className="text-muted-foreground hover:text-foreground cursor-pointer"
				>
					Models
				</span>
				<ChevronRight className="w-3 h-3 opacity-50" />
				<span className="truncate max-w-[120px]">{selectedModel.name}</span>
				{isSystem ? (
					<Badge variant="secondary">system</Badge>
				) : isDraft ? (
					<Badge variant="outline">draft</Badge>
				) : (
					version && <Badge variant="secondary">published</Badge>
				)}
			</span>
		);
		leftContent = (
			<TabbedPanel
				defaultTab="schema"
				tabs={[
					{
						value: "schema",
						label: breadcrumb,
						icon: Workflow,
						content: detailBody,
					},
				]}
			/>
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
						editable={editable}
						ctx={ctx}
						onEditNodeType={(nt) => setNodeForm({ open: true, nodeType: nt })}
						onDeleteNodeType={(id) => {
							const nt = nodeTypes.find((n) => n.id === id);
							if (nt) setPendingDelete({ kind: "node", id, name: nt.name });
						}}
						onEditEdgeType={(et) => setEdgeForm({ open: true, edgeType: et })}
						onDeleteEdgeType={(id) => {
							const et = edgeTypes.find((e) => e.id === id);
							if (et) setPendingDelete({ kind: "edge", id, name: et.name });
						}}
					/>
				</div>
			</ScrollArea>
		);

	return (
		<>
			<GraphDetail
				sectionId="modeller"
				pageLabel="Modeller"
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
						<div className="flex h-full flex-col">
							{graph && (
								<CompatibilityBanner
									username={u}
									graphSlug={g}
									connection={graph}
								/>
							)}
							<div className="min-h-0 flex-1">
								<SchemaCanvas
									nodeTypes={nodeTypes}
									edgeTypes={edgeTypes}
									selected={selected}
									onSelect={setSelected}
								/>
							</div>
						</div>
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
							{isSystem
								? " · system"
								: isDraft
									? " · draft"
									: version
										? " · published"
										: ""}
						</span>
					) : null
				}
			/>

			<ModelFormDialog
				open={modelForm.open}
				username={u}
				graphSlug={g}
				model={modelForm.model}
				onClose={() => setModelForm({ open: false, model: null })}
			/>

			{ctx && (
				<>
					<NodeTypeFormDialog
						open={nodeForm.open}
						ctx={ctx}
						nodeType={nodeForm.nodeType}
						existingNodeTypes={nodeTypes}
						onClose={() => setNodeForm({ open: false, nodeType: null })}
					/>
					<EdgeTypeFormDialog
						open={edgeForm.open}
						ctx={ctx}
						edgeType={edgeForm.edgeType}
						existingNodeTypes={nodeTypes}
						onClose={() => setEdgeForm({ open: false, edgeType: null })}
					/>
				</>
			)}

			<AlertDialog
				open={pendingDelete !== null}
				onOpenChange={(o) => !o && setPendingDelete(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Delete {pendingDelete?.kind} type?
						</AlertDialogTitle>
						<AlertDialogDescription>
							Delete "{pendingDelete?.name}"? This cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={confirmDelete}>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
