import { Button, ScrollArea, Separator } from "@invana/ui";
import {
	Database,
	Layers,
	Lightbulb,
	Mail,
	Maximize2,
	ScrollText,
	Sparkles,
	Users,
	Wand2,
	X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ConnectionSection } from "./sections/ConnectionSection";
import { DatasetsSection } from "./sections/DatasetsSection";
import { InstructionsSection } from "./sections/InstructionsSection";
import { IntentSection } from "./sections/IntentSection";
import { InvitationsSection } from "./sections/InvitationsSection";
import { LLMsSection } from "./sections/LLMsSection";
import { MembersSection } from "./sections/MembersSection";
import { SkillsSection } from "./sections/SkillsSection";
import { type SettingsSection, useSettingsPanel } from "./useSettingsPanel";

interface SectionChrome {
	label: string;
	icon: typeof Database;
	/** Sub-path under /u/:username/:graphSlug/settings/ for the maximize
	 *  (full-page) view of this section. */
	maximizeSubpath: string;
}

// Title, icon, and maximize destination for each section. The icon mirrors
// whatever's shown in the rail so the panel header reads as "you are here".
const CHROME: Record<SettingsSection, SectionChrome> = {
	info: { label: "Info", icon: Database, maximizeSubpath: "connection" },
	intent: { label: "Intent", icon: Lightbulb, maximizeSubpath: "intent" },
	llms: { label: "LLMs", icon: Sparkles, maximizeSubpath: "llms" },
	skills: { label: "Skills", icon: Wand2, maximizeSubpath: "skills" },
	instructions: {
		label: "Instructions",
		icon: ScrollText,
		maximizeSubpath: "instructions",
	},
	datasets: { label: "Datasets", icon: Layers, maximizeSubpath: "datasets" },
	members: { label: "Members", icon: Users, maximizeSubpath: "members" },
	invitations: {
		label: "Invitations",
		icon: Mail,
		maximizeSubpath: "invitations",
	},
};

interface Props {
	username: string;
	graphSlug: string;
}

/**
 * Renders the *content* of the currently selected settings section in the
 * leftSection of an AppLayoutV2. The sub-nav for picking sections lives in
 * the leftNav icon rail (see `useGraphLeftNav`) — this component only handles
 * "given a section key, render its content + a header with maximize/close".
 */
export function SettingsPanel({ username, graphSlug }: Props) {
	const navigate = useNavigate();
	const { section, close } = useSettingsPanel();
	const chrome = CHROME[section];
	const Icon = chrome.icon;

	return (
		<div className="flex flex-col h-full w-full bg-background border-r border-border">
			<div className="px-4 py-3 flex items-center justify-between gap-2 shrink-0">
				<div className="flex items-center gap-2 min-w-0">
					<Icon className="w-4 h-4 text-muted-foreground shrink-0" />
					<span className="font-medium truncate">{chrome.label}</span>
				</div>
				<div className="flex items-center gap-0.5 shrink-0">
					<Button
						variant="ghost"
						size="icon"
						className="h-6 w-6"
						onClick={() =>
							navigate(
								`/u/${username}/${graphSlug}/settings/${chrome.maximizeSubpath}`,
							)
						}
						title="Open as full page"
					>
						<Maximize2 className="w-3.5 h-3.5" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className="h-6 w-6"
						onClick={close}
						title="Close settings"
					>
						<X className="w-3.5 h-3.5" />
					</Button>
				</div>
			</div>
			<Separator />
			<ScrollArea className="flex-1">
				<div className="p-5">
					<SectionContent
						section={section}
						username={username}
						graphSlug={graphSlug}
					/>
				</div>
			</ScrollArea>
		</div>
	);
}

function SectionContent({
	section,
	username,
	graphSlug,
}: {
	section: SettingsSection;
	username: string;
	graphSlug: string;
}) {
	switch (section) {
		case "info":
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
		case "members":
			return <MembersSection username={username} graphSlug={graphSlug} />;
		case "invitations":
			return <InvitationsSection username={username} graphSlug={graphSlug} />;
	}
}
