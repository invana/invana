/**
 * Settings' `mainSection`: the Plugins page as the first tab, and the plugins
 * opened from it as tabs beside it (`?page=plugin:<name>`).
 */
import { PlatformWorkbook } from "@invana-studio/shell";
import { useSearchParams } from "react-router-dom";
import { PluginPage } from "./PluginPage";
import { PluginsPage } from "./PluginsPage";
import { PLUGINS } from "./section";

export function SettingsPage() {
	const [, setParams] = useSearchParams();
	const openList = () =>
		setParams((prev) => {
			const next = new URLSearchParams(prev);
			next.delete("page");
			return next;
		});
	return (
		<PlatformWorkbook
			section={{
				id: "plugins",
				title: PLUGINS.label,
				icon: PLUGINS.icon,
				content: <PluginsPage />,
			}}
			records={{
				plugin: {
					icon: PLUGINS.icon,
					render: (name) => <PluginPage name={name} onOpenList={openList} />,
				},
			}}
		/>
	);
}
