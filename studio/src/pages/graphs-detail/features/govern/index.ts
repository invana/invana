/**
 * Govern — worlds and guardrails, the bounds a Graph runs inside.
 *
 * Its own `leftNav` item holding two drawers (GV17): a guardrail belongs beside
 * the worlds it bounds, and the two are one record.
 */

export { GovernStackPanel } from "@/pages/graphs-detail/features/govern/GovernStackPanel";
export { LensBoardPage } from "@/pages/graphs-detail/features/govern/dashboards";
export { LensDetail } from "@/pages/graphs-detail/features/govern/LensDetail";
export { LensEditor } from "@/pages/graphs-detail/features/govern/LensEditor";
export { WorldChip } from "@/pages/graphs-detail/features/govern/WorldChip";
export {
	ComparePage,
	parseComparePair,
} from "@/pages/graphs-detail/features/govern/ComparePage";
export { layersOptions } from "@/pages/graphs-detail/features/govern/runLayers";
export {
	lensSummary,
	runLensOptions,
} from "@/pages/graphs-detail/features/govern/runLens";
/** Legacy — frozen reports only. See the file. */
export { RunLensPanel } from "@/pages/graphs-detail/features/govern/RunLensPanel";
export {
	StepTouchPanel,
	touchesOfStepKey,
} from "@/pages/graphs-detail/features/govern/StepTouchPanel";
