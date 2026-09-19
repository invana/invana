import { request } from "@/services/api/client";
import type {
	ExpandByEdgeTypeRequest,
	ExpandByNodeTypeRequest,
	ExpandNeighborsRequest,
	NeighborExpandResponse,
	TypeCountsResponse,
} from "@/types/traversal";

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
	 * Node and edge types with graph-wide counts — the Explorer panel's legend
	 * (selection-and-the-panel.md SP6/SP8).
	 *
	 * Graph-wide, not canvas-wide: the panel answers "what does this graph hold",
	 * the status bar answers "what am I looking at". `counted: false` means the
	 * vendor cannot count and every `count` is null.
	 */
	typeCounts: (username: string, graphSlug: string) =>
		request<TypeCountsResponse>(
			`/api/v1/u/${username}/${graphSlug}/explorer/type-counts`,
		),

	/**
	 * Which of a reopened canvas's elements the graph still holds (GC5).
	 *
	 * One request for the whole drawing, on hydrate. What comes back missing is
	 * **kept and marked**, never dropped: a canvas that quietly loses a node is a
	 * canvas that lies about what was explored.
	 */
	resolveElements: (username: string, graphSlug: string, vertexIds: string[]) =>
		request<{ present: string[]; missing: string[]; checked: number }>(
			`/api/v1/u/${username}/${graphSlug}/explorer/resolve`,
			{ method: "POST", body: JSON.stringify({ vertex_ids: vertexIds }) },
		),
};
