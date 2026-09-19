/**
 * **Tasks** — one icon, one panel, three drawers (graph-detail-page.md G33).
 *
 * `Runs` · `Plans` · `Catalogue`, stacked, **with no panel header above them**:
 * the first drawer header is the top of the column, and the breadcrumb already
 * says which panel is open (G16 · G32). Each drawer carries its own search and
 * filter, because the three lists filter on different columns.
 *
 * Read it as one sentence going down the page — a run is an execution of a
 * plan, and a plan is a composition of catalogue entries. Each drawer is the
 * definition of the one above it, which is why they are stacked in one column
 * rather than given three icons, and why they are open at once rather than one
 * at a time: following *this run → the plan it ran → the callable that failed*
 * never leaves the column and never closes what you came from (§3a).
 *
 * **Todos are not here.** A Todo is what a person wrote; it lives under
 * Projects, because a Todo without its project is a to-do list and the project
 * is the thing it is for (PT7). The word *Tasks* in the rail names `TaskRun`s,
 * `TaskPlan`s and the catalogue — never Todos.
 */

import { runsDrawerSection } from "@/pages/graphs-detail/features/operate/RunsDrawer";
import { catalogueDrawerSection } from "@/pages/graphs-detail/features/workflows/CatalogueDrawer";
import { plansDrawerSection } from "@/pages/graphs-detail/features/workflows/PlansDrawer";
import { useTaskDrawerUi } from "@/pages/graphs-detail/shared/TaskDrawer";
import {
	type TasksDrawer,
	useTasksPanel,
} from "@/pages/graphs-detail/shell/useTasksPanel";
import { PanelStack, type PanelStackHandle } from "@invana/ui";
import { useEffect, useRef, useState } from "react";

export interface TasksStackPanelProps {
	username: string;
	graphSlug: string;
	/** The dataset the inspector's provenance line asked for. */
	selectedStepId: string | null;
	/** `More` on a run — opens its dashboard as a page (SR13 · SR36). */
	onOpenRunDashboard?: (runId: string) => void;
	onOpenPlanCanvas?: (key: string) => void;
	onOpenAgent?: (agentId: string) => void;
	planExportUrl?: (key: string) => string;
}

export function TasksStackPanel({
	username,
	graphSlug,
	selectedStepId,
	onOpenRunDashboard,
	onOpenPlanCanvas,
	onOpenAgent,
	planExportUrl,
}: TasksStackPanelProps) {
	const tasks = useTasksPanel();
	const ui = useTaskDrawerUi();

	// Filters are per drawer and in-memory: they narrow a list, and a narrowed
	// list is not a place — `?drawer=` and the drill-in keys are what a link
	// carries (G31).
	const [runStatus, setRunStatus] = useState<string | null>(null);
	const [planKind, setPlanKind] = useState("");
	const [planSource, setPlanSource] = useState("");

	// The drawer named by `?drawer=` opens with the height; the other two sit
	// with a little of their list showing, which is what makes the stack read as
	// three lists rather than as an accordion. `PanelStack` reads `defaultSize`
	// at **mount**, so this is the opening split only (G35).
	const size = (d: TasksDrawer) => (tasks.drawer === d ? "60%" : "20%");

	// After mount the split is the reader's — they dragged it, so nothing here
	// re-asserts it. The one thing that overrides them is a **drill-in**: the URL
	// now names something to look at, and the drawer holding it may be collapsed,
	// in which case the detail renders into a section that was shut ten minutes
	// ago and the click appears to have done nothing. So the focused drawer is
	// expanded whenever the focus moves *or* what it is drilled into changes —
	// the second half matters because arriving at a run from the canvas leaves
	// `?drawer=runs` untouched and only `&run=` moves (G35).
	const stackRef = useRef<PanelStackHandle>(null);
	const focused =
		tasks.drawer === "runs"
			? tasks.runId
			: tasks.drawer === "plans"
				? tasks.planKey
				: tasks.entryKey;
	// `focused` is a trigger, not a value: the effect re-runs when the drill-in
	// moves but never reads it. Dropping it is the bug this wiring exists to fix.
	// biome-ignore lint/correctness/useExhaustiveDependencies: see above.
	useEffect(() => {
		stackRef.current?.expand(tasks.drawer);
	}, [tasks.drawer, focused]);

	return (
		<PanelStack
			withHandle
			stackRef={stackRef}
			className="h-full"
			headerHeight={30}
			sections={[
				runsDrawerSection({
					username,
					graphSlug,
					ui,
					runId: tasks.runId,
					onOpenRun: tasks.openRun,
					onOpenDashboard: onOpenRunDashboard,
					status: runStatus,
					onStatus: setRunStatus,
					defaultSize: size("runs"),
				}),
				plansDrawerSection({
					username,
					graphSlug,
					ui,
					planKey: tasks.planKey,
					onOpenPlan: tasks.openPlan,
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
					entryKey: tasks.entryKey,
					onOpenEntry: tasks.openEntry,
					defaultSize: size("catalogue"),
				}),
			]}
		/>
	);
}
