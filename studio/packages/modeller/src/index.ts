/**
 * `@invana-studio/modeller` — the Modeller's public surface: models, authored
 * one at a time, and the stitches between published ones (the-model-page.md).
 *
 * Two features behind one door: `models/model-editor/` is a model authored on
 * its own, `models/stitch/` is what happens between two published ones, and
 * `models/model-page/` is the one page that reads them all. The app mounts two
 * of these — the `leftSection` panel and the `models` board — and nothing
 * outside this package reaches past this file.
 *
 * What the Modeller borrows from its host comes through `ModellerSlotsContext`.
 */

export { type ModellerSlots, ModellerSlotsContext } from "./ModellerSlots";
export { ModelViewPanel } from "./models/model-editor/ModelViewPanel";
export type { ModelSelection } from "./models/model-editor/types";
export { ModelsPage } from "./models/model-page/ModelsPage";
export { useModelsView } from "./models/model-page/useModelsView";
export { useActiveVersionQuery, useModelsQuery } from "./models/queries";
