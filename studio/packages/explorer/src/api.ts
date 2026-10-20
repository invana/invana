import { request } from "@invana-studio/core";
import type { DataEdit, DataEditResult } from "./edit/dataEdits";
import type {
	BoundDataset,
	ExpandByEdgeTypeRequest,
	ExpandByNodeTypeRequest,
	ExpandNeighborsRequest,
	NeighborExpandResponse,
} from "./types";

// Explorer node-expand / graph-traversal APIs (docs/for-developers/modules/explore/features/graph-canvas.md). Three focused,
// individually-triggerable read-only endpoints under the graph prefix.
export const explorerApi = {
	expandNeighbors: (
		username: string,
		graphSlug: string,
		body: ExpandNeighborsRequest,
	) =>
		request<NeighborExpandResponse>(
			`/api/v1/u/${username}/${graphSlug}/explorer/expand/neighbors`,
			{ method: "POST", body: JSON.stringify(body) },
		),

	expandByEdgeType: (
		username: string,
		graphSlug: string,
		body: ExpandByEdgeTypeRequest,
	) =>
		request<NeighborExpandResponse>(
			`/api/v1/u/${username}/${graphSlug}/explorer/expand/by-edge-type`,
			{ method: "POST", body: JSON.stringify(body) },
		),

	expandByNodeType: (
		username: string,
		graphSlug: string,
		body: ExpandByNodeTypeRequest,
	) =>
		request<NeighborExpandResponse>(
			`/api/v1/u/${username}/${graphSlug}/explorer/expand/by-node-type`,
			{ method: "POST", body: JSON.stringify(body) },
		),

	/**
	 * Which of a reopened canvas's elements the graph still holds, under the
	 * picked world.
	 *
	 * One request for the whole drawing, on hydrate. What comes back missing is
	 * **kept and marked**; what the world excludes is in neither list and is not
	 * drawn.
	 */
	resolveElements: (
		username: string,
		graphSlug: string,
		vertexIds: string[],
		lensId?: string | null,
	) =>
		request<{ present: string[]; missing: string[]; checked: number }>(
			`/api/v1/u/${username}/${graphSlug}/explorer/resolve`,
			{
				method: "POST",
				body: JSON.stringify({
					vertex_ids: vertexIds,
					...(lensId ? { lens_id: lensId } : {}),
				}),
			},
		),

	/**
	 * The dataset versions the Graph has bound, as they stand now — what a
	 * snapshot names as the data it was taken over.
	 */
	datasetBindings: async (
		username: string,
		graphSlug: string,
	): Promise<BoundDataset[]> => {
		const d = await request<{
			items: {
				address: string;
				type_name: string;
				model_name: string | null;
			}[];
		}>(`/api/v1/u/${username}/${graphSlug}/dataset-bindings`);
		return d.items.map((b) => ({
			address: b.address,
			typeName: b.type_name,
			modelName: b.model_name,
		}));
	},

	/**
	 * Save a board's edits (4.7): checked against the model, written as one
	 * `data-edit` run; answers with the new elements' database ids.
	 */
	saveDataEdits: (
		username: string,
		graphSlug: string,
		edits: DataEdit[],
		modelVersionId?: string,
	) =>
		request<DataEditResult>(`/api/v1/u/${username}/${graphSlug}/data-edits`, {
			method: "POST",
			body: JSON.stringify({ edits, model_version_id: modelVersionId ?? null }),
		}),
};
