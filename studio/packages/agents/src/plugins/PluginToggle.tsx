/**
 * A plugin's state and its one act, as a table row or a page head draws
 * them: the state (`enabled` · `disabled` · `not installed` · `restart to
 * load`), and Enable or Disable for a plugin the engine marks `switchable`.
 * A core plugin always runs and says so. The act is an install Admin's;
 * anyone else sees it drawn disabled, naming the role it needs.
 */

import {
	Button,
	type ButtonProps,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@invana/ui";
import { useAuth } from "@invana-studio/core";
import { DetailStatus } from "@invana-studio/ui";
import { useSetPluginEnabledMutation } from "./queries";
import type { PluginBase } from "./types";

/** Why a person without the role cannot take a registry act. */
export const NEEDS_INSTALL_ADMIN = "Needs the install Admin role";

/** `enabled` · `disabled` · `not installed` · `restart to load`. */
function pluginState(p: PluginBase): string {
	if (p.restart_required) return "restart to load";
	if (!p.installed) return "not installed";
	return p.enabled ? "enabled" : "disabled";
}

export function PluginStateChip({ plugin }: { plugin: PluginBase }) {
	const state = pluginState(plugin);
	return (
		<DetailStatus tone={state === "enabled" ? "success" : undefined}>
			{state}
		</DetailStatus>
	);
}

/**
 * Enable · Disable, or *always on* for a plugin nobody switches. Without the
 * role, or before the plugin is installed, the act is drawn disabled and its
 * tooltip says why. A page passes `toggle` to show the refusal itself.
 */
export function PluginToggle({
	plugin,
	variant = "ghost",
	toggle: given,
}: {
	plugin: PluginBase;
	variant?: ButtonProps["variant"];
	toggle?: ReturnType<typeof useSetPluginEnabledMutation>;
}) {
	const own = useSetPluginEnabledMutation(plugin.name);
	const toggle = given ?? own;
	const { isSuperuser } = useAuth();
	if (!plugin.switchable)
		return <span className="text-muted-foreground">always on</span>;

	const reason = !isSuperuser
		? NEEDS_INSTALL_ADMIN
		: !plugin.installed
			? `Not installed — the ${plugin.extra} extra brings it`
			: null;
	const label = plugin.enabled ? "Disable" : "Enable";

	if (!reason)
		return (
			<Button
				size="sm"
				variant={variant}
				disabled={toggle.isPending}
				title={toggle.error?.message}
				onClick={(e) => {
					e.stopPropagation();
					toggle.mutate(!plugin.enabled);
				}}
			>
				{label}
			</Button>
		);

	return (
		<TooltipProvider>
			<Tooltip delayDuration={0}>
				<TooltipTrigger asChild>
					{/* biome-ignore lint/a11y/noNoninteractiveTabindex: a disabled button cannot take focus, so its wrapper carries the reason to keyboard users */}
					<span tabIndex={0} className="inline-flex">
						<Button
							size="sm"
							variant={variant}
							disabled
							aria-description={reason}
						>
							{label}
						</Button>
					</span>
				</TooltipTrigger>
				<TooltipContent>{reason}</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
