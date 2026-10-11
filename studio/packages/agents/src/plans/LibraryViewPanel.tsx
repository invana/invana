/**
 * **Library** — one rail item, one panel, two sections (agents.md › Library).
 *
 * `Plans` · `Templates`, stacked, **with no panel header above them**: the
 * first section header is the top of the column, and the breadcrumb already
 * says which panel is open. Each section carries its own search and filter,
 * because the two lists filter on different columns.
 *
 * Read it as one sentence going down the page — a template renders what the
 * plan produced. The catalogue of task types a plan is written in is under
 * Plugins, which bring them.
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
 * would otherwise have to click each row to discover, and both sections
 * already print their own totals in their headers — a bar that repeated them
 * would be the third place the same number is written.
 *
 * **A skill's plan is not here either.** It is owned 1:1 by a skill version
 * (orchestration.md §0.8) and reached from the skill's Flow tab; the Plans
 * section lists `reusable: true` only, and a row says which skill owns it when
 * one does.
 */

import { PanelStack, type PanelStackHandle } from "@invana/ui";
import {
	PanelStatusBar,
	StatusCrumb,
	useStackSectionUi,
} from "@invana-studio/ui";
import { useEffect, useRef, useState } from "react";
import { templatesSection } from "../projections/TemplatesSection";
import { plansSection } from "./PlansSection";
import {
	type LibrarySectionKey,
	useLibraryViewPanel,
} from "./useLibraryViewPanel";

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

	// The section named by `?section=` opens with the height; the other sits
	// with a little of their list showing, which is what makes the stack read as
	// two lists rather than as an accordion. `PanelStack` reads `defaultSize`
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
		library.sectionKey === "plans" ? library.planKey : library.templateId;
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
				right="templates render plans"
			/>
		</div>
	);
}
