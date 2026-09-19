/**
 * Connect and model — the border (code-shape.md §4.1 · §4.1d).
 *
 * Two features behind one door: `model/` is a model authored on its own, and
 * `stitch/` is what happens between two published ones. The shell mounts three
 * of these — one `leftSection` and two page kinds — and nothing outside this
 * folder reaches past this file.
 */
export { ModelPanel } from "@/pages/graphs-detail/features/connect-and-model/model/ModelPanel";
export { ModelCanvas } from "@/pages/graphs-detail/features/connect-and-model/model/ModelCanvas";
export { GlobalModelPage } from "@/pages/graphs-detail/features/connect-and-model/stitch/GlobalModelPage";
export { AllModelsCanvas } from "@/pages/graphs-detail/features/connect-and-model/stitch/AllModelsCanvas";
export type {
	ModelEditCtx,
	ModelSelection,
	SelectedItem,
} from "@/pages/graphs-detail/features/connect-and-model/model/types";
