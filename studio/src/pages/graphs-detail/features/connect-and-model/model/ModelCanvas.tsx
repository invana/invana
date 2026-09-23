/**
 * The model canvas — the one place a gesture writes a type.
 *
 * `kind = model` is one of exactly two canvases whose gestures write
 * (canvasKinds.ts), and it writes only three things: **add** a node type,
 * **connect** two into an edge type, **delete**. Everything else about a type —
 * its properties, keys, constraints — is edited in the form, never in a modal
 * over the drawing (model-editor.md ME6).
 *
 * That form spans the main column *beneath* the canvas, which is what the hi-fi
 * `Model · a type selected` draws: the drawing stays visible while the thing it
 * selected is being edited.
 *
 * A published version's canvas is read-only (ME3) — no `ctx`, no tools, pan and
 * zoom only. Nothing here commits: the staged set lands as one action from the
 * panel.
 */

import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
	useCreateDraftMutation,
	useDeleteEdgeTypeMutation,
	useDeleteNodeTypeMutation,
	useModelVersionQuery,
	useModelVersionsQuery,
	useModelsQuery,
} from "@/hooks/queries/useModels";
import { EdgeTypeDetail } from "@/pages/graphs-detail/features/connect-and-model/model/components/EdgeTypeDetail";
import { EdgeTypeFormDialog } from "@/pages/graphs-detail/features/connect-and-model/model/components/EdgeTypeFormDialog";
import { NodeTypeDetail } from "@/pages/graphs-detail/features/connect-and-model/model/components/NodeTypeDetail";
import { NodeTypeFormDialog } from "@/pages/graphs-detail/features/connect-and-model/model/components/NodeTypeFormDialog";
import { SchemaCanvas } from "@/pages/graphs-detail/features/connect-and-model/model/components/SchemaCanvas";
import type { SelectedItem } from "@/pages/graphs-detail/features/connect-and-model/model/types";
import type { ModelSelection } from "@/pages/graphs-detail/features/connect-and-model/model/types";
import type { ModelEditCtx } from "@/pages/graphs-detail/features/connect-and-model/model/types";
import type { CanvasBackend } from "@/pages/graphs-detail/features/explorer";
import type { EdgeTypeResponse, NodeTypeResponse } from "@/types/schemas";
import { GraphToolProvider } from "@invana/canvas-react";
import { Button } from "@invana/ui";
import { Boxes, PanelBottomClose, Plus, X } from "lucide-react";
import { useState } from "react";

interface Props {
	username: string;
	graphSlug: string;
	modelId: string;
	backend?: CanvasBackend;
	/** The type the panel has selected; its form spans the column below. */
	selection: ModelSelection | null;
	onSelect: (selection: ModelSelection | null) => void;
	/** Close the model canvas, handing the main area back. */
	onClose?: () => void;
}

export function ModelCanvas({
	username,
	graphSlug,
	modelId,
	backend,
	selection,
	onSelect,
	onClose,
}: Props) {
	const [addingNode, setAddingNode] = useState(false);
	const [edgePrefill, setEdgePrefill] = useState<{
		source: string[];
		target: string[];
	} | null>(null);
	// Editing a type's metadata reopens the same form the create gesture uses —
	// the panel and the canvas never grow a second one (ME6).
	const [editingNode, setEditingNode] = useState<NodeTypeResponse | null>(null);
	const [editingEdge, setEditingEdge] = useState<EdgeTypeResponse | null>(null);
	const [deleting, setDeleting] = useState<{
		kind: "node" | "edge";
		id: string;
		name: string;
	} | null>(null);

	const models = useModelsQuery(username, graphSlug);
	const model = (models.data ?? []).find((m) => m.id === modelId) ?? null;
	const versions = useModelVersionsQuery(username, graphSlug, modelId);
	const list = versions.data ?? [];
	const draft = list.find((v) => v.status === "draft") ?? null;
	const active = list.find((v) => v.status === "active") ?? null;
	const openVersionId = draft?.id ?? active?.id;

	const version = useModelVersionQuery(
		username,
		graphSlug,
		modelId,
		openVersionId,
	);
	const tree = version.data;
	const nodeTypes = tree?.node_types ?? [];
	const edgeTypes = tree?.edge_types ?? [];

	// Editable only while a draft is open (ME3).
	const ctx: ModelEditCtx | undefined = draft
		? { username, graphSlug, modelId, versionId: draft.id }
		: undefined;

	const selectedNode =
		selection?.kind === "node_type"
			? (nodeTypes.find((t) => t.name === selection.name) ?? null)
			: null;
	const selectedEdge =
		selection?.kind === "edge_type"
			? (edgeTypes.find((t) => t.name === selection.name) ?? null)
			: null;

	// The canvas re-announces its inspect target on every render of this
	// component; answering an unchanged target with a fresh object would write
	// state on the page that owns the selection, re-render this canvas, and
	// announce again. Same selection, no write — the loop has nowhere to go.
	const select = (next: ModelSelection | null) => {
		if (next?.kind === selection?.kind && next?.name === selection?.name)
			return;
		onSelect(next);
	};

	const canvasSelection: SelectedItem = selectedNode
		? { kind: "node-type", id: selectedNode.id }
		: selectedEdge
			? { kind: "edge-type", id: selectedEdge.id }
			: null;

	const deleteNode = useDeleteNodeTypeMutation(username, graphSlug);
	const deleteEdge = useDeleteEdgeTypeMutation(username, graphSlug);
	// `NodeTypeDetail` and `EdgeTypeDetail` already carry a "Create draft to edit"
	// affordance for exactly this case — it just needs somewhere to go. Without it
	// the form renders read-only with no way out, which reads as "editing is not
	// built" rather than "this version is published" (ME11).
	const createDraft = useCreateDraftMutation(username, graphSlug);
	const openDraft = () =>
		createDraft.mutate({ modelId, basedOn: active?.version ?? null });

	return (
		// `SchemaCanvas`'s authoring path reads the active tool through `useTool`,
		// which needs a provider **above** it — the retired Modeller page lifted one
		// over its whole shell. Without it the canvas threw on mount, so nothing
		// below this line had ever rendered.
		//
		// It wraps the header too, because the tool switcher lives there and is the
		// gesture's only entry point: Add and Connect are how a type and an edge get
		// drawn (ME1), and a switcher outside the provider cannot arm them.
		<GraphToolProvider defaultTool="select">
			<div className="flex h-full min-h-0 flex-col">
				{/* The canvas says what it is drawing and whether it may be drawn on —
			    a read-only version looks identical otherwise (ME3). */}
				<div className="flex h-9 shrink-0 items-center gap-2 border-b bg-card px-2 text-base">
					<span className="flex h-7 items-center gap-1.5 rounded-sm border border-primary/40 bg-primary/10 px-2">
						<Boxes className="h-3.5 w-3.5 text-primary" />
						<span className="font-mono">{model?.name ?? "Model"}</span>
						<span className="text-muted-foreground">
							{draft
								? `v${draft.version ?? "—"} draft`
								: active
									? `v${active.version} read-only`
									: "no version"}
						</span>
						{onClose ? (
							<button
								type="button"
								onClick={onClose}
								title="Close this canvas"
								aria-label="Close this canvas"
								className="ml-0.5 text-muted-foreground hover:text-foreground"
							>
								<X className="h-3.5 w-3.5" />
							</button>
						) : null}
					</span>
					{ctx ? (
						<span className="ml-auto flex items-center gap-1.5">
							<Button
								size="sm"
								variant="outline"
								onClick={() => setAddingNode(true)}
							>
								<Plus className="mr-1 h-3.5 w-3.5" /> Node type
							</Button>
							<span className="text-sm text-muted-foreground">
								or drag one type onto another to connect them
							</span>
						</span>
					) : null}
				</div>

				<div className="min-h-0 flex-1">
					<SchemaCanvas
						nodeTypes={nodeTypes}
						edgeTypes={edgeTypes}
						selected={canvasSelection}
						backend={backend}
						ctx={ctx}
						onSelect={(item) => {
							if (!item) return select(null);
							if (item.kind === "node-type") {
								const hit = nodeTypes.find((t) => t.id === item.id);
								return select(
									hit ? { kind: "node_type", name: hit.name } : null,
								);
							}
							if (item.kind === "edge-type") {
								const hit = edgeTypes.find((t) => t.id === item.id);
								return select(
									hit ? { kind: "edge_type", name: hit.name } : null,
								);
							}
							select(null);
						}}
						onRequestAddNode={ctx ? () => setAddingNode(true) : undefined}
						onRequestAddEdge={
							ctx
								? ({ source, target }) => {
										// The endpoints come from the drag — that is the whole
										// reason this gesture is allowed to write (ME1).
										const sourceName = nodeTypes.find(
											(t) => t.id === source,
										)?.name;
										const targetName = nodeTypes.find(
											(t) => t.id === target,
										)?.name;
										setEdgePrefill({
											source: sourceName ? [sourceName] : [],
											target: targetName ? [targetName] : [],
										});
									}
								: undefined
						}
					/>
				</div>

				{/* ME6 — the selected type's form spans the main column, under the drawing. */}
				{selection && (selectedNode || selectedEdge) ? (
					<div className="max-h-[45%] shrink-0 overflow-y-auto border-t bg-background">
						<div className="flex items-center justify-between border-b px-4 py-1.5">
							<span className="text-sm uppercase tracking-wide text-muted-foreground">
								{model?.name ?? "Model"} ·{" "}
								{draft
									? `v${draft.version ?? "draft"} draft`
									: `v${active?.version} active`}
							</span>
							<Button
								size="sm"
								variant="ghost"
								onClick={() => onSelect(null)}
								title="Close the form"
							>
								<PanelBottomClose className="h-4 w-4" />
							</Button>
						</div>
						<div className="p-4">
							{selectedNode ? (
								<NodeTypeDetail
									nodeType={selectedNode}
									constraints={tree?.constraints ?? []}
									indexes={tree?.indexes ?? []}
									propertyKeys={tree?.property_keys ?? []}
									editable={!!ctx}
									ctx={ctx}
									canEditViaDraft={!ctx}
									creatingDraft={createDraft.isPending}
									onEditViaDraft={openDraft}
									onEdit={() => setEditingNode(selectedNode)}
									onDelete={() =>
										setDeleting({
											kind: "node",
											id: selectedNode.id,
											name: selectedNode.name,
										})
									}
								/>
							) : selectedEdge ? (
								<EdgeTypeDetail
									edgeType={selectedEdge}
									constraints={tree?.constraints ?? []}
									indexes={tree?.indexes ?? []}
									propertyKeys={tree?.property_keys ?? []}
									editable={!!ctx}
									ctx={ctx}
									canEditViaDraft={!ctx}
									creatingDraft={createDraft.isPending}
									onEditViaDraft={openDraft}
									onEdit={() => setEditingEdge(selectedEdge)}
									onDelete={() =>
										setDeleting({
											kind: "edge",
											id: selectedEdge.id,
											name: selectedEdge.name,
										})
									}
								/>
							) : null}
						</div>
					</div>
				) : null}

				{!ctx ? (
					<div className="flex shrink-0 items-center gap-2 border-t px-4 py-1.5 text-sm text-muted-foreground">
						<span>
							{active
								? `v${active.version} is published — pan and zoom only.`
								: "Nothing published yet."}
						</span>
						<span className="ml-auto">
							Open a draft in the panel to author.
						</span>
					</div>
				) : null}

				{ctx ? (
					<>
						<NodeTypeFormDialog
							open={addingNode || editingNode !== null}
							ctx={ctx}
							nodeType={editingNode}
							existingNodeTypes={nodeTypes}
							onClose={() => {
								setAddingNode(false);
								setEditingNode(null);
							}}
						/>
						<EdgeTypeFormDialog
							open={edgePrefill !== null || editingEdge !== null}
							ctx={ctx}
							edgeType={editingEdge}
							prefill={edgePrefill ?? undefined}
							existingNodeTypes={nodeTypes}
							onClose={() => {
								setEdgePrefill(null);
								setEditingEdge(null);
							}}
						/>
						{/* A delete is staged like anything else (ME2) — the confirm says
					    so, because "deleted" and "staged for deletion" are different
					    promises. */}
						<ConfirmDialog
							open={deleting !== null}
							title={`Delete ${deleting?.name ?? ""}?`}
							description={
								"It is staged, not gone: the draft loses it, and it leaves the " +
								"published model when you commit. Discard the staged set to put it back."
							}
							confirmLabel="Stage the delete"
							destructive
							onOpenChange={(open) => {
								if (!open) setDeleting(null);
							}}
							onConfirm={() => {
								if (!deleting) return;
								const args = {
									modelId,
									versionId: ctx.versionId,
									typeId: deleting.id,
								};
								if (deleting.kind === "node") deleteNode.mutate(args);
								else deleteEdge.mutate(args);
								onSelect(null);
								setDeleting(null);
							}}
						/>
					</>
				) : null}
			</div>
		</GraphToolProvider>
	);
}
