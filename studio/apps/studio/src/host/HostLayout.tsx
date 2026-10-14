import {
	BOTTOM_SECTION,
	MAIN_SECTION,
	SIDE_SECTION,
	useGraphConnectionQuery,
} from "@invana-studio/core";
import { SettingsViewPanel } from "@invana-studio/modeller";
import {
	AppVersion,
	type LeftNavKey,
	StudioShellLayout,
	useActiveProduct,
	useLeftSection,
} from "@invana-studio/shell";
import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { ConnectionStatusBar } from "@/host/ConnectionStatusBar";

// A page hands the shell content, and a size only when its occupant needs one
// other than the shared side width (the docked assistant).
interface SectionSlot {
	content: ReactNode;
	size?: { defaultSize: string; minSize: string };
}

interface HostLayoutProps {
	/** The object open on this screen — drawn as the last breadcrumb crumb,
	 *  after `owner › graph › panel`. Omitted when nothing is open. There is no
	 *  *screen* crumb: the graph's URL is the page (graph-detail-page.md),
	 *  so what follows the graph is the open panel, then what it opened. */
	objectLabel?: string;
	/** The focused page's own levels — `Projects › a project › H2 › f1` —
	 *  in place of the route's crumbs. */
	pageTrail?: { label: string; to?: string; title?: string }[];
	/** Page-side left panel. Shown only while a page-owned `?settings` key is
	 *  open; a settings section docks the SettingsViewPanel here instead, and
	 *  nothing open means no left column. */
	leftSection?: SectionSlot;
	/** Main content. Replaced by SettingsViewPanel when settings is expanded. */
	mainSection: SectionSlot;
	/** Right panel — the docked assistant. Hidden when
	 *  settings is expanded so the panel owns the full content width. */
	rightSection?: SectionSlot;
	/** The console, under the canvas only (`bottomSpan: "main"`) — the left
	 *  and right sections stay full height beside it. Hidden with the rest
	 *  when settings is expanded. */
	bottomSection?: SectionSlot;
	/** Slot inside ConnectionStatusBar (left of footer) for page-specific
	 *  counters — "0 nodes · 0 relationships · 0 queries", etc. */
	statusMetrics?: ReactNode;
	/** Extras rendered before the AppVersion in the footer right cluster. */
	footerRightExtras?: ReactNode;
	/** Page-specific header right extras (e.g. Modeller's Introspect +
	 *  Refresh buttons). */
	headerRightExtras?: ReactNode;
	/** The Assistant toggle, the header's slot just before the user menu. */
	headerPanelControls?: ReactNode;
	/** Page-specific header center content (e.g. a data canvas's toolbar).
	 *  Most pages won't need this. */
	headerCenter?: ReactNode;
	/** Replaces the whole `footer` — the Explorer's connection and renderer
	 *  line, in place of the shared status bar. */
	footer?: { left: ReactNode; right: ReactNode };
}

// The panels the host draws in its own `leftSection`, keyed into the shared
// `panel` param. Every other key the path can name — Info and Graph settings —
// docks the SettingsViewPanel instead. Each is a product's panel: Explorer's
// type list, the Modeller's, the Agents product's and the Projects product's.
//
// `skills` is page-owned rather than a settings section. That is deliberate: a
// skill is *configured* like a connection but *read* like work — "is this prose
// doing anything?" is answered by the usage list, which only exists beside the
// agents and steps it is talking about.
const PAGE_OWNED_SECTIONS: LeftNavKey[] = [
	"explorer",
	"model",
	"projects",
	"library",
	"govern",
	"agents",
	"skills",
	// The Modeller's requests and rules.
	"requests",
	"rules",
	// The Agents product's own panels, and its pages — Overview, LLMs and
	// Performance draw no panel, so the column stays closed.
	"overview",
	"plugins",
	"llms",
	"performance",
	"concurrency",
	// The Projects product's own panel.
	"decisions",
];

/**
 * The host's layout — the regions every graph product fills, drawn through
 * `StudioShellLayout` so the header matches every other screen. Owns:
 *
 * - The shell's header slots: the breadcrumb's last crumb, the canvas toolbar
 *   in the centre and the Assistant toggle.
 * - `leftNav`: none for Explorer, whose `nav` is `null`; the open product's
 *   rail for the Modeller, Projects and Agents — the shell draws it from the
 *   product's `nav`.
 * - SettingsViewPanel takeover: docked replaces `leftSection`; expanded replaces
 *   `mainSection` and hides both `leftSection` and `rightSection`.
 * - Explorer: no `leftSection` — the board and the assistant fill it, the
 *   canvas tools float over the board, and the page hands its own `footer`.
 * - Footer with the shared `ConnectionStatusBar` (connection chip + page metrics)
 *   and a right cluster (extras + `AppVersion`).
 *
 * Pages provide their own data + content slots; layout/wiring lives here.
 */
export function HostLayout({
	objectLabel,
	pageTrail,
	leftSection,
	mainSection,
	rightSection,
	bottomSection,
	statusMetrics,
	footerRightExtras,
	headerRightExtras,
	headerPanelControls,
	headerCenter,
	footer,
}: HostLayoutProps) {
	const { username, graphSlug } = useParams<{
		username: string;
		graphSlug: string;
	}>();

	const { data: connection } = useGraphConnectionQuery(username, graphSlug);
	const settingsPanel = useLeftSection();
	const explorer = useActiveProduct()?.id === "explorer";

	// The header is a breadcrumb naming the graph and the open panel; the levels
	// after the graph come from the routes the panel's path matched (each
	// product's `routes`), so the breadcrumb is a reading of the URL:
	// `owner › graph › LLMs › <provider> › object`.
	const header = {
		objectLabel,
		pageTrail,
		rightExtras: headerRightExtras,
		assistantToggle: headerPanelControls,
		center: explorer ? undefined : headerCenter,
	};

	// The whole left column shares one `panel` param. A product's own panel
	// renders the host's `leftSection`; Info and Graph settings render the
	// SettingsViewPanel.
	const showNative =
		settingsPanel.isOpen && PAGE_OWNED_SECTIONS.includes(settingsPanel.section);
	const settingsOpen =
		settingsPanel.isOpen && !showNative && !!username && !!graphSlug;
	const settingsExpanded = settingsOpen && settingsPanel.expanded;
	const settingsDocked = settingsOpen && !settingsPanel.expanded;

	// Native panel open → the page's own leftSection. Settings docked → the
	// SettingsViewPanel. Settings expanded → it takes main and both sides close.
	// Nothing open → no left column.
	const leftContent = showNative ? (
		leftSection?.content
	) : settingsDocked ? (
		<SettingsViewPanel
			username={username as string}
			graphSlug={graphSlug as string}
		/>
	) : undefined;
	const effectiveLeftSection =
		leftContent && !explorer
			? { ...SIDE_SECTION, content: leftContent }
			: undefined;

	const effectiveMainSection = {
		...MAIN_SECTION,
		content: settingsExpanded ? (
			<SettingsViewPanel
				username={username as string}
				graphSlug={graphSlug as string}
			/>
		) : (
			mainSection.content
		),
	};

	const effectiveRightSection =
		rightSection && !settingsExpanded
			? { ...SIDE_SECTION, ...rightSection.size, content: rightSection.content }
			: undefined;

	const effectiveBottomSection =
		bottomSection && !settingsExpanded
			? { ...BOTTOM_SECTION, content: bottomSection.content }
			: undefined;

	// The shell owns the layout. It keeps `mainSection` mounted at a
	// stable position with each side region as a conditional sibling, so opening
	// a panel never remounts the canvas — a property of the shell since
	// `@invana/themes` 0.0.23, not something a page re-implements to protect
	// itself. `idPrefix` is stable rather than the default `useId()` value
	// because the Explorer nests a canvas app inside main, and the e2e specs
	// locate panels by id.
	return (
		<StudioShellLayout
			idPrefix="graph-detail"
			header={header}
			leftSection={effectiveLeftSection}
			mainSection={effectiveMainSection}
			rightSection={effectiveRightSection}
			bottomSection={effectiveBottomSection}
			bottomSpan="main"
			footer={
				footer
					? {
							className: "text-sm text-muted-foreground",
							left: footer.left,
							right: footer.right,
						}
					: {
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
						}
			}
		/>
	);
}
