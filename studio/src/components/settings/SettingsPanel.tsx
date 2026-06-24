import { Button, TabbedPanel } from "@invana/ui";
import {
	Activity,
	type Database,
	Info,
	Layers,
	Maximize2,
	Minimize2,
	Settings,
	Sparkles,
	Wand2,
	X,
} from "lucide-react";
import type { ReactNode } from "react";
import { ConnectionSection } from "./sections/ConnectionSection";
import { DatasetsSection } from "./sections/DatasetsSection";
import { EventsSection } from "./sections/EventsSection";
import { InfoSection } from "./sections/InfoSection";
import { LLMsSection } from "./sections/LLMsSection";
import { SettingsSection as GraphSettingsSection } from "./sections/SettingsSection";
import { SkillsSection } from "./sections/SkillsSection";
import { type SettingsSection, useSettingsPanel } from "./useSettingsPanel";

interface Props {
	username: string;
	graphSlug: string;
}

/**
 * Docked settings sidebar. Each rail-icon section renders as its own
 * `@invana/ui` `TabbedPanel` — most sections have a single tab (the section
 * itself) while Connection hosts a two-tab nested panel (Connection +
 * Capabilities). Switching between sections is driven by the rail icons via
 * `?settings=<section>` (see `useGraphLeftNav`).
 *
 * The TabbedPanel's built-in chrome handles the close button (wired to
 * `useSettingsPanel().close`); the maximize button lives in `headerActions`.
 */
export function SettingsPanel({ username, graphSlug }: Props) {
	const { section, expanded, toggleExpanded, close } = useSettingsPanel();

	const ToggleIcon = expanded ? Minimize2 : Maximize2;
	const headerActions = {
		right: (
			<div className="flex items-center gap-1 pr-2">
				<Button
					variant="ghost"
					size="icon"
					className="h-6 w-6"
					onClick={toggleExpanded}
					title={expanded ? "Collapse to side panel" : "Expand to full width"}
				>
					<ToggleIcon className="w-3.5 h-3.5" />
				</Button>
				<Button
					variant="ghost"
					size="icon"
					className="h-6 w-6"
					onClick={close}
					title="Close panel"
				>
					<X className="w-3.5 h-3.5" />
				</Button>
			</div>
		),
	};

	// Connection hosts its own two-tab TabbedPanel (Connection + Capabilities).
	if (section === "connection") {
		return (
			<ConnectionSection
				username={username}
				graphSlug={graphSlug}
				className="h-full"
				headerActions={headerActions}
			/>
		);
	}

	// All other sections render as a single-tab TabbedPanel so the chrome
	// (tab strip + close + maximize) matches Members visually.
	const meta = SINGLE_TAB_SECTIONS[section];
	const Icon = meta.icon;
	const inPad = (c: ReactNode) => <div className="p-5">{c}</div>;

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
// separately (above) because it renders a two-tab TabbedPanel.
type SingleTabSection = Exclude<SettingsSection, "connection">;
const SINGLE_TAB_SECTIONS: Record<
	SingleTabSection,
	{ label: string; icon: typeof Database }
> = {
	info: { label: "Info", icon: Info },
	settings: { label: "Settings", icon: Settings },
	llms: { label: "LLMs", icon: Sparkles },
	skills: { label: "Skills", icon: Wand2 },
	datasets: { label: "Datasets", icon: Layers },
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
			return <InfoSection username={username} graphSlug={graphSlug} />;
		case "llms":
			return <LLMsSection username={username} graphSlug={graphSlug} />;
		case "skills":
			return <SkillsSection username={username} graphSlug={graphSlug} />;
		case "settings":
			return <GraphSettingsSection username={username} graphSlug={graphSlug} />;
		case "datasets":
			return <DatasetsSection username={username} graphSlug={graphSlug} />;
		case "events":
			return <EventsSection username={username} graphSlug={graphSlug} />;
	}
}
