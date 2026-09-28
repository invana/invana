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
 * selected is being edited. It is the model page's Model tab at one model
 * (the-model-page.md): what the model is and whether it is drafting read on the
 * page header, so the canvas draws and carries no header of its own.
 *
 * A published version's canvas is read-only (ME3) — no `ctx`, pan and zoom
 * only. Nothing here commits: Publish is on the page header (MP4).
 */

import {
	GraphModelCanvas,
	type ModelCanvasSelection,
	graphModelSettings,
	graphModelTemplates,
	hueSlotForName,
} from "@/canvases/model";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { CanvasBackend } from "@/pages/graphs-detail/features/explorer";
import { EdgeTypeDetail } from "@/pages/graphs-detail/features/models/model-editor/components/EdgeTypeDetail";
import { EdgeTypeFormDialog } from "@/pages/graphs-detail/features/models/model-editor/components/EdgeTypeFormDialog";
import { NodeTypeDetail } from "@/pages/graphs-detail/features/models/model-editor/components/NodeTypeDetail";
import { NodeTypeFormDialog } from "@/pages/graphs-detail/features/models/model-editor/components/NodeTypeFormDialog";
import type {
	ModelEditCtx,
	ModelSelection,
} from "@/pages/graphs-detail/features/models/model-editor/types";
import {
	useCreateDraftMutation,
	useDeleteEdgeTypeMutation,
	useDeleteNodeTypeMutation,
	useModelVersionQuery,
	useModelVersionsQuery,
	useModelsQuery,
} from "@/pages/graphs-detail/features/models/queries";
import {
	buildAllModelsData,
	memberIdOf,
	parseMemberId,
} from "@/pages/graphs-detail/features/models/stitch/allModels";
import type {
	EdgeTypeResponse,
	NodeTypeResponse,
} from "@/pages/graphs-detail/features/models/types";
import { Button, EmptyState } from "@invana/ui";
import { PanelBottomClose } from "lucide-react";
import { useMemo, useState } from "react";

interface Props {
	username: string;
	graphSlug: string;
	modelId: string;
	/** The page's render backend — the canvas starts on it (GM13). */
	backend?: CanvasBackend;
	/** The type the panel has selected; its form spans the column below. */
	selection: ModelSelection | null;
	onSelect: (selection: ModelSelection | null) => void;
	/** A member without write reads the form and never edits it (the-model-page.md seams). */
	canWrite?: boolean;
}

export function ModelCanvas({
	username,
	graphSlug,
	modelId,
	backend,
	selection,
	onSelect,
	canWrite = true,
}: Props) {
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

	// Editable only while a draft is open (ME3), and only by a member who writes.
	const ctx: ModelEditCtx | undefined =
		draft && canWrite
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

	// One model on the same canvas as All models: its types and its own edge
	// types, with no frame — the page is already the model (ME26). The version drawn is the draft while one is open.
	const build = useMemo(
		() =>
			buildAllModelsData(
				[
					{
						modelId,
						name: model?.name ?? "Model",
						description: model?.description ?? "",
						versionId: openVersionId ?? null,
						versionLabel: draft
							? draft.version
								? `v${draft.version} draft`
								: "draft"
							: active
								? `v${active.version}`
								: null,
						hue: hueSlotForName(model?.name ?? "Model"),
						nodeTypes,
						edgeTypes,
					},
				],
				[],
				{ framed: false },
			),
		[modelId, model, openVersionId, draft, active, nodeTypes, edgeTypes],
	);

	// The panel selects by name; the canvas by id.
	const canvasSelection: ModelCanvasSelection = selectedNode
		? { kind: "node", id: memberIdOf(modelId, selectedNode.name) }
		: selectedEdge
			? (() => {
					const hit = build.data.edges.find(
						(e) => e.type === selectedEdge.name,
					);
					return hit ? { kind: "edge" as const, id: hit.id } : null;
				})()
			: null;

	const onCanvasSelect = (next: ModelCanvasSelection) => {
		if (next?.kind === "node") {
			const member = parseMemberId(next.id);
			return select(
				member ? { kind: "node_type", name: member.typeName } : null,
			);
		}
		if (next?.kind === "edge") {
			const hit = build.data.edges.find((e) => e.id === next.id);
			return select(hit ? { kind: "edge_type", name: hit.type } : null);
		}
		select(null);
	};

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
		<div className="flex h-full min-h-0 flex-col">
			<div className="min-h-0 flex-1">
				{/* No frame to size, so a model with no types says so instead (ME26). */}
				{tree && nodeTypes.length === 0 ? (
					<EmptyState
						className="h-full"
						title="No types yet"
						description={
							ctx
								? "Add a node type to start drawing this model."
								: "This version declares no types."
						}
					/>
				) : (
					<GraphModelCanvas
						data={build.data}
						settings={graphModelSettings}
						templates={graphModelTemplates}
						message="Hover a type for its properties, an edge for what it connects"
						selected={canvasSelection}
						onSelect={onCanvasSelect}
						backend={backend}
						initialDetail="medium"
					/>
				)}
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
								canEditViaDraft={!ctx && canWrite}
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
								canEditViaDraft={!ctx && canWrite}
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

			{ctx ? (
				<>
					<NodeTypeFormDialog
						open={editingNode !== null}
						ctx={ctx}
						nodeType={editingNode}
						existingNodeTypes={nodeTypes}
						onClose={() => setEditingNode(null)}
					/>
					<EdgeTypeFormDialog
						open={editingEdge !== null}
						ctx={ctx}
						edgeType={editingEdge}
						existingNodeTypes={nodeTypes}
						onClose={() => setEditingEdge(null)}
					/>
					{/* A delete is staged like anything else (ME2) — the confirm says
					    so, because "deleted" and "staged for deletion" are different
					    promises. */}
					<ConfirmDialog
						open={deleting !== null}
						title={`Delete ${deleting?.name ?? ""}?`}
						description={
							"It is staged, not gone: the draft loses it, and it leaves the " +
							"published model when you publish. Discard the staged set to put it back."
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
	);
}
