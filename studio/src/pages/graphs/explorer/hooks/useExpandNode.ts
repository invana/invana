import { useMutation } from "@tanstack/react-query";
import { explorerApi } from "../../../../services/api/explorer";
import type {
	ExpandRequest,
	NeighborExpandResponse,
} from "../../../../types/traversal";

/**
 * Imperative node-expand mutation (RFC-035). Each right-click "expand" is a POST
 * to the matching focused endpoint; the result is merged into the canvas by the
 * caller. Not a query — there's no cache key, it's fired on demand.
 */
export function useExpandNode(
	username: string | undefined,
	graphSlug: string | undefined,
) {
	return useMutation<NeighborExpandResponse, Error, ExpandRequest>({
		mutationFn: (req: ExpandRequest) => {
			if (!username || !graphSlug) {
				return Promise.reject(new Error("Graph context unavailable"));
			}
			switch (req.kind) {
				case "neighbors":
					return explorerApi.expandNeighbors(username, graphSlug, req.body);
				case "by-edge-type":
					return explorerApi.expandByEdgeType(username, graphSlug, req.body);
				case "by-node-type":
					return explorerApi.expandByNodeType(username, graphSlug, req.body);
			}
		},
	});
}
