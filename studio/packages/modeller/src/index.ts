/**
 * `@invana-studio/modeller` — the Modeller's public surface: its
 * `ProductDefinition`; models, authored one at a time, and the stitches between
 * published ones (the-model-page.md); the bounds a Graph runs inside — worlds
 * and guardrails (`govern/`), its rules (`rules/`) and the requests they cause
 * (`requests/`); and the Graph's settings (`settings/`).
 *
 * `models/model-editor/` is a model authored on its own, `models/stitch/` is
 * what happens between two published ones, and `models/model-page/` is the one
 * page that reads them all. Nothing outside this package reaches past this
 * file.
 *
 * What the Modeller borrows from its host comes through `ModellerSlotsContext`.
 */

export { matches } from "./govern/addressing";
export { LensBoardPage } from "./govern/boards/LensBoardPage";
export { CompareBoardPage, parseComparePair } from "./govern/CompareBoardPage";
export { GuardrailsPage } from "./govern/pages/GuardrailsPage";
export { WorldsPage } from "./govern/pages/WorldsPage";
export { GovernViewPanel } from "./govern/panel/GovernViewPanel";
export {
	useParticipantsQuery,
	useRunTouchesQuery,
} from "./govern/queries";
export { useLensesViewPanel } from "./govern/useLensesViewPanel";
export { type ModellerSlots, ModellerSlotsContext } from "./ModellerSlots";
export { ModelViewPanel } from "./models/model-editor/ModelViewPanel";
export type { ModelSelection } from "./models/model-editor/types";
export { ModelsPage } from "./models/model-page/ModelsPage";
export { useModelsView } from "./models/model-page/useModelsView";
export { useActiveVersionQuery, useModelsQuery } from "./models/queries";
export { GlobalModelPage } from "./models/stitch/GlobalModelPage";
export { ModellerStatusBar } from "./models/stitch/ModellerStatusBar";
export { StitchesPage } from "./models/stitch/StitchesPage";
export { useModellerCrumb } from "./models/stitch/useModellerCrumb";
export { modeller } from "./product";
export { RequestsPage } from "./requests/RequestsPage";
export { RulesViewPanel } from "./rules/RulesViewPanel";
export { SettingsViewPanel } from "./settings/SettingsViewPanel";
