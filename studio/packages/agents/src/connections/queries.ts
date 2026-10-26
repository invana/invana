/**
 * TanStack Query hooks for this Graph's MCP server. Every key starts
 * `["mcp-server", owner, graph]`, so flipping a switch re-reads the card's
 * counts, the served table and an agent's Deploy tab together.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mcpServerApi } from "./api";
import type { ServedKind } from "./types";

const root = (username: string, graphSlug: string) =>
	["mcp-server", username, graphSlug] as const;

export function useMcpServerInfoQuery(username: string, graphSlug: string) {
	return useQuery({
		queryKey: [...root(username, graphSlug), "info"],
		queryFn: () => mcpServerApi.info(username, graphSlug),
	});
}

/** Every candidate and its switch — a short list, read whole. */
export function useServedQuery(username: string, graphSlug: string) {
	return useQuery({
		queryKey: [...root(username, graphSlug), "served"],
		queryFn: () => mcpServerApi.served(username, graphSlug, { limit: 200 }),
	});
}

export function useMcpCallsQuery(username: string, graphSlug: string) {
	return useQuery({
		queryKey: [...root(username, graphSlug), "calls"],
		queryFn: () => mcpServerApi.calls(username, graphSlug),
	});
}

/** Turn one candidate's switch on or off; the server's reads re-read. */
export function useSetServedMutation(username: string, graphSlug: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (v: { kind: ServedKind; ref: string; served: boolean }) =>
			mcpServerApi.setServed(username, graphSlug, v.kind, v.ref, v.served),
		onSuccess: () =>
			qc.invalidateQueries({ queryKey: root(username, graphSlug) }),
	});
}
