import {
	Activity,
	Boxes,
	Compass,
	Database,
	Info,
	Layers,
	ScrollText,
	Sparkles,
	Wand2,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { UserMenu } from "../header/UserMenu";
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
 * - Very bottom (`bottom` slot, below a separator): the user profile menu.
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
	const location = useLocation();
	const settingsPanel = useSettingsPanel();
	const root = `/u/${username}/${graphSlug}`;

	// `my-1.5` adds breathing room between rail items — the theme's own
	// section wrapper only gives them `gap-1`, which reads as crowded.
	const activeClass = (active: boolean) =>
		`my-1.5 ${active ? "bg-accent text-accent-foreground" : ""}`;

	// Navigating to a view clears ?settings so the leftSection shows the view's
	// own content (SessionsPanel / SchemaNav / wizard).
	//
	// Clicking the rail icon for the view you're ALREADY on re-opens its left
	// panel — but must not disturb the right (inspector) panel. So for a same-view
	// click, only drop `settings` + `sessions` and keep everything else (notably
	// `inspector=closed`); a different-view click navigates fresh.
	const goToView = (path: string) => {
		if (location.pathname === path) {
			const next = new URLSearchParams(location.search);
			next.delete("settings");
			next.delete("sessions");
			navigate({ pathname: path, search: next.toString() }, { replace: true });
		} else {
			navigate(path);
		}
	};

	const topNavItems = [
		{
			name: "Explorer",
			icon: Compass,
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

	// Each section icon is a toggle: clicking the open section closes the panel,
	// clicking any other opens/switches to it. Works the same on every
	// graph-scoped page (Explorer / Modeller) since both render this rail.
	const bottomNavItems = SETTINGS_SECTIONS.map((s, i) => {
		const active = settingsPanel.isOpen && settingsPanel.section === s.key;
		return {
			name: s.label,
			icon: s.icon,
			iconClassName: "w-5 h-5",
			tooltipSide: "right" as const,
			className: activeClass(active),
			// Separate the settings icons from the profile menu pinned below.
			showSeperator: i === SETTINGS_SECTIONS.length - 1,
			onClick: () =>
				active ? settingsPanel.close() : settingsPanel.setSection(s.key),
		};
	});

	// Profile menu sits at the very bottom of the rail, below the separator.
	return { topNavItems, bottomNavItems, bottom: <UserMenu /> };
}
