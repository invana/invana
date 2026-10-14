import type { CanvasConfig } from "@invana/canvas";
import settingsJson from "./settings.json";
import templatesJson from "./templates.json";
import type { GraphModelTemplates } from "./types";

export * from "./types";

// JSON import widens string-literal unions to `string`; the files are a
// `CanvasConfig` and three patches of one, so the casts only narrow them back.
export const graphModelSettings = settingsJson as unknown as CanvasConfig;
export const graphModelTemplates =
	templatesJson as unknown as GraphModelTemplates;
