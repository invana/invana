/**
 * Connect and model — the border (code-shape.md §4.1 · §4.1d).
 *
 * Two features behind one door: `model/` is a model authored on its own, and
 * `stitch/` is what happens between two published ones, and `models/` is the
 * one page that reads them all (the-model-page.md). The shell mounts two of
 * these — the `leftSection` panel and the `models` board — and nothing outside
 * this folder reaches past this file.
 */
export { ModelViewPanel } from "@/pages/graphs-detail/features/models/model-editor/ModelViewPanel";
export type {
	ModelEditCtx,
	ModelSelection,
	SelectedItem,
} from "@/pages/graphs-detail/features/models/model-editor/types";
export { ModelsPage } from "@/pages/graphs-detail/features/models/model-page/ModelsPage";
export { useModelsView } from "@/pages/graphs-detail/features/models/model-page/useModelsView";

export {
	useActiveVersionQuery,
	useModelsQuery,
} from "@/pages/graphs-detail/features/models/queries";
