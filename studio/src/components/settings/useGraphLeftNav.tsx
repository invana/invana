import {
	Activity,
	Boxes,
	Compass,
	Database,
	Info,
	Layers,
	ListTree,
	MessagesSquare,
	Settings,
	Sparkles,
	Wand2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { UserMenu } from "../header/UserMenu";
import { type SettingsSection, useSettingsPanel } from "./useSettingsPanel";

interface SectionMeta {
	key: SettingsSection;
	label: string;
	icon: typeof Database;
}

// Each view's own left panel keyed into the shared `?settings` param, so the top
// icons toggle through the exact same single-open mechanism as the bottom ones.
const NATIVE_SECTION: Record<"explorer" | "modeller", SettingsSection> = {
	explorer: "sessions",
	modeller: "schema",
};

// Membership is binary (RFC-023) — every member sees every section; there is
// no admin-only gating and no Members/Invitations management section.
const SETTINGS_SECTIONS: SectionMeta[] = [
	// "Info" is a read-only overview of the graph (status + stats). The DB
	// connection form lives under its own "Connection" icon below.
	{ key: "info", label: "Info", icon: Info },
	{ key: "connection", label: "Connection", icon: Database },
	{ key: "llms", label: "LLMs", icon: Sparkles },
	{ key: "skills", label: "Skills", icon: Wand2 },
	{ key: "datasets", label: "Datasets", icon: Layers },
	// Events (RFC-018) — the graph's audit log.
	{ key: "events", label: "Events", icon: Activity },
	// Settings sits at the bottom of the rail, just above the profile menu.
	{ key: "settings", label: "Settings", icon: Settings },
];

type ActiveTab = "overview" | "explorer" | "modeller" | null;

/**
 * Shared left-rail (icon column) config used by every graph-scoped page —
 * Overview, Explorer, Modeller. Surfaces:
 *
 * - Top: the graph views (Explorer / Modeller). On the view you're already on,
 *   the icon toggles that view's own panel (SessionsPanel / SchemaNav) through
 *   the SAME `?settings` param + toggle as the bottom icons — its key is just
 *   `sessions` / `schema`. Clicking the *other* view navigates to it.
 * - Bottom: one icon per settings section (Info / Connection / LLMs / Skills /
 *   Datasets / Events / Settings). Clicking a settings icon
 *   sets `?settings=<section>` on the current page so the leftSection swaps
 *   to that section's content.
 * - Very bottom (`bottom` slot, below a separator): the user profile menu.
 *
 * The whole rail is ONE single-open accordion: a single `?settings` value backs
 * every icon (top and bottom), so exactly one is ever open/active — clicking any
 * icon switches the one open panel, and clicking the open one closes it.
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
	//
	// The theme's NavVertical tracks its OWN "last clicked" highlight in internal
	// state, and renders the top and bottom groups as two *separate* NavItems —
	// so each keeps its own active item and two icons can look lit at once. We
	// drive the highlight from our single app state instead, forcing it with `!`
	// to override the theme's internal one so exactly one rail icon is ever lit.
	// Inactive items re-assert hover (also with `!`) so the override doesn't kill
	// hover feedback.
	const activeClass = (active: boolean) =>
		active
			? "my-1.5 !bg-primary/15 !text-primary !ring-primary/25"
			: "my-1.5 !bg-transparent !text-foreground !ring-transparent hover:!bg-primary/10 hover:!text-primary hover:!ring-primary/25";

	// One toggle for every icon — open the section, or close it if it's already
	// the open one (identical to the bottom-rail behaviour below).
	const toggleSection = (key: SettingsSection) =>
		settingsPanel.isOpen && settingsPanel.section === key
			? settingsPanel.close()
			: settingsPanel.setSection(key);

	// A view icon: on the view you're already on it toggles that view's own
	// panel (same param/toggle as the bottom icons); on the other view it just
	// navigates there.
	const viewItem = (
		tab: "explorer" | "modeller",
		name: string,
		icon: typeof Compass,
	) => {
		const key = NATIVE_SECTION[tab];
		const active =
			activeTab === tab &&
			settingsPanel.isOpen &&
			settingsPanel.section === key;
		return {
			name,
			icon,
			iconClassName: "w-5 h-5",
			tooltipSide: "right" as const,
			className: activeClass(active),
			onClick: () =>
				activeTab === tab ? toggleSection(key) : navigate(`${root}/${tab}`),
		};
	};

	// Explorer's second native panel: a read-only model browser (SchemaBrowser).
	// It toggles the shared `?settings=model` key just like the view icons, so the
	// rail stays single-open. Shown only on Explorer — the Modeller already owns
	// the schema as its own native panel, so it doesn't need a duplicate here.
	const modelItem = () => {
		const active = settingsPanel.isOpen && settingsPanel.section === "model";
		return {
			name: "Model",
			icon: ListTree,
			iconClassName: "w-5 h-5",
			tooltipSide: "right" as const,
			className: activeClass(active),
			onClick: () => toggleSection("model"),
		};
	};

	// Explorer's third native panel: the canvas Layers browser (a file-tree of
	// the live canvas layers). Toggles the shared `?settings=layers` key like the
	// other Explorer icons so the rail stays single-open. Explorer-only.
	const layersItem = () => {
		const active = settingsPanel.isOpen && settingsPanel.section === "layers";
		return {
			name: "Layers",
			icon: Layers,
			iconClassName: "w-5 h-5",
			tooltipSide: "right" as const,
			className: activeClass(active),
			onClick: () => toggleSection("layers"),
		};
	};

	// The Modeller's second native panel: a generative Sessions chat (RFC-031).
	// Toggles the shared `?settings=messages` key just like the schema view icon,
	// so the rail stays single-open. Shown only on the Modeller.
	const messagesItem = () => {
		const active = settingsPanel.isOpen && settingsPanel.section === "messages";
		return {
			name: "Messages",
			icon: MessagesSquare,
			iconClassName: "w-5 h-5",
			tooltipSide: "right" as const,
			className: activeClass(active),
			onClick: () => toggleSection("messages"),
		};
	};

	// On Explorer the rail shows the view's own panels — the Sessions chat
	// ("Messages") and the read-only Model browser — and omits the Modeller icon;
	// switching views is handled by the header GraphSectionSwitcher. On the
	// Modeller it likewise shows the view's own panels — the schema nav
	// ("Modeller") and the generative Sessions chat ("Messages"). Other pages keep
	// the two view icons for navigation. (RFC-045: the separate Canvases panel is
	// gone — a session's canvas is its 1:1 visual layer, painted on open.)
	const topNavItems =
		activeTab === "explorer"
			? [
					viewItem("explorer", "Messages", MessagesSquare),
					modelItem(),
					layersItem(),
				]
			: activeTab === "modeller"
				? [viewItem("modeller", "Modeller", Boxes), messagesItem()]
				: [
						viewItem("explorer", "Explorer", Compass),
						viewItem("modeller", "Modeller", Boxes),
					];

	// Each section icon is a toggle: clicking the open section closes the panel,
	// clicking any other opens/switches to it — the same single `?settings` param
	// shared with the top view icons keeps the whole rail single-open.
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
			onClick: () => toggleSection(s.key),
		};
	});

	// Profile menu sits at the very bottom of the rail, below the separator.
	return { topNavItems, bottomNavItems, bottom: <UserMenu /> };
}
