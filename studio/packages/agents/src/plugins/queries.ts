/**
 * TanStack Query hooks for the plugin registry and a function's page. The
 * registry's keys are `["plugins", …]` with no Graph in them, because the
 * registry is the install's; a function's are `["functions", owner, graph, …]`,
 * because who names it and how its calls went are the Graph's.
 */

import { type ListQuery, listQueryKey } from "@invana-studio/core";
import {
	keepPreviousData,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { functionsApi, pluginsApi } from "./api";

/** One page of the registry for `query`. */
export function usePluginsQuery(query: ListQuery = {}) {
	return useQuery({
		queryKey: ["plugins", "list", listQueryKey(query)],
		queryFn: () => pluginsApi.list(query),
		placeholderData: keepPreviousData,
	});
}

export function usePluginQuery(name: string) {
	return useQuery({
		queryKey: ["plugins", name],
		queryFn: () => pluginsApi.get(name),
	});
}

const functionKey = (username: string, graphSlug: string, key: string) =>
	["functions", username, graphSlug, key] as const;

/** One function's page in a Graph: contract, plans and skills naming it, calls over 30 days. */
export function useFunctionQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	key: string,
) {
	return useQuery({
		queryKey: functionKey(username ?? "", graphSlug ?? "", key),
		queryFn: () => functionsApi.get(username ?? "", graphSlug ?? "", key),
		enabled: !!username && !!graphSlug && !!key,
	});
}

/** One page of the run steps that called a function, newest first. */
export function useFunctionCallsQuery(
	username: string,
	graphSlug: string,
	key: string,
	query: ListQuery = {},
) {
	return useQuery({
		queryKey: [
			...functionKey(username, graphSlug, key),
			"calls",
			listQueryKey(query),
		],
		queryFn: () => functionsApi.calls(username, graphSlug, key, query),
		placeholderData: keepPreviousData,
	});
}

/** Add an MCP server; the registry re-reads. */
export function useAddMcpServerMutation() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: { name: string; url: string }) =>
			pluginsApi.addMcp(body),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["plugins"] }),
	});
}

/** Refresh an MCP server's frozen tools; the registry re-reads. */
export function useRefreshMcpServerMutation() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (server: string) => pluginsApi.refreshMcp(server),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["plugins"] }),
	});
}

/** Enable or disable a switchable plugin; the registry and its page re-read. */
export function useSetPluginEnabledMutation(name: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (enabled: boolean) => pluginsApi.setEnabled(name, enabled),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["plugins"] }),
	});
}
