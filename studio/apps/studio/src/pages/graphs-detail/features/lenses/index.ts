/**
 * Govern — worlds and guardrails, the bounds a Graph runs inside.
 *
 * Its own `leftNav` item holding two sections: a guardrail belongs beside
 * the worlds it bounds, and the two are one record.
 *
 * The lens and touch records are wire types in `@invana-studio/core`; what a
 * run touched, as a run's board draws it, is in `@invana-studio/shell`.
 */

export { matches } from "@/pages/graphs-detail/features/lenses/addressing";
export { LensBoardPage } from "@/pages/graphs-detail/features/lenses/boards/LensBoardPage";
export {
	CompareBoardPage,
	parseComparePair,
} from "@/pages/graphs-detail/features/lenses/CompareBoardPage";

export { LensesViewPanel } from "@/pages/graphs-detail/features/lenses/LensesViewPanel";
export {
	useLensesQuery,
	useParticipantsQuery,
	useRunTouchesQuery,
} from "@/pages/graphs-detail/features/lenses/queries";
/** Legacy — frozen reports only. See the file. */
export { RunLensWidget } from "@/pages/graphs-detail/features/lenses/RunLensWidget";

export { useLensesViewPanel } from "@/pages/graphs-detail/features/lenses/useLensesViewPanel";
