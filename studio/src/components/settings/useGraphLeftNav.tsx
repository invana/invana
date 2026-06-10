import {
	Activity,
	Boxes,
	Database,
	Home,
	Info,
	Layers,
	Lightbulb,
	Network,
	ScrollText,
	Sparkles,
	Wand2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { type SettingsSection, useSettingsPanel } from "./useSettingsPanel";

interface SectionMeta {
	key: SettingsSection;
	label: string;
	icon: typeof Database;
}

// Membership is binary (RFC-023) — every member sees every section; there is
// no admin-only gating and no Members/Invitations management section.
const SETTINGS_SECTIONS: SectionMeta[] = [
	// "Info" is a read-only overview of the graph (status + stats). The DB
	// connection form lives under its own "Connection" icon below.
	{ key: "info", label: "Info", icon: Info },
	{ key: "connection", label: "Connection", icon: Database },
	{ key: "intent", label: "Intent", icon: Lightbulb },
	{ key: "llms", label: "LLMs", icon: Sparkles },
	{ key: "skills", label: "Skills", icon: Wand2 },
	{ key: "instructions", label: "Instructions", icon: ScrollText },
	{ key: "datasets", label: "Datasets", icon: Layers },
	// Events (RFC-018) — the graph's audit log.
	{ key: "events", label: "Events", icon: Activity },
];

type ActiveTab = "overview" | "explorer" | "modeller" | null;

/**
 * Shared left-rail (icon column) config used by every graph-scoped page —
 * Overview, Explorer, Modeller. Surfaces:
 *
 * - Top: the three graph views (Overview / Explorer / Modeller).
 * - Bottom: one icon per settings section (Info / Connection / Intent / LLMs
 *   / Skills / Instructions / Datasets / Events). Clicking a settings icon
 *   sets `?settings=<section>` on the current page so the leftSection swaps
 *   to that section's content.
 *
 * The "active" highlight is driven by the caller's `activeTab` arg (which
 * graph view is rendering this layout) and by `?settings` (which section is
 * currently open).
 */
export function useGraphLeftNav(
	username: string,
	graphSlug: string,
	activeTab: ActiveTab,
) {
	const navigate = useNavigate();
	const settingsPanel = useSettingsPanel();
	const root = `/u/${username}/${graphSlug}`;

	// `my-1.5` adds breathing room between rail items — the theme's own
	// section wrapper only gives them `gap-1`, which reads as crowded.
	const activeClass = (active: boolean) =>
		`my-1.5 ${active ? "bg-accent text-accent-foreground" : ""}`;

	// Navigating to a view should also clear ?settings so the leftSection
	// shows the view's own content (QueryPanel / SchemaNav / wizard).
	const goToView = (path: string) => {
		navigate(path);
	};

	const topNavItems = [
		{
			name: "Overview",
			icon: Home,
			iconClassName: "w-5 h-5",
			tooltipSide: "right" as const,
			className: activeClass(activeTab === "overview"),
			onClick: () => goToView(root),
		},
		{
			name: "Explorer",
			icon: Network,
			iconClassName: "w-5 h-5",
			tooltipSide: "right" as const,
			className: activeClass(activeTab === "explorer"),
			onClick: () => goToView(`${root}/explorer`),
		},
		{
			name: "Modeller",
			icon: Boxes,
			iconClassName: "w-5 h-5",
			tooltipSide: "right" as const,
			className: activeClass(activeTab === "modeller"),
			onClick: () => goToView(`${root}/modeller`),
		},
	];

	const bottomNavItems = SETTINGS_SECTIONS.map((s) => ({
		name: s.label,
		icon: s.icon,
		iconClassName: "w-5 h-5",
		tooltipSide: "right" as const,
		className: activeClass(
			settingsPanel.isOpen && settingsPanel.section === s.key,
		),
		onClick: () => settingsPanel.setSection(s.key),
	}));

	return { topNavItems, bottomNavItems };
}
