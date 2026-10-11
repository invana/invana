/**
 * What the graph page lends the runs surfaces: the Graph's agents, what a run
 * touched and the Govern panel's `reveal` (lenses), `Save report` on a
 * declared board (boards), and the page's path-backed params. The shell may
 * import none of these, so the page hands them in through
 * `ActivitySlotsContext`.
 *
 * One module-level object, so the hooks it carries are the same functions on
 * every render.
 */

import {
	useLensesViewPanel,
	useRunTouchesQuery,
} from "@invana-studio/modeller";
import type { ActivitySlots } from "@invana-studio/shell";
import { usePageParams, useReport } from "@invana-studio/shell";
import { useAgentsQuery } from "@/pages/graphs-detail/features/agents";

export const activitySlots: ActivitySlots = {
	useAgents: useAgentsQuery,
	useRunTouches: useRunTouchesQuery,
	useReport,
	useLensesViewPanel,
	usePageParams,
};
