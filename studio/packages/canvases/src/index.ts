/**
 * `@invana-studio/canvases` — canvas compositions more than one product draws:
 * the model canvas and the task-flow canvas, plus the theme bridge, the render
 * backend and the type colours every canvas kind shares.
 *
 * Names are listed, not starred: both canvases declare a `Detail` level type,
 * and each keeps its own. Only what a caller imports is listed — knip fails
 * on a name nobody outside the package uses.
 */

export type { CanvasBackend } from "./backend";
export { graphModelSettings, graphModelTemplates } from "./model";
export { hueSlotForName } from "./model/config";
export { GraphModelCanvas } from "./model/GraphModelCanvas";
export {
	MODEL_EMPTY_TYPE,
	MODEL_FRAME_TYPE,
	type ModelCanvasSelection,
	type ModelEdgeData,
	type ModelFrameNode,
	type ModelGraphData,
	type ModelGraphEdge,
	type ModelProperty,
	type ModelTypeNode,
} from "./model/types";
export { taskFlowSettings, taskFlowTemplates } from "./taskflow";
export { TaskFlowCanvas } from "./taskflow/TaskFlowCanvas";
export {
	type TaskFlowData,
	type TaskFlowEdge,
	type TaskFlowNode,
	type TaskFlowState,
	taskNodeTypeOf,
	taskToneOf,
} from "./taskflow/types";
export { readCanvasThemeConfig } from "./theme";
// Engine adapters — PixiJS needs concrete values, not classes.
export { slotForType, typeColorNumber, typeDotColor } from "./typeColor";
