import type { CanvasConfig } from "@invana/canvas";
import type { GraphModelTemplates } from "@/canvases/model/types";
import settingsJson from "./settings.json";
import templatesJson from "./templates.json";

export { hueSlotForName } from "@/canvases/model/config";

export { GraphModelCanvas } from "@/canvases/model/GraphModelCanvas";
export * from "@/canvases/model/types";

// JSON import widens string-literal unions to `string`; the files are a
// `CanvasConfig` and three patches of one, so the casts only narrow them back.
export const graphModelSettings = settingsJson as unknown as CanvasConfig;
export const graphModelTemplates =
	templatesJson as unknown as GraphModelTemplates;
