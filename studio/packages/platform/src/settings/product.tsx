/**
 * `settings` — the Settings product's `ProductDefinition`: the install's
 * configuration, off any Graph (platform.md).
 *
 * | Rail | Path | Draws |
 * |---|---|---|
 * | Plugins | `/settings/plugins` | every plugin; `?page=plugin:<name>` is one |
 *
 * The rail draws only what is built; Graph limits, LLM providers, MCP servers
 * and Remote agents join it as they move here. The product root lands on
 * Plugins.
 */
import type { ProductDefinition } from "@invana-studio/core";
import { ErrorPage, type ShellRouteHandle } from "@invana-studio/shell";
import { Settings } from "lucide-react";
import { Navigate } from "react-router-dom";
import { SettingsPage } from "./SettingsPage";
import { PLUGINS } from "./section";

export const settings: ProductDefinition = {
	id: "settings",
	name: "Settings",
	tagline: "LLMs, plugins, each Graph’s limits",
	icon: Settings,
	scope: "platform",
	landing: "plugins",
	nav: {
		groups: [
			[
				{
					id: "plugins",
					label: PLUGINS.label,
					icon: PLUGINS.icon,
					to: "plugins",
				},
			],
		],
		bottom: [],
	},
	commands: [
		{
			id: "plugins",
			label: "Plugins",
			keywords: ["registry", "tools", "enable"],
			to: "plugins",
		},
	],
	routes: [
		{
			path: "settings",
			errorElement: <ErrorPage />,
			children: [
				{ index: true, element: <Navigate to="plugins" replace /> },
				{
					path: "plugins",
					handle: { crumb: PLUGINS.label } satisfies ShellRouteHandle,
					element: <SettingsPage />,
				},
			],
		},
	],
};
