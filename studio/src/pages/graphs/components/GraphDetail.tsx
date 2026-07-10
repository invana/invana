import { AppLayoutV1 } from "@invana/themes";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@invana/ui";
import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { GraphSectionSwitcher } from "../../../components/header/GraphSectionSwitcher";
import { useAppHeader } from "../../../components/header/useAppHeader";
import { SettingsPanel } from "../../../components/settings/SettingsPanel";
import { useGraphLeftNav } from "../../../components/settings/useGraphLeftNav";
import {
	type SettingsSection,
	useSettingsPanel,
} from "../../../components/settings/useSettingsPanel";
import { useGraphConnectionQuery } from "../../../hooks/queries/useGraphs";
import { AppVersion } from "./AppVersion";
import { GraphStatusBar } from "./GraphStatusBar";

// Mirror the AppLayoutV2 SectionConfig shape without importing it (the
// theme package doesn't re-export the type at the top level).
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

export type GraphDetailSection = "overview" | "explorer" | "modeller";

interface GraphDetailProps {
	/** Drives the left-rail "active page" highlight. */
	sectionId: GraphDetailSection;
	/** Last breadcrumb segment + footer right-side label. */
	pageLabel: string;
	/** Page-side left panel (e.g. SessionsPanel in Explorer, SchemaNav in
	 *  Modeller). Shown only while this view's native `?settings` key is open
	 *  (`sessions` / `schema`); a settings section docks the SettingsPanel here
	 *  instead, and nothing open means no left column. Overview omits this. */
	leftSection?: SectionConfig;
	/** Main content. Replaced by SettingsPanel when settings is expanded. */
	mainSection: MainSectionConfig;
	/** Right auxiliary panel (e.g. Inspector / DetailPanel). Hidden when
	 *  settings is expanded so the panel owns the full content width. */
	rightSection?: SectionConfig;
	/** Slot inside GraphStatusBar (left of footer) for page-specific
	 *  counters — "0 nodes · 0 relationships · 0 queries", etc. */
	statusMetrics?: ReactNode;
	/** Extras rendered before the AppVersion + pageLabel in the footer
	 *  right cluster (e.g. Modeller's "schema v1"). */
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
// whole rail stays one single-open accordion. A view may own more than one:
// Explorer has both the SessionsPanel (`sessions`) and the read-only model
// browser (`model`); the Modeller has its SchemaNav (`schema`) and its
// generative SessionsPanel (`messages`, RFC-031).
const NATIVE_SECTIONS: Partial<Record<GraphDetailSection, SettingsSection[]>> =
	{
		explorer: ["sessions", "model", "layers"],
		modeller: ["schema", "messages"],
	};
const ALL_NATIVE_SECTIONS: SettingsSection[] = [
	"sessions",
	"schema",
	"model",
	"layers",
	"canvases",
	"messages",
];

/**
 * Shared shell for every graph-scoped detail page (Overview, Explorer,
 * Modeller — and any future siblings). Owns:
 *
 * - The breadcrumb header (`useAppHeader`) and left rail (`useGraphLeftNav`).
 * - SettingsPanel takeover: docked replaces `leftSection`; expanded replaces
 *   `mainSection` and hides both `leftSection` and `rightSection`.
 * - Footer with the shared `GraphStatusBar` (connection chip + page metrics)
 *   and a right cluster (extras + `AppVersion` + page label).
 *
 * Pages provide their own data + content slots; layout/wiring lives here.
 */
export function GraphDetail({
	sectionId,
	pageLabel,
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
	const leftNav = useGraphLeftNav(username ?? "", graphSlug ?? "", sectionId);

	// Explorer/Modeller get a header switcher between the two views; it names the
	// current view, so the breadcrumb label is dropped to avoid duplication.
	const isSwitchable =
		(sectionId === "explorer" || sectionId === "modeller") &&
		!!username &&
		!!graphSlug;
	const header = useAppHeader({
		pageLabel,
		hideBreadcrumb: isSwitchable,
		leftExtras: isSwitchable ? (
			<GraphSectionSwitcher
				username={username as string}
				graphSlug={graphSlug as string}
				active={sectionId as "explorer" | "modeller"}
			/>
		) : undefined,
		rightExtras: headerRightExtras,
		panelControls: headerPanelControls,
		center: headerCenter,
	});

	// The whole left rail shares one `?settings` param. This view's own panel
	// (SessionsPanel / SchemaNav) opens under its native key; every other value
	// is a bottom-rail settings section that renders the SettingsPanel. A value
	// belonging to the *other* view's native key shows nothing here.
	const nativeKeys = NATIVE_SECTIONS[sectionId] ?? [];
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
	// own main width. Nothing open → no left column.
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

	// We build the horizontal split ourselves on top of AppLayoutV1 (which takes a
	// raw `main`) rather than using AppLayoutV2's `leftSection`/`mainSection` props.
	// AppLayoutV2 renders the main content through a `leftSection ? <Group>…</Group>
	// : <div>…</div>` ternary, so toggling the left panel swaps the *element type* at
	// the main content's parent position — React unmounts and remounts the whole
	// subtree, including the Explorer/Modeller canvas, which then rebuilds its store
	// from the seed and re-runs layout from origin on every panel open/close.
	//
	// Here the `editor-panel` holding the main content is ALWAYS mounted at a
	// stable position, and the sidebar is a *conditional sibling before it* — the
	// exact pattern AppLayoutV2 itself uses for its right (auxiliary) panel, which
	// is why toggling the inspector never remounts the canvas. React reconciles the
	// stable-position editor panel across sidebar toggles, so the canvas survives
	// and keeps its live positions. Structure/classNames otherwise mirror
	// AppLayoutV2 so sizing behaviour is unchanged.
	const mainArea = (
		<div className="flex-1 h-full">
			<ResizablePanelGroup orientation="horizontal" id="main-layout">
				<ResizablePanel
					id="left-main-area"
					defaultSize={effectiveRightSection ? "800px" : undefined}
					minSize={effectiveRightSection ? "400px" : undefined}
				>
					<ResizablePanelGroup orientation="horizontal" id="editor-horizontal">
						{effectiveLeftSection && (
							<>
								<ResizablePanel
									id="sidebar-panel"
									defaultSize={effectiveLeftSection.defaultSize ?? "250px"}
									minSize={effectiveLeftSection.minSize ?? "150px"}
									maxSize={effectiveLeftSection.maxSize ?? "500px"}
									collapsible={effectiveLeftSection.collapsible ?? true}
									groupResizeBehavior="preserve-pixel-size"
								>
									<div className="h-full overflow-auto bg-card">
										{effectiveLeftSection.content}
									</div>
								</ResizablePanel>
								<ResizableHandle withHandle className="w-1" />
							</>
						)}
						<ResizablePanel
							id="editor-panel"
							defaultSize={effectiveMainSection.defaultSize ?? "600px"}
							minSize={effectiveMainSection.minSize ?? "400px"}
						>
							<div className="h-full overflow-auto">
								{effectiveMainSection.content}
							</div>
						</ResizablePanel>
					</ResizablePanelGroup>
				</ResizablePanel>
				{effectiveRightSection && (
					<>
						<ResizableHandle withHandle className="w-1" />
						<ResizablePanel
							id="auxiliary-panel"
							defaultSize={effectiveRightSection.defaultSize ?? "300px"}
							minSize={effectiveRightSection.minSize ?? "200px"}
							maxSize={effectiveRightSection.maxSize ?? "600px"}
							collapsible={effectiveRightSection.collapsible ?? true}
						>
							<div className="h-full overflow-auto bg-card">
								{effectiveRightSection.content}
							</div>
						</ResizablePanel>
					</>
				)}
			</ResizablePanelGroup>
		</div>
	);

	return (
		<AppLayoutV1
			leftNav={leftNav}
			header={header}
			main={mainArea}
			footer={{
				className: "!h-[25px]",
				left: (
					<GraphStatusBar
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
