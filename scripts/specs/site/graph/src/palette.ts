/**
 * The canvas colours, read from the design-kit tokens so the graph follows the theme.
 *
 * A kind's or an edge type's colour is canvas-ui's `typeColor` — the name hashed onto the kit's eight data slots
 * (`--color-data-N`). The placeholder grey is the `--color-muted-foreground` token. A token's value can be any CSS
 * colour (`oklch(…)`, `hsl(…)`), so it is painted on a 1×1 canvas and read back as RGB — the browser does the
 * conversion. The categorical slots (`data`) are the same eight `--color-data-N` tokens, read in order. Build the
 * palette again after a theme change.
 */
import { typeColor } from "@invana/canvas-ui";
import type { Palette } from "./model";

/** A CSS colour token as `0xRRGGBB`, or `fallback` when the page has no such token. */
export function tokenColour(token: string, fallback: number): number {
	const value = getComputedStyle(document.documentElement)
		.getPropertyValue(token)
		.trim();
	const ctx = document.createElement("canvas").getContext("2d");
	if (!value || !ctx) return fallback;
	ctx.fillStyle = value;
	ctx.fillRect(0, 0, 1, 1);
	const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
	return ((r ?? 0) << 16) | ((g ?? 0) << 8) | (b ?? 0);
}

/** The page's palette, read now. */
export function readPalette(): Palette {
	const DATA = Array.from({ length: 8 }, (_, i) =>
		tokenColour(`--color-data-${i + 1}`, typeColor(String(i))),
	);
	return {
		type: typeColor,
		muted: tokenColour("--color-muted-foreground", typeColor("placeholder")),
		alert: tokenColour("--color-warning", typeColor("idea")),
		data: (slot) => DATA[slot % DATA.length] ?? typeColor(String(slot)),
	};
}
