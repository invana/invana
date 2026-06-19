import type {
	ExpandByEdgeTypeRequest,
	ExpandByNodeTypeRequest,
	ExpandNeighborsRequest,
	NeighborExpandResponse,
} from "../../types/traversal";
import { request } from "./client";

// Explorer node-expand / graph-traversal APIs (RFC-035). Three focused,
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
};
