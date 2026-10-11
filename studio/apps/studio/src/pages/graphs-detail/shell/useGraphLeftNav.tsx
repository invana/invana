import {
	type LeftNavKey,
	leftNavItemClassName,
	useLeftSection,
} from "@invana-studio/shell";
import {
	Activity,
	Compass,
	type Database,
	FolderOpen,
	History,
	Info,
} from "lucide-react";

interface SectionMeta {
	key: LeftNavKey;
	label: string;
	icon: typeof Database;
}

// Membership is binary (docs/for-developers/modules/identity-and-access/features/membership.md) — every member sees every section; there is
// no admin-only gating and no Members/Invitations management section.
const SETTINGS_SECTIONS: SectionMeta[] = [
	// **Info is not here.** It is the first icon of the top group: it is the
	// graph itself — name, readiness, what has been happening — not a thing you
	// configure, and it is what a person wants on arriving (graph-detail-page.md).
	// Skills is not here: it is the Agents product's, on its own rail.
	// Events (docs/for-developers/modules/operate/features/audit-and-activity.md) — the graph's audit log.
	{ key: "events", label: "Events", icon: Activity },
	// Settings is not here: Graph settings is the Modeller's, at the bottom of
	// its own rail.
];

// The panels the page itself owns — the top group of the rail: the work
// surfaces (docs/for-developers/modules/work/spec.md).
//
// **Sessions is not here.** It is the assistant, on the right
// (docs/for-developers/modules/ask/features/the-assistant.md),
// reached from the header's Assistant control — the one trigger, in the one
// place, on every surface. A rail icon would be a second door onto a panel that
// does not live in this column.
//
// **Model and Govern are not here.** They are the Modeller's — Global model ·
// Models · Stitches and Worlds · Guardrails on its own rail, reached from the
// launcher. **Library and Agents are not here either**: they are the Agents
// product's, on its rail.
const VIEW_SECTIONS: SectionMeta[] = [
	// **The work group is two icons: Projects and Runs**. Projects owns
	// **Todos** — what a person wrote, under a project or the *No project*
	// bucket. Runs owns **execution**: the journal, and nothing else, as one
	// list.
	{ key: "projects", label: "Projects", icon: FolderOpen },
	{ key: "runs", label: "Runs", icon: History },
];

/**
 * The one left rail (icon column). Surfaces:
 *
 * - Top: Info, then the page's own panels — Explorer · Projects · Runs.
 *   **Imports and Workflows have no icons**,
 *   because an import is a `kind` of TaskRun and a workflow is a reusable
 *   TaskPlan, so each was an icon onto a *filter* of a list that already exists
 *   — and an icon per filter is how one journal became four panels. An import is
 *   reached in **Runs**, a workflow in **Agents › Library › Plans**.
 *   Every one is a `?panel` key, so the whole rail is a single-open accordion
 *   with one mechanism. Info
 *   is the exception that proves it: it still renders through `SettingsViewPanel`,
 *   because where a panel's *code* lives says nothing about where its icon
 *   belongs. Two things are not in this group: Sessions, which is the assistant
 *   on the right, opened from the header; and Layers, which is a control on the
 *   page strip and a card over the canvas (graph-detail-page.md).
 * - Bottom: one icon per settings section (Events). The
 *   user menu is in the shell's header, like on every other screen.
 *
 * **There is no mode switch** (docs/for-developers/modules/explore/spec.md). The Explorer / Modeller toggle was
 * the last top-level one in Studio, and it switched *pages* when everything
 * else switches *content* — so it is gone, and the header breadcrumb answers
 * "where am I?" without being a control.
 */
// The rail takes no arguments. It took a username, slug and active tab before
// the one page (docs/for-developers/modules/explore/spec.md) — all three existed
// only to navigate between the two pages there used to be — and a `showLayers`
// flag until Layers became a canvas control (graph-detail-page.md).
export function useGraphLeftNav() {
	const settingsPanel = useLeftSection();

	// The highlight follows the one `?panel` param, so exactly one rail icon is
	// ever lit (`leftNavItemClassName` overrides the theme's own per-group one).
	const activeClass = leftNavItemClassName;

	// One toggle for every icon — open the section, or close it if it's already
	// the open one (identical to the bottom-rail behaviour below).
	const toggleSection = (key: LeftNavKey) =>
		settingsPanel.isOpen && settingsPanel.section === key
			? settingsPanel.close()
			: settingsPanel.setSection(key);

	const navItem = (meta: SectionMeta) => {
		const active = settingsPanel.isOpen && settingsPanel.section === meta.key;
		return {
			name: meta.label,
			icon: meta.icon,
			iconClassName: "w-5 h-5",
			tooltipSide: "right" as const,
			className: activeClass(active),
			onClick: () => toggleSection(meta.key),
		};
	};

	// One rail, one page. Info leads, because it is the graph and every other
	// icon is something *in* the graph; Explorer follows, and each is a `?panel`
	// key like every other — the Explorer's panel is the graph's type list, the
	// legend for the canvas beside it (selection-and-the-panel.md), and the same
	// click that opens it closes it. With nothing open the left column is gone
	// and no rail icon is lit.
	const topNavItems = [
		navItem({ key: "info", label: "Info", icon: Info }),
		navItem({ key: "explorer", label: "Explorer", icon: Compass }),
		...VIEW_SECTIONS.map(navItem),
	];

	// Each section icon is a toggle: clicking the open section closes the panel,
	// clicking any other opens/switches to it — the same single `?settings` param
	// shared with the top view icons keeps the whole rail single-open.
	const bottomNavItems = SETTINGS_SECTIONS.map((s) => {
		const active = settingsPanel.isOpen && settingsPanel.section === s.key;
		return {
			name: s.label,
			icon: s.icon,
			iconClassName: "w-5 h-5",
			tooltipSide: "right" as const,
			className: activeClass(active),
			onClick: () => toggleSection(s.key),
		};
	});

	return { topNavItems, bottomNavItems };
}
