/**
 * **Library** — one icon, one panel, three drawers (graph-detail-page.md G33 ·
 * G41). Drawn as `L1 · Library` on the *Skills and the left rail* canvas.
 *
 * `Plans` · `Catalogue` · `Templates`, stacked, **with no panel header above
 * them**: the first drawer header is the top of the column, and the breadcrumb
 * already says which panel is open (G16 · G32). Each drawer carries its own
 * search and filter, because the three lists filter on different columns.
 *
 * Read it as one sentence going down the page — a plan is a composition of
 * catalogue entries, and a template renders what the plan produced. Each drawer
 * is the definition of the one above it, which is why they are stacked in one
 * column rather than given three icons.
 *
 * **Runs is not here.** Execution is its own panel and holds the journal alone
 * (G41 · SR1). The step that crosses the two is *run → the plan it ran*, and
 * `mainSection` carries it: a run's detail is a page, a plan's main view is a
 * canvas page, and `keepMounted` keeps the run open beside it — which is better
 * than the drawer adjacency SR12 asked for, because the two are side by side
 * rather than stacked in a 420px column.
 *
 * **A skill's plan is not here either.** It is owned 1:1 by a skill version
 * (orchestration.md §0.8) and reached from the skill's Flow tab; the Plans
 * drawer lists `reusable: true` only, and a row says which skill owns it when
 * one does.
 */

import { templatesDrawerSection } from "@/pages/graphs-detail/features/ask/projections/TemplatesDrawer";
import { catalogueDrawerSection } from "@/pages/graphs-detail/features/workflows/CatalogueDrawer";
import { plansDrawerSection } from "@/pages/graphs-detail/features/workflows/PlansDrawer";
import { useTaskDrawerUi } from "@/pages/graphs-detail/shared/TaskDrawer";
import {
	type LibraryDrawer,
	useLibraryPanel,
} from "@/pages/graphs-detail/shell/useLibraryPanel";
import { PanelStack, type PanelStackHandle } from "@invana/ui";
import { useEffect, useRef, useState } from "react";

export interface LibraryStackPanelProps {
	username: string;
	graphSlug: string;
	/** The step the inspector's provenance line asked for. */
	selectedStepId: string | null;
	onOpenPlanCanvas?: (key: string) => void;
	onOpenAgent?: (agentId: string) => void;
	planExportUrl?: (key: string) => string;
}

export function LibraryStackPanel({
	username,
	graphSlug,
	selectedStepId,
	onOpenPlanCanvas,
	onOpenAgent,
	planExportUrl,
}: LibraryStackPanelProps) {
	const library = useLibraryPanel();
	const ui = useTaskDrawerUi();

	// Filters are per drawer and in-memory: they narrow a list, and a narrowed
	// list is not a place — `?drawer=` and the drill-in keys are what a link
	// carries (G31).
	const [planKind, setPlanKind] = useState("");
	const [planSource, setPlanSource] = useState("");
	const [templateKind, setTemplateKind] = useState("");
	const [templateSurface, setTemplateSurface] = useState("");
	// Authoring a template is a body this drawer shows, not a record the URL
	// names — so it is local, and a reload lands on the list (G3).
	const [authoringTemplate, setAuthoringTemplate] = useState(false);

	// The drawer named by `?drawer=` opens with the height; the other two sit
	// with a little of their list showing, which is what makes the stack read as
	// three lists rather than as an accordion. `PanelStack` reads `defaultSize`
	// at **mount**, so this is the opening split only (G35).
	const size = (d: LibraryDrawer) => (library.drawer === d ? "60%" : "20%");

	// After mount the split is the reader's — they dragged it, so nothing here
	// re-asserts it. The one thing that overrides them is a **drill-in**: the URL
	// now names something to look at, and the drawer holding it may be collapsed,
	// in which case the detail renders into a section that was shut ten minutes
	// ago and the click appears to have done nothing. So the focused drawer is
	// expanded whenever the focus moves *or* what it is drilled into changes —
	// the second half matters because arriving at a plan from the canvas leaves
	// `?drawer=plans` untouched and only `&plan=` moves (G35).
	const stackRef = useRef<PanelStackHandle>(null);
	const focused =
		library.drawer === "plans"
			? library.planKey
			: library.drawer === "catalogue"
				? library.entryKey
				: library.templateId;
	// `focused` is a trigger, not a value: the effect re-runs when the drill-in
	// moves but never reads it. Dropping it is the bug this wiring exists to fix.
	// biome-ignore lint/correctness/useExhaustiveDependencies: see above.
	useEffect(() => {
		stackRef.current?.expand(library.drawer);
	}, [library.drawer, focused]);

	return (
		<PanelStack
			withHandle
			stackRef={stackRef}
			className="h-full"
			headerHeight={30}
			sections={[
				plansDrawerSection({
					username,
					graphSlug,
					ui,
					planKey: library.planKey,
					onOpenPlan: library.openPlan,
					selectedStepId,
					onOpenCanvas: onOpenPlanCanvas,
					onOpenAgent,
					exportUrl: planExportUrl,
					kindFilter: planKind,
					onKindFilter: setPlanKind,
					sourceFilter: planSource,
					onSourceFilter: setPlanSource,
					defaultSize: size("plans"),
				}),
				catalogueDrawerSection({
					ui,
					entryKey: library.entryKey,
					onOpenEntry: library.openEntry,
					defaultSize: size("catalogue"),
				}),
				templatesDrawerSection({
					username,
					graphSlug,
					ui,
					templateId: library.templateId,
					onOpenTemplate: library.openTemplate,
					authoring: authoringTemplate,
					onAuthoring: setAuthoringTemplate,
					kindFilter: templateKind,
					onKindFilter: setTemplateKind,
					surfaceFilter: templateSurface,
					onSurfaceFilter: setTemplateSurface,
					defaultSize: size("templates"),
				}),
			]}
		/>
	);
}
