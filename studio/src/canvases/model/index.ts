import type { GraphModelTemplates } from "@/canvases/model/types";
import type { CanvasConfig } from "@invana/canvas";
import settingsJson from "./settings.json";
import templatesJson from "./templates.json";

export {
	GraphModelCanvas,
	MODEL_LAYER_ID,
} from "@/canvases/model/GraphModelCanvas";
export type { GraphModelCanvasProps } from "@/canvases/model/GraphModelCanvas";
export { HUE_COUNT, hueSlotForName } from "@/canvases/model/config";
export * from "@/canvases/model/types";

// JSON import widens string-literal unions to `string`; the files are a
// `CanvasConfig` and three patches of one, so the casts only narrow them back.
export const graphModelSettings = settingsJson as unknown as CanvasConfig;
export const graphModelTemplates =
	templatesJson as unknown as GraphModelTemplates;
