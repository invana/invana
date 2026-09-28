import type { CanvasConfig } from "@invana/canvas";
import type { TaskFlowTemplates } from "@/canvases/taskflow/types";
import settingsJson from "./settings.json";
import templatesJson from "./templates.json";

export type { TaskFlowCanvasProps } from "@/canvases/taskflow/TaskFlowCanvas";
export { TaskFlowCanvas } from "@/canvases/taskflow/TaskFlowCanvas";
export * from "@/canvases/taskflow/types";

// JSON import widens string-literal unions to `string`; the files are a
// `CanvasConfig` and two patches of one, so the casts only narrow them back.
export const taskFlowSettings = settingsJson as unknown as CanvasConfig;
export const taskFlowTemplates = templatesJson as unknown as TaskFlowTemplates;
