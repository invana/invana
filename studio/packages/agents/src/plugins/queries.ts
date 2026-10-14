/**
 * TanStack Query hooks for the plugin registry. Keys are `["plugins", …]`
 * with no Graph in them, because the registry is the install's.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pluginsApi } from "./api";

export function usePluginsQuery() {
	return useQuery({ queryKey: ["plugins"], queryFn: pluginsApi.list });
}

export function usePluginQuery(name: string) {
	return useQuery({
		queryKey: ["plugins", name],
		queryFn: () => pluginsApi.get(name),
	});
}

export function useTaskTypeQuery(ref: string) {
	return useQuery({
		queryKey: ["plugins", "task-type", ref],
		queryFn: () => pluginsApi.taskType(ref),
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
