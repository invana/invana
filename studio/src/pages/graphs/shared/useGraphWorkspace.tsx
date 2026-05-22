import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { SettingsPanel } from "../../../components/settings/SettingsPanel";
import { useGraphLeftNav } from "../../../components/settings/useGraphLeftNav";
import { useSettingsPanel } from "../../../components/settings/useSettingsPanel";
import { useGraphConnectionQuery } from "../../../hooks/queries/useGraphs";

interface Options {
	sectionId: "explorer" | "modeller";
}

// Shell wiring shared by Explorer + Modeller: route params, graph-connection
// query, settings-panel state, left nav, and the left-section "settings panel
// takes over" idiom. Pages still call useAppHeader themselves — header right
// extras often depend on page-local state, and inlining `useAppHeader` keeps
// that ergonomic.
export function useGraphWorkspace({ sectionId }: Options) {
	const { username, graphSlug } = useParams<{
		username: string;
		graphSlug: string;
	}>();
	const { data: graph, isLoading: graphLoading } = useGraphConnectionQuery(
		username,
		graphSlug,
	);
	const connectionMissing = !graphLoading && !graph;
	const settingsPanel = useSettingsPanel();
	const leftNav = useGraphLeftNav(username ?? "", graphSlug ?? "", sectionId);

	const withSettingsTakeover = (leftContent: ReactNode): ReactNode => {
		// When expanded, settings goes to mainSection — keep the page's own
		// left content (QueryPanel / SchemaNav) in the leftSection.
		if (
			settingsPanel.isOpen &&
			!settingsPanel.expanded &&
			username &&
			graphSlug
		) {
			return <SettingsPanel username={username} graphSlug={graphSlug} />;
		}
		return leftContent;
	};

	const withSettingsAsMain = (mainContent: ReactNode): ReactNode => {
		if (
			settingsPanel.isOpen &&
			settingsPanel.expanded &&
			username &&
			graphSlug
		) {
			return <SettingsPanel username={username} graphSlug={graphSlug} />;
		}
		return mainContent;
	};

	return {
		username,
		graphSlug,
		graph,
		graphLoading,
		connectionMissing,
		settingsPanel,
		leftNav,
		withSettingsTakeover,
		withSettingsAsMain,
	};
}
