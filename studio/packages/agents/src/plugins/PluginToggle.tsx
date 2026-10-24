/**
 * A plugin's state and its one act, as a table row draws them: the state
 * (`enabled` · `disabled` · `not installed` · `restart to load`), and Enable
 * or Disable for a plugin the engine marks `switchable`. A core plugin always
 * runs and says so. The act is an install Admin's; anyone else sees it drawn
 * disabled, naming who may take it.
 */

import { Button } from "@invana/ui";
import { useAuth } from "@invana-studio/core";
import { DetailStatus } from "@invana-studio/ui";
import { useSetPluginEnabledMutation } from "./queries";
import type { PluginSummary } from "./types";

/** Why a person without the role cannot take a registry act. */
export const NEEDS_INSTALL_ADMIN = "Needs an install Admin";

/** `enabled` · `disabled` · `not installed` · `restart to load`. */
export function pluginState(p: PluginSummary): string {
	if (p.restart_required) return "restart to load";
	if (!p.installed) return "not installed";
	return p.enabled ? "enabled" : "disabled";
}

export function PluginStateChip({ plugin }: { plugin: PluginSummary }) {
	const state = pluginState(plugin);
	return (
		<DetailStatus tone={state === "enabled" ? "success" : undefined}>
			{state}
		</DetailStatus>
	);
}

/** Enable · Disable, or *always on* for a plugin nobody switches. */
export function PluginToggle({ plugin }: { plugin: PluginSummary }) {
	const toggle = useSetPluginEnabledMutation(plugin.name);
	const { isSuperuser } = useAuth();
	if (!plugin.switchable)
		return <span className="text-muted-foreground">always on</span>;
	return (
		<Button
			size="sm"
			variant="ghost"
			disabled={!isSuperuser || toggle.isPending}
			title={isSuperuser ? toggle.error?.message : NEEDS_INSTALL_ADMIN}
			onClick={(e) => {
				e.stopPropagation();
				toggle.mutate(!plugin.enabled);
			}}
		>
			{plugin.enabled ? "Disable" : "Enable"}
		</Button>
	);
}
