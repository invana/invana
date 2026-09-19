import { GraphInfoPanel } from "@/pages/graphs-detail/features/graph-settings/GraphInfoPanel";
import { GraphSettingsSection } from "@/pages/graphs-detail/features/graph-settings/GraphSettingsSection";
import { EventsSection } from "@/pages/graphs-detail/features/operate/EventsSection";
import { SkillsSection } from "@/pages/graphs-detail/features/skills/SkillsSection";
import {
	type SettingsSection,
	useSettingsPanel,
} from "@/pages/graphs-detail/shell/useSettingsPanel";
import { TabbedPanel } from "@invana/ui";
import {
	Activity,
	type Database,
	Info,
	Maximize2,
	Minimize2,
	Wand2,
	X,
} from "lucide-react";
import type { ReactNode } from "react";

interface Props {
	username: string;
	graphSlug: string;
}

/**
 * Docked settings sidebar. Each rail-icon section renders as its own
 * `@invana/ui` `TabbedPanel` — most sections have a single tab (the section
 * itself), while Settings hosts four (Basic · Graph · LLMs · Agents, keyed by
 * `?tab=`). Switching between sections is driven by the rail icons via
 * `?panel=<section>` (see `useGraphLeftNav`).
 *
 * The TabbedPanel's built-in chrome handles the close button (wired to
 * `useSettingsPanel().close`); the maximize button lives in `headerActions`.
 */
export function SettingsPanel({ username, graphSlug }: Props) {
	const { section, expanded, toggleExpanded, close } = useSettingsPanel();

	const headerActions = [
		{
			key: "expand",
			name: expanded ? "Collapse to side panel" : "Expand to full width",
			icon: expanded ? Minimize2 : Maximize2,
			onClick: toggleExpanded,
		},
		{
			key: "close",
			name: "Close panel",
			icon: X,
			onClick: close,
		},
	];

	// Settings is four tabs rather than one, so it builds its own strip and takes
	// the chrome's actions as a prop. `llms` resolves here too: the providers are
	// one of those tabs now (G29), and the old panel key still has to land.
	if (section === "settings" || section === "llms") {
		return (
			<GraphSettingsSection
				username={username}
				graphSlug={graphSlug}
				headerActions={headerActions}
			/>
		);
	}

	// The top-rail view panels are rendered by the page (GraphDetail), never as
	// a SettingsPanel tab. Guard defensively so the exhaustive section lookup
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

// Sections whose panel is a single-tab TabbedPanel. Connection is handled
// separately (above) because it renders a two-tab TabbedPanel; everything
// else excluded here is a **page-owned** panel (the rail's top group), which
// GraphDetail renders as its own `leftSection` rather than as a tab.
type SingleTabSection = Exclude<
	SettingsSection,
	| "connection"
	| "llms"
	| "settings"
	| "explorer"
	| "sessions"
	| "schema"
	| "model"
	| "canvases"
	| "messages"
	| "projects"
	| "runs"
	| "library"
	| "agents"
>;
function isSingleTabSection(s: SettingsSection): s is SingleTabSection {
	return s in SINGLE_TAB_SECTIONS;
}

const SINGLE_TAB_SECTIONS: Record<
	SingleTabSection,
	{ label: string; icon: typeof Database }
> = {
	info: { label: "Info", icon: Info },
	skills: { label: "Skills", icon: Wand2 },
	events: { label: "Events", icon: Activity },
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
			return <GraphInfoPanel username={username} graphSlug={graphSlug} />;
		case "skills":
			return <SkillsSection username={username} graphSlug={graphSlug} />;
		case "events":
			return <EventsSection username={username} graphSlug={graphSlug} />;
	}
}
