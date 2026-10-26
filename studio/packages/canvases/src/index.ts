/**
 * `@invana-studio/canvases` — canvas compositions more than one product draws:
 * the model canvas, the task-flow canvas and the layered canvas (plan,
 * workflow, envelope and lineage), plus the render backend. Theme and type
 * colours are canvas's: `CanvasThemeSync source="tokens"` and `typeColor`.
 *
 * Names are listed, not starred: both canvases declare a `Detail` level type,
 * and each keeps its own. Only what a caller imports is listed — knip fails
 * on a name nobody outside the package uses.
 */

export type { CanvasBackend } from "./backend";
export {
	LayeredCanvas,
	type LayeredEdge,
	type LayeredNode,
} from "./layered/LayeredCanvas";
export {
	GlobalModelBoard,
	type GlobalModelSelect,
} from "./model/GlobalModelBoard";
export { GraphModelCanvas } from "./model/GraphModelCanvas";
export {
	hueSlotForName,
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
