/**
 * Govern — worlds and guardrails, the bounds a Graph runs inside.
 *
 * Its own `leftNav` item holding two sections (GV17): a guardrail belongs beside
 * the worlds it bounds, and the two are one record.
 */

export { LensesViewPanel } from "@/pages/graphs-detail/features/lenses/LensesViewPanel";
export { LensBoardPage } from "@/pages/graphs-detail/features/lenses/boards/LensBoardPage";
export { LensDetail } from "@/pages/graphs-detail/features/lenses/LensDetail";
export { LensEditor } from "@/pages/graphs-detail/features/lenses/LensEditor";
export {
	CompareBoardPage,
	parseComparePair,
} from "@/pages/graphs-detail/features/lenses/CompareBoardPage";
export { layersOptions } from "@/pages/graphs-detail/features/lenses/runLayers";
export {
	lensSummary,
	runLensOptions,
} from "@/pages/graphs-detail/features/lenses/runLens";
/** Legacy — frozen reports only. See the file. */
export { RunLensWidget } from "@/pages/graphs-detail/features/lenses/RunLensWidget";
export {
	StepTouchWidget,
	touchesOfStepKey,
} from "@/pages/graphs-detail/features/lenses/StepTouchWidget";

export { matches } from "@/pages/graphs-detail/features/lenses/addressing";
export { CompareDialog } from "@/pages/graphs-detail/features/lenses/CompareDialog";
export {
	useLensesQuery,
	useParticipantsQuery,
	useRunTouchesQuery,
} from "@/pages/graphs-detail/features/lenses/queries";
export { BANDS } from "@/pages/graphs-detail/features/lenses/runLayers";
export type { WithStepTouch } from "@/pages/graphs-detail/features/lenses/StepTouchWidget";
export type {
	Lens,
	LensKind,
	Touch,
	TouchesResponse,
} from "@/pages/graphs-detail/features/lenses/types";
