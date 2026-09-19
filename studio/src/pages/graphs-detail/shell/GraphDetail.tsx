import { AppVersion } from "@/components/AppVersion";
import { useAppHeader } from "@/components/header/useAppHeader";
import { useGraphConnectionQuery } from "@/hooks/queries/useGraphs";
import { SettingsPanel } from "@/pages/graphs-detail/features/graph-settings/SettingsPanel";
import { ConnectionStatusBar } from "@/pages/graphs-detail/shell/ConnectionStatusBar";
import { useGraphLeftNav } from "@/pages/graphs-detail/shell/useGraphLeftNav";
import {
	type SettingsSection,
	useSettingsPanel,
} from "@/pages/graphs-detail/shell/useSettingsPanel";
import { AppLayoutV2 } from "@invana/themes";
import type { ReactNode } from "react";
import { useParams } from "react-router-dom";

// The shell's own section shapes. Re-declared rather than imported because
// `@invana/themes` does not export them at the top level; they are the same
// four keys `AppLayoutV2` reads, so a page written against these is written
// against the shell.
interface SectionConfig {
	content: ReactNode;
	defaultSize?: number | string;
	minSize?: number | string;
	maxSize?: number | string;
	collapsible?: boolean;
}

interface MainSectionConfig {
	content: ReactNode;
	defaultSize?: number | string;
	minSize?: number | string;
}

interface GraphDetailProps {
	/** The object open on this screen — drawn as the last breadcrumb crumb,
	 *  after `owner › graph › panel`. Omitted when nothing is open. There is no
	 *  *screen* crumb: the graph's URL is the page (graph-detail-page.md G15),
	 *  so what follows the graph is the open panel, then what it opened. */
	objectLabel?: string;
	/** Page-side left panel. Shown only while a page-owned `?settings` key is
	 *  open; a settings section docks the SettingsPanel here instead, and
	 *  nothing open means no left column. */
	leftSection?: SectionConfig;
	/** Main content. Replaced by SettingsPanel when settings is expanded. */
	mainSection: MainSectionConfig;
	/** Right auxiliary panel (e.g. Inspector / DetailPanel). Hidden when
	 *  settings is expanded so the panel owns the full content width. */
	rightSection?: SectionConfig;
	/** Slot inside ConnectionStatusBar (left of footer) for page-specific
	 *  counters — "0 nodes · 0 relationships · 0 queries", etc. */
	statusMetrics?: ReactNode;
	/** Extras rendered before the AppVersion in the footer right cluster. */
	footerRightExtras?: ReactNode;
	/** Page-specific header right extras (e.g. Modeller's Introspect +
	 *  Refresh buttons). */
	headerRightExtras?: ReactNode;
	/** Panel collapse/expand toggles, rendered next to the profile menu. */
	headerPanelControls?: ReactNode;
	/** Page-specific header center content (e.g. Explorer's canvas toolbar).
	 *  Most pages won't need this. */
	headerCenter?: ReactNode;
}

// The page-owned panels keyed into the shared `?settings` param. These open via
// the page's own `leftSection` instead of rendering a SettingsPanel tab — so the
// whole rail stays one single-open accordion.
//
// There is one page (docs/for-developers/modules/explore/spec.md), so there is one list: Model
// plus the work surfaces (docs/for-developers/modules/work/spec.md). The Modeller's `schema` and
// `messages` keys are aliased onto `model` / `sessions` by `useSettingsPanel`
// and never reach here.
//
// `sessions` is deliberately absent: it is the assistant, on the right
// (the-assistant.md AD1). It stays in ALL_NATIVE_SECTIONS below so a
// stale `?panel=sessions` link is still recognised as page-owned — the page
// answers it by opening the assistant — rather than docking the SettingsPanel.
//
// `skills` is page-owned rather than a settings section. That is deliberate: a
// skill is *configured* like a connection but *read* like work — "is this prose
// doing anything?" is answered by the usage list, which only exists beside the
// agents and steps it is talking about.
//
// This used to be a record keyed by a `GraphDetailSection` ("overview" |
// "explorer" | "modeller") with one key filled in. There is one page, so it is
// one list.
const PAGE_OWNED_SECTIONS: SettingsSection[] = [
	"explorer",
	"model",
	// Templates is one of the page's own panels too. Left off this list it was
	// unreachable: the rail lit its icon, the URL carried its key, and the shell
	// handed the column to `SettingsPanel`, which draws nothing for a key it does
	// not know — a blank column that looked like "no data" rather than a dead
	// surface.
	"templates",
	"projects",
	// Tasks is the three-drawer stack — Runs · Plans · Catalogue (G33). `imports`
	// and `workflows` are gone from this list because they are gone from the
	// product: an import is a `kind` of TaskRun and a workflow is a reusable
	// TaskPlan, each reached inside this panel (G30).
	"tasks",
	"agents",
	"skills",
];
const ALL_NATIVE_SECTIONS: SettingsSection[] = [
	"explorer",
	"sessions",
	"schema",
	"model",
	"templates",
	"canvases",
	"messages",
	"projects",
	"tasks",
	"agents",
];

/**
 * The shell for the graph page — one page, at the graph's own URL
 * (graph-detail-page.md G1 · G15). Owns:
 *
 * - The breadcrumb header (`useAppHeader`) and left rail (`useGraphLeftNav`).
 * - SettingsPanel takeover: docked replaces `leftSection`; expanded replaces
 *   `mainSection` and hides both `leftSection` and `rightSection`.
 * - Footer with the shared `ConnectionStatusBar` (connection chip + page metrics)
 *   and a right cluster (extras + `AppVersion`).
 *
 * Pages provide their own data + content slots; layout/wiring lives here.
 */
export function GraphDetail({
	objectLabel,
	leftSection,
	mainSection,
	rightSection,
	statusMetrics,
	footerRightExtras,
	headerRightExtras,
	headerPanelControls,
	headerCenter,
}: GraphDetailProps) {
	const { username, graphSlug } = useParams<{
		username: string;
		graphSlug: string;
	}>();

	const { data: connection } = useGraphConnectionQuery(username, graphSlug);
	const settingsPanel = useSettingsPanel();
	const leftNav = useGraphLeftNav();

	// **No mode switch** (docs/for-developers/modules/explore/spec.md). The header is a breadcrumb naming the
	// graph and the open panel; the view crumb follows the rail, so it answers
	// "where am I?" without being a second way to navigate.
	// `owner › graph › panel › object`. The panel crumb is the `?panel` value
	// verbatim (G16), so the breadcrumb is a literal reading of the URL — the two
	// crumbs before it are identifiers too, the username and the slug.
	const header = useAppHeader({
		pageLabel: settingsPanel.isOpen ? settingsPanel.section : undefined,
		objectLabel,
		rightExtras: headerRightExtras,
		panelControls: headerPanelControls,
		center: headerCenter,
	});

	// The whole left rail shares one `?settings` param. This view's own panel
	// (AssistantPanel / SchemaNav) opens under its native key; every other value
	// is a bottom-rail settings section that renders the SettingsPanel. A value
	// belonging to the *other* view's native key shows nothing here.
	const nativeKeys = PAGE_OWNED_SECTIONS;
	const sectionIsNative = ALL_NATIVE_SECTIONS.includes(settingsPanel.section);
	const showNative =
		settingsPanel.isOpen && nativeKeys.includes(settingsPanel.section);
	const settingsOpen =
		settingsPanel.isOpen && !sectionIsNative && !!username && !!graphSlug;
	const settingsExpanded = settingsOpen && settingsPanel.expanded;
	const settingsDocked = settingsOpen && !settingsPanel.expanded;

	// Native panel open → render the page's own leftSection. Settings docked →
	// render SettingsPanel with panel-sized constraints (independent of the
	// page's own sizing). Settings expanded → drop leftSection so the panel can
	// own main width. **Nothing open → no left column**: every panel here,
	// the Explorer's own included, is a `?panel` key, so closing one leaves the
	// canvas with the rail beside it and nothing docked.
	const effectiveLeftSection: SectionConfig | undefined = showNative
		? leftSection
		: settingsExpanded
			? undefined
			: settingsDocked
				? {
						defaultSize: "420px",
						minSize: "320px",
						maxSize: "640px",
						collapsible: false,
						content: (
							<SettingsPanel
								username={username as string}
								graphSlug={graphSlug as string}
							/>
						),
					}
				: undefined;

	const effectiveMainSection: MainSectionConfig = settingsExpanded
		? {
				...mainSection,
				content: (
					<SettingsPanel
						username={username as string}
						graphSlug={graphSlug as string}
					/>
				),
			}
		: mainSection;

	const effectiveRightSection = settingsExpanded ? undefined : rightSection;

	// The shell owns the layout (DS12). It keeps `mainSection` mounted at a
	// stable position with each side region as a conditional sibling, so opening
	// a panel never remounts the canvas — a property of the shell since
	// `@invana/themes` 0.0.23, not something a page re-implements to protect
	// itself. `idPrefix` is stable rather than the default `useId()` value
	// because the Explorer nests a canvas app inside main, and the e2e specs
	// locate panels by id.
	return (
		<AppLayoutV2
			idPrefix="graph-detail"
			leftNav={leftNav}
			header={header}
			leftSection={effectiveLeftSection}
			mainSection={effectiveMainSection}
			rightSection={effectiveRightSection}
			footer={{
				className: "!h-[25px]",
				left: (
					<ConnectionStatusBar
						graph={connection ?? undefined}
						metrics={statusMetrics}
					/>
				),
				right: (
					<div className="flex items-center gap-3 px-2 text-base text-muted-foreground">
						{footerRightExtras}
						<AppVersion />
					</div>
				),
			}}
		/>
	);
}
