// Studio-facing theme list for the ThemeSelector pickers (RFC-044).
//
// Starts from the catalog registered in `@invana/styling`, then hides a few
// themes and relabels others for studio. Only the display `name`/`description`
// change — the theme `id` (and its variants) are untouched, so the `[data-theme]`
// CSS still applies and persisted selections stay valid.

import type { Theme } from "@invana/styling/themes.config";
import { themes as baseThemes } from "@invana/styling/themes.config";

// Theme ids to drop from the picker. `vite` is a dev-facing sample brand, not a
// polished option we want to offer an intelligence tool's users.
const HIDDEN_IDS = new Set(["vite"]);

// id → studio label overrides. The base catalog ships plain colour names; we give
// the offered themes more considered names (a gemstone family) that read better in
// a graph-intelligence product.
const RENAMES: Record<string, { name: string; description?: string }> = {
	tailwind: {
		name: "Dark Night",
		description: "Deep-blue night theme (light/dark/system)",
	},
	gold: {
		name: "Amber",
		description: "Warm amber accent on a near-black canvas (light/dark/system)",
	},
	rose: {
		name: "Garnet",
		description:
			"Deep garnet accent on a warm near-black canvas (light/dark/system)",
	},
};

export const STUDIO_THEMES: Theme[] = baseThemes
	.filter((t) => !HIDDEN_IDS.has(t.id))
	.map((t) => {
		const rename = RENAMES[t.id];
		return rename ? { ...t, ...rename } : t;
	});
