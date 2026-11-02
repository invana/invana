/**
 * The plugin registry's reads and acts. Keys are `["plugins", …]` with no
 * Graph in them, because the registry is the install's; every act re-reads
 * the list and the page it changed.
 */
import {
	keepPreviousData,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { listQueryKey } from "../../lib/listQuery";
import { pluginsApi } from "../../services/api/plugins";
import type { ListQuery } from "../../types/list";

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
