import { useDrawerStack } from "@/pages/graphs-detail/shell/useDrawerStack";
import { useCallback } from "react";

// The **Tasks** panel is a stack of three drawers, not a tabbed panel
// (graph-detail-page.md G33). All three are on screen at once; `?drawer=` names
// the one holding the column's height, and `&run=` / `&plan=` / `&entry=` name
// the thing drilled into *inside* its own drawer — the other two keep their
// place, which is the whole reason the three are stacked rather than tabbed.
//
// Read it as one sentence going down the column: a run is an execution of a
// plan, and a plan is a composition of catalogue entries (§3a).
//
// Nothing here reads or writes `?panel=imports`, `?panel=workflows` or
// `?panel=thoughts`: those name surfaces that no longer exist and are
// **deleted, not redirected** (G31).
export type TasksDrawer = "runs" | "plans" | "catalogue";

export const TASKS_DRAWERS: readonly TasksDrawer[] = [
	"runs",
	"plans",
	"catalogue",
];

const TASKS_DETAIL_PARAM: Record<TasksDrawer, string> = {
	runs: "run",
	plans: "plan",
	catalogue: "entry",
};

/**
 * URL-backed state for the Tasks panel's three drawers.
 *
 * - `drawer` — which drawer holds the height. Defaults to `runs`.
 * - `runId` · `planKey` · `entryKey` — what is drilled into, per drawer.
 * - `focus(d)` — give a drawer the height.
 * - `openRun` / `openPlan` / `openEntry` — drill in; `null` goes back to the list.
 */
export function useTasksPanel() {
	const stack = useDrawerStack<TasksDrawer>({
		drawers: TASKS_DRAWERS,
		detailParam: TASKS_DETAIL_PARAM,
	});

	const openRun = useCallback(
		(id: string | null) => stack.open("runs", id),
		[stack.open],
	);
	const openPlan = useCallback(
		(key: string | null) => stack.open("plans", key),
		[stack.open],
	);
	const openEntry = useCallback(
		(key: string | null) => stack.open("catalogue", key),
		[stack.open],
	);

	return {
		drawer: stack.drawer,
		focus: stack.focus,
		runId: stack.detail.runs,
		planKey: stack.detail.plans,
		entryKey: stack.detail.catalogue,
		openRun,
		openPlan,
		openEntry,
	};
}
