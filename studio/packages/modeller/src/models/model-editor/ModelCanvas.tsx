/**
 * One model's canvas — the drawing behind *Open in Schema*.
 *
 * It draws the open version of one model (the draft while one is open) on the
 * same `GraphModelCanvas` as the global model, with no frame: the page's
 * breadcrumb already names the model. It only reads — a type clicked on it is
 * handed to the page, which opens that type's own page, where a draft's
 * properties, indexes and constraints are edited. Nothing here commits:
 * Publish is on the page header.
 */

import { EmptyState } from "@invana/ui";
import {
	type CanvasBackend,
	GraphModelCanvas,
	hueSlotForName,
	type ModelCanvasSelection,
} from "@invana-studio/canvases";
import { useMemo } from "react";
import {
	useModelsQuery,
	useModelVersionQuery,
	useModelVersionsQuery,
} from "../queries";
import {
	buildAllModelsData,
	memberIdOf,
	parseMemberId,
} from "../stitch/allModels";
import type { ModelSelection } from "./types";

interface Props {
	username: string;
	graphSlug: string;
	modelId: string;
	/** The page's render backend — the canvas starts on it. */
	backend?: CanvasBackend;
	/** The type the outline has picked — drawn selected. */
	selection: ModelSelection | null;
	/** A type clicked on the canvas; the page opens its type page. */
	onSelect: (selection: ModelSelection | null) => void;
}

export function ModelCanvas({
	username,
	graphSlug,
	modelId,
	backend,
	selection,
	onSelect,
}: Props) {
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
	// types, with no frame — the page is already the model. The version drawn is the draft while one is open.
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

	// The page selects by name; the canvas by id.
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

	// No frame to size, so a model with no types says so instead.
	if (tree && nodeTypes.length === 0)
		return (
			<EmptyState
				className="h-full"
				title="No types yet"
				description={
					draft
						? "Add a node type to start drawing this model."
						: "This version declares no types."
				}
			/>
		);

	return (
		<GraphModelCanvas
			data={build.data}
			message="Hover a type for its properties, an edge for what it connects"
			selected={canvasSelection}
			onSelect={onCanvasSelect}
			backend={backend}
			initialDetail="medium"
		/>
	);
}
