import { TabbedPanel } from "@invana/ui";
import { type LeftNavKey, useLeftSection } from "@invana-studio/shell";
import { type Database, Info, Maximize2, Minimize2, X } from "lucide-react";
import type { ReactNode } from "react";
import { GraphTab } from "./GraphTab";
import { InfoTab } from "./InfoTab";

interface Props {
	username: string;
	graphSlug: string;
}

/**
 * Docked settings sidebar for the Modeller's Graph settings path. Info renders
 * as a single-tab `@invana/ui` `TabbedPanel`, while Settings hosts its own tabs
 * (keyed by `?tab=`). The path names the section (`useLeftSection`).
 *
 * The maximize button lives in `headerActions`, and so does the close button
 * (`useLeftSection().close`) — except on Graph settings and Info, whose
 * Modeller path is the panel.
 */
export function SettingsViewPanel({ username, graphSlug }: Props) {
	const { section, expanded, toggleExpanded, close } = useLeftSection();

	// Graph settings and Info sit on a Modeller rail path, which names the
	// panel: closing it would leave the product, so they carry no ✕.
	const onModellerPath = section === "settings" || section === "info";
	const headerActions = [
		{
			key: "expand",
			name: expanded ? "Collapse to side panel" : "Expand to full width",
			icon: expanded ? Minimize2 : Maximize2,
			onClick: toggleExpanded,
		},
		...(onModellerPath
			? []
			: [{ key: "close", name: "Close panel", icon: X, onClick: close }]),
	];

	// Settings is three tabs rather than one, so it builds its own strip and
	// takes the chrome's actions as a prop. The providers are not among them —
	// `Agents › LLMs` holds them, and `?panel=llms` is aliased there.
	if (section === "settings") {
		return (
			<GraphTab
				username={username}
				graphSlug={graphSlug}
				headerActions={headerActions}
			/>
		);
	}

	// A product's own panels are rendered by the product host, never as a
	// SettingsViewPanel tab. Guard defensively so the exhaustive section lookup
	// below stays sound even if the rail hands us one.
	if (!isSingleTabSection(section)) return null;

	// All other sections render as a single-tab TabbedPanel so the chrome
	// (tab strip + close + maximize) matches Members visually.
	const meta = SINGLE_TAB_SECTIONS[section];
	const Icon = meta.icon;
	// `p-4` — the one panel-body padding, shared with LLMs, Settings and the
	// Model panel, so the content does not shift when the rail icon changes.
	const inPad = (c: ReactNode) => <div className="p-4">{c}</div>;

	return (
		<TabbedPanel
			className="h-full"
			tabs={[
				{
					value: section,
					label: meta.label,
					icon: Icon,
					content: inPad(
						<SectionContent
							section={section}
							username={username}
							graphSlug={graphSlug}
						/>,
					),
				},
			]}
			// Controlled — without this, TabbedPanel's internal currentTab
			// state holds the value from when it first mounted and never reacts
			// to a section change (so clicking another rail icon doesn't swap
			// the content until refresh).
			activeTab={section}
			onTabChange={() => {
				/* single-tab panel — no internal switching */
			}}
			headerActions={headerActions}
		/>
	);
}

// ── Section metadata ─────────────────────────────────────────────────────────

// Sections whose panel is a single-tab TabbedPanel. Settings is handled
// separately (above) because it renders its own tabs; everything else excluded
// here is a product's own panel, which the product host renders as its own
// `leftSection`, or a key whose path lands elsewhere (Activity, Explorer).
type SingleTabSection = Exclude<
	LeftNavKey,
	| "settings"
	| "explorer"
	| "sessions"
	| "events"
	| "model"
	| "projects"
	| "runs"
	| "library"
	| "govern"
	| "agents"
	| "skills"
	| "requests"
	| "rules"
	| "overview"
	| "plugins"
	| "performance"
	| "concurrency"
	| "decisions"
	// Activity's tabs are the shell's page; they are never a tab here.
	| "activity"
>;
function isSingleTabSection(s: LeftNavKey): s is SingleTabSection {
	return s in SINGLE_TAB_SECTIONS;
}

const SINGLE_TAB_SECTIONS: Record<
	SingleTabSection,
	{ label: string; icon: typeof Database }
> = {
	info: { label: "Info", icon: Info },
};

function SectionContent({
	section,
	username,
	graphSlug,
}: {
	section: SingleTabSection;
	username: string;
	graphSlug: string;
}) {
	switch (section) {
		case "info":
			return <InfoTab username={username} graphSlug={graphSlug} />;
	}
}
