// Studio-facing theme list for the ThemeSelector pickers (RFC-044).
//
// Starts from the catalog registered in `@invana/styling` and relabels a few
// themes for studio. Only the display `name`/`description` change — the theme
// `id` (and its variants) are untouched, so the `[data-theme]` CSS still applies
// and persisted selections stay valid.

import type { Theme } from "@invana/styling/themes.config";
import { themes as baseThemes } from "@invana/styling/themes.config";

// id → studio label overrides.
const RENAMES: Record<string, { name: string; description?: string }> = {
	tailwind: {
		name: "Dark Night",
		description: "Deep-blue night theme (light/dark/system)",
	},
};

export const STUDIO_THEMES: Theme[] = baseThemes.map((t) => {
	const rename = RENAMES[t.id];
	return rename ? { ...t, ...rename } : t;
});
