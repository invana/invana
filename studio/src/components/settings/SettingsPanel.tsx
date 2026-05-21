import { Button, TabbedPanel } from "@invana/ui";
import {
	Database,
	Info,
	Layers,
	Lightbulb,
	Maximize2,
	ScrollText,
	Sparkles,
	Wand2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ConnectionSection } from "./sections/ConnectionSection";
import { DatasetsSection } from "./sections/DatasetsSection";
import { InfoSection } from "./sections/InfoSection";
import { InstructionsSection } from "./sections/InstructionsSection";
import { IntentSection } from "./sections/IntentSection";
import { LLMsSection } from "./sections/LLMsSection";
import { MembersInvitationsSection } from "./sections/MembersInvitationsSection";
import { SkillsSection } from "./sections/SkillsSection";
import { type SettingsSection, useSettingsPanel } from "./useSettingsPanel";

interface Props {
	username: string;
	graphSlug: string;
}

/**
 * Docked settings sidebar. Each rail-icon section renders as its own
 * `@invana/ui` `TabbedPanel` — most sections have a single tab (the section
 * itself) while Members hosts a two-tab nested panel (Members + Invitations)
 * via `MembersInvitationsSection`. Switching between sections is driven by
 * the rail icons via `?settings=<section>` (see `useGraphLeftNav`).
 *
 * The TabbedPanel's built-in chrome handles the close button (wired to
 * `useSettingsPanel().close`); the maximize button lives in `headerActions`.
 */
export function SettingsPanel({ username, graphSlug }: Props) {
	const navigate = useNavigate();
	const { section, close } = useSettingsPanel();

	const subpath = MAXIMIZE_SUBPATHS[section];
	const headerActions = {
		right: (
			<Button
				variant="ghost"
				size="icon"
				className="h-6 w-6"
				onClick={() =>
					navigate(`/u/${username}/${graphSlug}/settings/${subpath}`)
				}
				title="Open as full page"
			>
				<Maximize2 className="w-3.5 h-3.5" />
			</Button>
		),
	};

	// Members hosts its own two-tab TabbedPanel (Members + Invitations).
	if (section === "members") {
		return (
			<MembersInvitationsSection
				username={username}
				graphSlug={graphSlug}
				className="h-full"
				showClose
				onClose={close}
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
			showClose
			onClose={close}
			headerActions={headerActions}
		/>
	);
}

// ── Section metadata ─────────────────────────────────────────────────────────

const MAXIMIZE_SUBPATHS: Record<SettingsSection, string> = {
	info: "info",
	connection: "connection",
	intent: "intent",
	llms: "llms",
	skills: "skills",
	instructions: "instructions",
	datasets: "datasets",
	members: "members",
};

// Sections whose panel is a single-tab TabbedPanel. Members is handled
// separately (above) because it has two tabs.
type SingleTabSection = Exclude<SettingsSection, "members">;
const SINGLE_TAB_SECTIONS: Record<
	SingleTabSection,
	{ label: string; icon: typeof Database }
> = {
	info: { label: "Info", icon: Info },
	connection: { label: "Connection", icon: Database },
	intent: { label: "Intent", icon: Lightbulb },
	llms: { label: "LLMs", icon: Sparkles },
	skills: { label: "Skills", icon: Wand2 },
	instructions: { label: "Instructions", icon: ScrollText },
	datasets: { label: "Datasets", icon: Layers },
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
		case "connection":
			return <ConnectionSection username={username} graphSlug={graphSlug} />;
		case "intent":
			return <IntentSection username={username} graphSlug={graphSlug} />;
		case "llms":
			return <LLMsSection username={username} graphSlug={graphSlug} />;
		case "skills":
			return <SkillsSection username={username} graphSlug={graphSlug} />;
		case "instructions":
			return <InstructionsSection username={username} graphSlug={graphSlug} />;
		case "datasets":
			return <DatasetsSection />;
	}
}
