/**
 * `@invana-studio/canvases` — canvas compositions more than one product draws:
 * the model canvas and the task-flow canvas, plus the theme bridge both use.
 *
 * Names are listed, not starred: both canvases declare a `Detail` level type,
 * and each keeps its own.
 */

export { graphModelSettings, graphModelTemplates } from "./model";
export { hueSlotForName } from "./model/config";
export {
	GraphModelCanvas,
	type GraphModelCanvasProps,
} from "./model/GraphModelCanvas";
export {
	type Detail as ModelDetail,
	type GraphModelTemplates,
	MEMBER_BINDING,
	MODEL_EMPTY_TYPE,
	MODEL_FRAME_TYPE,
	type ModelCanvasSelection,
	type ModelEdgeData,
	type ModelFrameData,
	type ModelFrameNode,
	type ModelGraphData,
	type ModelGraphEdge,
	type ModelProperty,
	type ModelTypeData,
	type ModelTypeNode,
	SCHEMA_CARD,
} from "./model/types";
export { taskFlowSettings, taskFlowTemplates } from "./taskflow";
export {
	TaskFlowCanvas,
	type TaskFlowCanvasProps,
} from "./taskflow/TaskFlowCanvas";
export {
	type Detail as TaskFlowDetail,
	type TaskEdgeData,
	type TaskFlowData,
	type TaskFlowEdge,
	type TaskFlowNode,
	type TaskFlowState,
	type TaskFlowTemplates,
	type TaskNodeData,
	type TaskNodeType,
	type TaskTone,
	taskNodeTypeOf,
	taskToneOf,
} from "./taskflow/types";
export { readCanvasThemeConfig, useStudioCanvasTheme } from "./theme";
