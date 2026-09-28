/**
 * **Library** — one icon, one panel, three sections (graph-detail-page.md). Drawn as `L1 · Library` on the *Skills and the left rail* canvas.
 *
 * `Plans` · `Catalogue` · `Templates`, stacked, **with no panel header above
 * them**: the first section header is the top of the column, and the breadcrumb
 * already says which panel is open. Each section carries its own
 * search and filter, because the three lists filter on different columns.
 *
 * Read it as one sentence going down the page — a plan is a composition of
 * catalogue entries, and a template renders what the plan produced. Each section
 * is the definition of the one above it, which is why they are stacked in one
 * column rather than given three icons.
 *
 * **Runs is not here.** Execution is its own panel and holds the journal alone.
 * The step that crosses the two is *run → the plan it ran*, and
 * `mainSection` carries it: a run's detail is a page, a plan's main view is a
 * canvas page, and `keepMounted` keeps the run open beside it — which is better
 * than the section adjacency asked for, because the two are side by side
 * rather than stacked in a 420px column.
 *
 * **Picking a plan draws it**. This panel opens no canvas of its own: the
 * Plans section names what it drilled into in `&plan=`, and the page reads that.
 *
 * **The status bar is the panel's, and it carries no count.** Every stacked
 * panel has one in `footer.left`, and the Library's says where you are
 * (`Library`, then the plan you drilled into) and what the panel means. Its
 * `middle` is empty on purpose: that slot exists for a live count a reader
 * would otherwise have to click each row to discover, and all three sections
 * already print their own totals in their headers — a bar that repeated them
 * would be the third place the same number is written.
 *
 * **A skill's plan is not here either.** It is owned 1:1 by a skill version
 * (orchestration.md §0.8) and reached from the skill's Flow tab; the Plans
 * section lists `reusable: true` only, and a row says which skill owns it when
 * one does.
 */

import { PanelStack, type PanelStackHandle } from "@invana/ui";
import { useEffect, useRef, useState } from "react";
import { catalogueSection } from "@/pages/graphs-detail/features/plans/CatalogueSection";
import { plansSection } from "@/pages/graphs-detail/features/plans/PlansSection";
import {
	type LibrarySectionKey,
	useLibraryViewPanel,
} from "@/pages/graphs-detail/features/plans/useLibraryViewPanel";
import { templatesSection } from "@/pages/graphs-detail/features/projections";
import { useStackSectionUi } from "@/pages/graphs-detail/shared/StackSection";
import { PanelStatusBar, StatusCrumb } from "@/ui/PanelStatusBar";

export interface LibraryViewPanelProps {
	username: string;
	graphSlug: string;
	/** The step the inspector's provenance line asked for. */
	selectedStepId: string | null;
	onOpenAgent?: (agentId: string) => void;
	planExportUrl?: (key: string) => string;
}

export function LibraryViewPanel({
	username,
	graphSlug,
	selectedStepId,
	onOpenAgent,
	planExportUrl,
}: LibraryViewPanelProps) {
	const library = useLibraryViewPanel();
	const ui = useStackSectionUi();

	// Filters are per section and in-memory: they narrow a list, and a narrowed
	// list is not a place — `?section=` and the drill-in keys are what a link
	// carries.
	const [planKind, setPlanKind] = useState("");
	const [planSource, setPlanSource] = useState("");
	const [templateKind, setTemplateKind] = useState("");
	const [templateSurface, setTemplateSurface] = useState("");
	// Authoring a template is a body this section shows, not a record the URL
	// names — so it is local, and a reload lands on the list.
	const [authoringTemplate, setAuthoringTemplate] = useState(false);
	// Promoting is a dialog the Plans section opens from its header action, so
	// the flag sits here beside the header that raises it.
	const [promotingPlan, setPromotingPlan] = useState(false);

	// The section named by `?section=` opens with the height; the other two sit
	// with a little of their list showing, which is what makes the stack read as
	// three lists rather than as an accordion. `PanelStack` reads `defaultSize`
	// at **mount**, so this is the opening split only.
	const size = (d: LibrarySectionKey) =>
		library.sectionKey === d ? "60%" : "20%";

	// After mount the split is the reader's — they dragged it, so nothing here
	// re-asserts it. The one thing that overrides them is a **drill-in**: the URL
	// now names something to look at, and the section holding it may be collapsed,
	// in which case the detail renders into a section that was shut ten minutes
	// ago and the click appears to have done nothing. So the focused section is
	// expanded whenever the focus moves *or* what it is drilled into changes —
	// the second half matters because arriving at a plan from the canvas leaves
	// `?section=plans` untouched and only `&plan=` moves.
	const stackRef = useRef<PanelStackHandle>(null);
	const focused =
		library.sectionKey === "plans"
			? library.planKey
			: library.sectionKey === "catalogue"
				? library.entryKey
				: library.templateId;
	// `focused` is a trigger, not a value: the effect re-runs when the drill-in
	// moves but never reads it. Dropping it is the bug this wiring exists to fix.
	// biome-ignore lint/correctness/useExhaustiveDependencies: see above.
	useEffect(() => {
		stackRef.current?.expand(library.sectionKey);
	}, [library.sectionKey, focused]);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="min-h-0 flex-1">
				<PanelStack
					withHandle
					stackRef={stackRef}
					className="h-full"
					headerHeight={30}
					sections={[
						plansSection({
							username,
							graphSlug,
							ui,
							planKey: library.planKey,
							onOpenPlan: library.openPlan,
							selectedStepId,
							onOpenAgent,
							promoting: promotingPlan,
							onPromoting: setPromotingPlan,
							exportUrl: planExportUrl,
							kindFilter: planKind,
							onKindFilter: setPlanKind,
							sourceFilter: planSource,
							onSourceFilter: setPlanSource,
							defaultSize: size("plans"),
						}),
						catalogueSection({
							username,
							graphSlug,
							ui,
							entryKey: library.entryKey,
							onOpenEntry: library.openEntry,
							defaultSize: size("catalogue"),
						}),
						templatesSection({
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
			</div>
			<PanelStatusBar
				left={
					<>
						<StatusCrumb active={!library.planKey}>Library</StatusCrumb>
						{library.planKey ? (
							<StatusCrumb active>{library.planKey}</StatusCrumb>
						) : null}
					</>
				}
				right="a plan composes the catalogue; a template renders what it produced"
			/>
		</div>
	);
}
