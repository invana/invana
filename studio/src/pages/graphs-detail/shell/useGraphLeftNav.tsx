import { UserMenu } from "@/components/header/UserMenu";
import {
	type SettingsSection,
	useSettingsPanel,
} from "@/pages/graphs-detail/shell/useSettingsPanel";
import {
	Activity,
	Bot,
	Compass,
	type Database,
	FolderOpen,
	Info,
	ListChecks,
	ListTree,
	Settings,
	Table2,
	Wand2,
} from "lucide-react";

interface SectionMeta {
	key: SettingsSection;
	label: string;
	icon: typeof Database;
}

// Membership is binary (docs/for-developers/modules/identity-and-access/features/membership.md) — every member sees every section; there is
// no admin-only gating and no Members/Invitations management section.
const SETTINGS_SECTIONS: SectionMeta[] = [
	// **Info is not here.** It is the first icon of the top group: it is the
	// graph itself — name, readiness, what has been happening — not a thing you
	// configure, and it is what a person wants on arriving (graph-detail-page.md
	// G20). The database connection stays a *tab inside Settings* rather than an
	// icon of its own (connect-a-database.md CD6), and so do the LLM providers
	// (G29) — settings is four tabs: Basic, Graph, LLMs, Agents (G23). A provider
	// is the graph's configuration the same way the connection is, and the rail
	// is for things a person goes to.
	{ key: "skills", label: "Skills", icon: Wand2 },
	// Events (docs/for-developers/modules/operate/features/audit-and-activity.md) — the graph's audit log.
	{ key: "events", label: "Events", icon: Activity },
	// Settings sits at the bottom of the rail, just above the profile menu.
	{ key: "settings", label: "Settings", icon: Settings },
];

// The panels the page itself owns — the top group of the rail. Since the one page (docs/for-developers/modules/explore/spec.md)
// O2 there is no Explorer / Modeller mode switch: the Model panel is one of
// these, and a model draft opens as a canvas tab rather than as a different
// page. The work surfaces (docs/for-developers/modules/work/spec.md) add four more.
//
// **Sessions is not here.** It is the assistant, on the right
// (docs/for-developers/modules/ask/features/the-assistant.md AD1/AD6),
// reached from the header's Assistant control — the one trigger, in the one
// place, on every surface. A rail icon would be a second door onto a panel that
// does not live in this column.
const VIEW_SECTIONS: SectionMeta[] = [
	{ key: "model", label: "Model", icon: ListTree },
	// **No Links item.** Stitching is not a surface you browse — declaring a link
	// starts from a type you already have selected, so it lives in the Model
	// panel, and the union it implies is a page because it belongs to no single
	// model (stitch-models.md · Surfaces).
	// Projection templates decide what an answer looks like
	// (docs/for-developers/modules/ask/features/projections.md), so they sit with
	// the other things a person authors rather than under Settings.
	{ key: "templates", label: "Templates", icon: Table2 },
	// **The work group is two icons: Projects and Tasks** (G30). Projects owns
	// **Todos** — what a person wrote, under a project or the *No project*
	// bucket (PT7). Tasks owns **execution**, and it is three drawers: Runs ·
	// Plans · Catalogue — what ran, what can be run, and the closed vocabulary
	// those plans are written in (G33).
	{ key: "projects", label: "Projects", icon: FolderOpen },
	{ key: "tasks", label: "Tasks", icon: ListChecks },
	{ key: "agents", label: "Agents", icon: Bot },
];

/**
 * The one left rail (icon column). Surfaces:
 *
 * - Top: Info, then the page's own panels — Explorer · Model · Templates ·
 *   Projects · Tasks · Agents. **Seven, not nine** (G30): Imports and Workflows
 *   lost their icons, because an import is a `kind` of TaskRun and a workflow is
 *   a reusable TaskPlan, so each was an icon onto a *filter* of a list that
 *   already exists — and an icon per filter is how one journal became four
 *   panels. Both are reached inside **Tasks**, which is three drawers: Runs ·
 *   Plans · Catalogue (G33).
 *   Every one is a `?panel` key, so the whole rail is a single-open accordion
 *   with one mechanism. Info
 *   is the exception that proves it: it still renders through `SettingsPanel`,
 *   because where a panel's *code* lives says nothing about where its icon
 *   belongs. Two things are not in this group: Sessions, which is the assistant
 *   on the right, opened from the header; and Layers, which is a control on the
 *   page strip and a card over the canvas (graph-detail-page.md G18).
 * - Bottom: one icon per settings section (Skills / Events / Settings).
 * - Very bottom (`bottom` slot, below a separator): the user profile menu.
 *
 * **There is no mode switch** (docs/for-developers/modules/explore/spec.md). The Explorer / Modeller toggle was
 * the last top-level one in Studio, and it switched *pages* when everything
 * else switches *content* — so it is gone, and the header breadcrumb answers
 * "where am I?" without being a control.
 */
// The rail takes no arguments. It took a username, slug and active tab before
// the one page (docs/for-developers/modules/explore/spec.md) — all three existed
// only to navigate between the two pages there used to be — and a `showLayers`
// flag until Layers became a canvas control (graph-detail-page.md G18).
export function useGraphLeftNav() {
	const settingsPanel = useSettingsPanel();

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

	const railItem = (meta: SectionMeta) => {
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
		railItem({ key: "info", label: "Info", icon: Info }),
		railItem({ key: "explorer", label: "Explorer", icon: Compass }),
		...VIEW_SECTIONS.map(railItem),
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
