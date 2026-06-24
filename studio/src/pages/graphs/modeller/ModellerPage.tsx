import {
	CanvasContext,
	CanvasMessageBar,
	GraphStatusBar as CanvasStatusBar,
	GraphToolProvider,
	canUseWebGPU,
} from "@invana/canvas-react";
import type { GraphCanvas } from "@invana/graph";
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
	Info,
	PanelLeftClose,
	PanelRightClose,
	PanelRightOpen,
	Pencil,
	RefreshCw,
	Send,
	Trash2,
	Workflow,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { SetupRequiredBanner } from "../../../components/settings/SetupRequiredBanner";
import { useSettingsPanel } from "../../../components/settings/useSettingsPanel";
import {
	useGraphConnectionQuery,
	useGraphQuery,
} from "../../../hooks/queries/useGraphs";
import {
	useActivateVersionMutation,
	useCreateDraftMutation,
	useDeleteEdgeTypeMutation,
	useDeleteNodeTypeMutation,
	useModelQuery,
	useModelVersionQuery,
	useModelVersionsQuery,
	useModelsQuery,
	useUpdateEdgeTypeMutation,
} from "../../../hooks/queries/useModels";
import { ApiError, suppressActionToast } from "../../../services/api/client";
import { graphsApi } from "../../../services/api/graphs";
import { isSetupComplete } from "../../../types/graphs";
import type { GraphModelSummary } from "../../../types/models";
import type {
	EdgeTypeResponse,
	NodeTypeResponse,
} from "../../../types/schemas";
import { GraphDetail } from "../components/GraphDetail";
import { RendererCapabilityBanner } from "../components/RendererCapabilityBanner";
import {
	type CanvasBackend,
	ExplorerHeaderToolbar,
} from "../explorer/components/ExplorerCanvas";
import { CompatibilityBanner } from "./components/CompatibilityBanner";
import { DeleteModelDialog } from "./components/DeleteModelDialog";
import type { SelectedItem } from "./components/DetailPanel";
import { DetailPanel } from "./components/DetailPanel";
import { EdgeTypeFormDialog } from "./components/EdgeTypeFormDialog";
import { ModelFormDialog } from "./components/ModelFormDialog";
import { ModelListPanel } from "./components/ModelListPanel";
import { NodeTypeFormDialog } from "./components/NodeTypeFormDialog";
import {
	ModellerHeaderToolbar,
	ModellerViewToolbar,
	SchemaCanvas,
} from "./components/SchemaCanvas";
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

	// Collapsed panel state lives in the URL (`?models=closed` / `?detail=closed`),
	// mirroring the Explorer Sessions convention. Each panel's header collapse
	// control sets its param; a re-open button in the page header (shown only
	// while collapsed) clears it. The left panel also re-opens via the left-rail
	// Modeller icon, which drops the query string.
	const [searchParams, setSearchParams] = useSearchParams();
	const rightClosed = searchParams.get("detail") === "closed";
	// The schema panel is just the Modeller's entry in the shared single-open
	// left-rail param (`?settings=schema`); GraphDetail decides when to show it.
	// `close` doubles as the panel's collapse + the SchemaNav close button.
	const settingsPanel = useSettingsPanel();
	const setPanelParam = useCallback(
		(key: string, closed: boolean) => {
			const next = new URLSearchParams(searchParams);
			if (closed) next.set(key, "closed");
			else next.delete(key);
			setSearchParams(next, { replace: true });
		},
		[searchParams, setSearchParams],
	);
	const closeLeft = settingsPanel.close;
	const closeRight = useCallback(
		() => setPanelParam("detail", true),
		[setPanelParam],
	);
	const openRight = useCallback(
		() => setPanelParam("detail", false),
		[setPanelParam],
	);

	const { data: graph, isLoading: graphLoading } = useGraphConnectionQuery(
		username,
		graphSlug,
	);
	const connectionMissing = !graphLoading && !graph;

	// Same gate as the engine's `require_graph_setup_complete` (409) — block the
	// modeller until the required setup-wizard sections are finished.
	const { data: graphContainer } = useGraphQuery(username, graphSlug);
	const setupIncomplete = !!graphContainer && !isSetupComplete(graphContainer);

	const { data: models, isLoading: modelsLoading } = useModelsQuery(
		username,
		graphSlug,
	);
	// `modelId === undefined` → show the model list; set → drill into that model.
	const [modelId, setModelId] = useState<string | undefined>();
	const [selected, setSelected] = useState<SelectedItem>(null);
	const [introspecting, setIntrospecting] = useState(false);

	// The live canvas engine, lifted out of <Canvas> by <CanvasBridge> (in
	// SchemaCanvas). Null until the graph is fully wired; gates the header toolbar
	// + footer status bar that resolve it off the lifted CanvasContext.
	const [canvas, setCanvas] = useState<GraphCanvas | null>(null);
	const handleReady = useCallback((c: GraphCanvas | null) => setCanvas(c), []);

	// Render backend (PixiJS) for the read-only explore canvas — mirrors the
	// Explorer. Defaults to WebGPU when the device can select it (`canUseWebGPU` —
	// API present and not WebKit), else WebGL; the header switcher persists the
	// choice across reloads. The engine downgrades/retries to WebGL at init if
	// WebGPU can't actually initialise, so no runtime fallback is needed here.
	const [backend, setBackendState] = useState<CanvasBackend>(() => {
		const saved =
			typeof localStorage !== "undefined"
				? localStorage.getItem("modeller.canvas.backend")
				: null;
		if (saved === "webgl") return "webgl";
		return canUseWebGPU() ? "webgpu" : "webgl";
	});
	const setBackend = useCallback((b: CanvasBackend) => {
		setBackendState(b);
		try {
			localStorage.setItem("modeller.canvas.backend", b);
		} catch {
			// Private-mode / disabled storage — keep the in-memory choice.
		}
	}, []);

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
		// Set when the Connect-tool gesture opens the dialog — seeds the
		// source/target checklists with the dragged endpoints' node-type names.
		prefill?: { source: string[]; target: string[] };
	}>({ open: false, edgeType: null });
	const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
	// Whole-model deletion (mirrors the list's per-row action). Holds the model
	// pending confirmation; the system/global model is read-only and never set.
	const [pendingModelDelete, setPendingModelDelete] =
		useState<GraphModelSummary | null>(null);
	// Confirms the single whole-model commit (Publish) — staged draft edits only
	// reach the active version through this deliberate step (RFC-029).
	const [publishConfirm, setPublishConfirm] = useState(false);

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
	const updateEdge = useUpdateEdgeTypeMutation(u, g);

	const selectedModel = models?.find((m) => m.id === modelId);
	// Full model detail (validation_mode, created_at, yaml_path) for the Details
	// overview — the list summary lacks those fields. Falls back to the summary
	// while it loads.
	const { data: modelDetail } = useModelQuery(username, graphSlug, modelId);

	const openModel = (id: string) => {
		setModelId(id);
		setSelected(null);
	};
	const backToList = () => {
		setModelId(undefined);
		setSelected(null);
	};

	// On first load, open the system "global" (introspected) model by default — it's
	// the live DB schema and the most useful landing view. One-shot (a ref guard) so
	// navigating back to the list with `backToList` isn't immediately overridden.
	const defaultedRef = useRef(false);
	useEffect(() => {
		if (defaultedRef.current || !models) return;
		defaultedRef.current = true;
		if (!modelId) {
			const globalModel = models.find((m) => m.origin === "introspected");
			if (globalModel) setModelId(globalModel.id);
		}
	}, [models, modelId]);

	const isDraft = version?.status === "draft";
	// The system "global" model mirrors the physical DB — read-only, refreshed by Introspect.
	const isSystem = selectedModel?.origin === "introspected";
	const editable = isDraft && !isSystem;
	const ctx: ModelEditCtx | undefined =
		editable && modelId && version
			? { username: u, graphSlug: g, modelId, versionId: version.id }
			: undefined;
	// A published (non-system) model is read-only but *draftable* — the Details
	// panel offers a "Create draft to edit" affordance that drafts it and switches
	// to the editable PropertyEditor. The system/global model stays fully read-only.
	const canEditViaDraft = !isDraft && !isSystem && !!version;

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
		} catch (err) {
			toast.error(
				err instanceof ApiError ? err.message : "Failed to create draft.",
			);
		}
	};

	// "Create draft to edit" from a read-only type's Details panel: a draft has new
	// per-version type ids, so the current id-based selection would dangle. Remember
	// the selected type by *name* and re-select it once the draft loads (effect
	// below), so the user lands directly on the same type's editable PropertyEditor.
	const reselectRef = useRef<{
		kind: "node-type" | "edge-type";
		name: string;
	} | null>(null);
	const handleEditViaDraft = async () => {
		if (selected?.kind === "node-type") {
			const nt = nodeTypes.find((n) => n.id === selected.id);
			if (nt) reselectRef.current = { kind: "node-type", name: nt.name };
		} else if (selected?.kind === "edge-type") {
			const et = edgeTypes.find((e) => e.id === selected.id);
			if (et) reselectRef.current = { kind: "edge-type", name: et.name };
		}
		await handleCreateDraft();
	};
	useEffect(() => {
		const target = reselectRef.current;
		if (!target || !isDraft) return;
		const match =
			target.kind === "node-type"
				? nodeTypes.find((n) => n.name === target.name)
				: edgeTypes.find((e) => e.name === target.name);
		if (match) {
			setSelected({ kind: target.kind, id: match.id });
			reselectRef.current = null;
		}
	}, [isDraft, nodeTypes, edgeTypes]);

	const handlePublish = async () => {
		if (!modelId || !draftSummary) return;
		try {
			await publish.mutateAsync({ modelId, versionId: draftSummary.id });
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
			// Draft edits stage silently (RFC-029) — Publish is the single commit.
			await suppressActionToast(async () => {
				if (pendingDelete.kind === "node") await deleteNode.mutateAsync(args);
				else await deleteEdge.mutateAsync(args);
			});
			if (selected && "id" in selected && selected.id === pendingDelete.id) {
				setSelected(null);
			}
		} catch (err) {
			toast.error(err instanceof ApiError ? err.message : "Failed to delete.");
		} finally {
			setPendingDelete(null);
		}
	};

	// ── Canvas authoring gestures ───────────────────────────────────────────────
	// The interactive SchemaCanvas only *requests* edits; the dialogs + mutations
	// already live here, so each gesture maps onto the same draft-only flow the
	// SchemaNav uses. All guarded on `ctx` (an editable draft).

	// Erase tool: delete straight away (no confirm — the EraseBehaviour already
	// removed it from the canvas store; the refetch is authoritative).
	const handleEraseType = async (d: { kind: "node" | "edge"; id: string }) => {
		if (!ctx) return;
		const args = {
			modelId: ctx.modelId,
			versionId: ctx.versionId,
			typeId: d.id,
		};
		try {
			// Erase deletes silently by design (the canvas already removed the
			// element) — suppress the per-request action toast (RFC-028).
			await suppressActionToast(async () => {
				if (d.kind === "node") await deleteNode.mutateAsync(args);
				else await deleteEdge.mutateAsync(args);
			});
			if (selected && "id" in selected && selected.id === d.id)
				setSelected(null);
		} catch (err) {
			toast.error(err instanceof ApiError ? err.message : "Failed to delete.");
		}
	};

	// Reverse an edge type's direction → swap source/target node-type names.
	const handleReverseEdge = async (edgeTypeId: string) => {
		if (!ctx) return;
		const et = edgeTypes.find((e) => e.id === edgeTypeId);
		if (!et) return;
		try {
			// Reverse reuses the generic edge-type PATCH; draft edits stage silently
			// (RFC-029) — suppress the per-request toast and emit no summary.
			await suppressActionToast(() =>
				updateEdge.mutateAsync({
					modelId: ctx.modelId,
					versionId: ctx.versionId,
					typeId: edgeTypeId,
					data: {
						source_node_types: et.target_node_types,
						target_node_types: et.source_node_types,
					},
				}),
			);
		} catch (err) {
			toast.error(err instanceof ApiError ? err.message : "Failed to reverse.");
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
		leftContent = (
			<SetupRequiredBanner pageLabel="Modeller" reason="connection" />
		);
	} else if (setupIncomplete) {
		leftContent = <SetupRequiredBanner pageLabel="Modeller" reason="setup" />;
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
				onClose={closeLeft}
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
						<Button
							size="sm"
							className="h-7 flex-1"
							onClick={() => setPublishConfirm(true)}
							disabled={!canPublish || publish.isPending}
							title="Commit all staged changes — publish this draft as the active version"
						>
							<Send className="w-3 h-3 mr-1" />
							{publish.isPending ? "Publishing…" : "Publish"}
						</Button>
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
				{isDraft &&
					(canPublish ? (
						<p className="flex items-center gap-1.5 text-muted-foreground">
							<span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
							Unpublished changes — staged in this draft. Publish to commit.
						</p>
					) : (
						<p className="text-muted-foreground">
							Add node types, edge types or properties, then Publish to commit.
						</p>
					))}
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
				headerActions={{
					rightNavItems: [
						// The system "global" model mirrors the live DB — read-only, no edit/delete.
						...(isSystem
							? []
							: [
									{
										key: "edit",
										name: "Edit model",
										icon: Pencil,
										onClick: () =>
											setModelForm({ open: true, model: selectedModel }),
									},
									{
										key: "delete",
										name: "Delete model",
										icon: Trash2,
										onClick: () => setPendingModelDelete(selectedModel),
									},
								]),
						{
							key: "close",
							name: "Collapse panel",
							icon: PanelLeftClose,
							onClick: closeLeft,
						},
					],
				}}
			/>
		);
	}

	// ── Right section ──────────────────────────────────────────────────────────
	const rightBody =
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
						model={modelDetail ?? selectedModel}
						canEditModel={!isSystem}
						onEditModel={() =>
							selectedModel &&
							setModelForm({ open: true, model: selectedModel })
						}
						nodeTypes={nodeTypes}
						edgeTypes={edgeTypes}
						propertyKeys={propertyKeys}
						constraints={constraints}
						indexes={indexes}
						editable={editable}
						ctx={ctx}
						canEditViaDraft={canEditViaDraft}
						creatingDraft={createDraft.isPending}
						onEditViaDraft={handleEditViaDraft}
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
	// Wrapped in a TabbedPanel (like the Explorer Inspector) so the header can
	// host the collapse control, matching the Sessions/left-panel pattern.
	const rightContent = (
		<TabbedPanel
			defaultTab="details"
			tabs={[
				{ value: "details", label: "Details", icon: Info, content: rightBody },
			]}
			headerActions={{
				rightNavItems: [
					{
						key: "close",
						name: "Collapse panel",
						icon: PanelRightClose,
						onClick: closeRight,
					},
				],
			}}
		/>
	);

	// Right-panel (details) toggle for the page header — always shown, next to
	// the profile menu. The left (models) panel is driven by the left nav rail.
	// Reflects the panel's state: a collapse icon while open, an expand icon
	// while collapsed.
	const panelControls = (
		<Button
			variant="ghost"
			size="icon"
			className="h-7 w-7"
			onClick={rightClosed ? openRight : closeRight}
			title={rightClosed ? "Show details panel" : "Hide details panel"}
		>
			{rightClosed ? (
				<PanelRightOpen className="w-4 h-4" />
			) : (
				<PanelRightClose className="w-4 h-4" />
			)}
		</Button>
	);

	// Header toolbar, absolute-centered against the full header width (mirroring the
	// Explorer). On an editable draft: the Select / Add / Connect / Delete drawing
	// switcher (engine-independent — reads the lifted GraphToolProvider, so it
	// appears immediately) PLUS a trimmed view-controls strip (zoom / fit / lock /
	// grid) once the canvas is live, so authoring keeps its navigation. On a
	// read-only model (global/introspected + published): the Explorer's full canvas
	// toolbar — layout switcher, run/re-render, zoom / fit / lock, grid,
	// render-backend — minus the magnet and undo/redo. Both view-control strips
	// resolve the live engine off CanvasContext, so they're gated on `canvas`.
	const headerToolbar =
		modelId && version ? (
			<div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2">
				{ctx ? (
					<>
						<ModellerHeaderToolbar editable />
						{canvas?.isInitialised && <ModellerViewToolbar />}
					</>
				) : canvas?.isInitialised ? (
					// `isInitialised` gates out an engine whose Pixi viewport is torn
					// down — the Explorer toolbar's view-section reads `camera.scale`
					// (→ `viewport.scale.x`) on mount and would crash on a dead engine
					// (e.g. a Fast-Refresh-preserved stale instance mid-remount).
					<ExplorerHeaderToolbar
						showMagnet={false}
						showHistory={false}
						showSelectMode={false}
						backend={backend}
						onBackendChange={setBackend}
					/>
				) : null}
			</div>
		) : undefined;

	return (
		// Lifted providers reach the header toolbar (a sibling of <Canvas>, outside
		// its own provider): the active tool via GraphToolProvider (pure state, owns
		// no engine) and the live engine via CanvasContext (fed by <CanvasBridge> in
		// SchemaCanvas). The footer's status bar + message bar resolve the same
		// engine. Esc returns to the Select tool (GraphToolProvider default).
		<GraphToolProvider defaultTool="select">
			<CanvasContext.Provider value={canvas}>
				<GraphDetail
					sectionId="modeller"
					pageLabel="Modeller"
					headerPanelControls={panelControls}
					headerCenter={headerToolbar}
					// GraphDetail shows this only while `?settings=schema` is the open
					// rail panel; otherwise it docks a settings section or nothing.
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
							<div className="flex h-full flex-col overflow-hidden">
								{graph && (
									<CompatibilityBanner
										username={u}
										graphSlug={g}
										connection={graph}
									/>
								)}
								{/* overflow-hidden: the PixiJS canvas autoResizes to its
								    container and can round its element up by a pixel — without
								    this the overflow nudges the layout wider when the right
								    panel collapses (matches the Explorer's canvas wrapper). */}
								<div className="relative min-h-0 flex-1 overflow-hidden">
									<RendererCapabilityBanner />
									<SchemaCanvas
										nodeTypes={nodeTypes}
										edgeTypes={edgeTypes}
										selected={selected}
										onSelect={setSelected}
										ctx={ctx}
										backend={backend}
										onReady={handleReady}
										onRequestAddNode={() =>
											setNodeForm({ open: true, nodeType: null })
										}
										onRequestAddEdge={({ source, target }) =>
											setEdgeForm({
												open: true,
												edgeType: null,
												prefill: { source: [source], target: [target] },
											})
										}
										onRequestDelete={setPendingDelete}
										onEraseType={handleEraseType}
										onReverseEdge={handleReverseEdge}
									/>
								</div>
							</div>
						),
					}}
					rightSection={
						rightClosed
							? undefined
							: {
									defaultSize: "360px",
									minSize: "240px",
									maxSize: "600px",
									collapsible: false,
									content: rightContent,
								}
					}
					statusMetrics={
						// Live engine telemetry (node/edge totals, zoom, pan, pointer) once
						// the canvas is up; the type counts otherwise (model list / no canvas).
						// `isInitialised` guards against a torn-down engine (see header toolbar).
						canvas?.isInitialised ? (
							<CanvasStatusBar />
						) : modelId && version ? (
							<div className="flex items-center gap-3">
								<span>{nodeTypes.length} node types</span>
								<span>{edgeTypes.length} edge types</span>
							</div>
						) : null
					}
					footerRightExtras={
						<>
							{/* Per-tool hint pushed via Canvas.showMessage from <ModellerTools>. */}
							{canvas?.isInitialised && <CanvasMessageBar />}
							{selectedModel && (
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
							)}
						</>
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
							prefill={edgeForm.prefill}
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

				<AlertDialog
					open={publishConfirm}
					onOpenChange={(o) => !o && setPublishConfirm(false)}
				>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Publish this model?</AlertDialogTitle>
							<AlertDialogDescription>
								This commits all staged changes to the active version:{" "}
								{nodeTypes.length} node type{nodeTypes.length === 1 ? "" : "s"},{" "}
								{edgeTypes.length} edge type{edgeTypes.length === 1 ? "" : "s"},{" "}
								{propertyKeys.length} property key
								{propertyKeys.length === 1 ? "" : "s"}.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction onClick={handlePublish}>
								Publish
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>

				<DeleteModelDialog
					model={pendingModelDelete}
					username={u}
					graphSlug={g}
					onClose={() => setPendingModelDelete(null)}
					onDeleted={backToList}
				/>
			</CanvasContext.Provider>
		</GraphToolProvider>
	);
}
