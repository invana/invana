/**
 * The colour a type is painted in — resolved the same way for the canvas and
 * for the panel that lists it.
 *
 * The Explorer panel's type rows are a legend (selection-and-the-panel.md), and
 * a legend whose dot is a different colour from the drawing is worse than none.
 * So both read this: an explicit style colour if the canvas has one, else a slot
 * from the categorical data palette, chosen by the type's name.
 *
 * **The palette is `@invana/styling`'s, not ours** (design-kit-coverage.md D2):
 * `--color-data-1` … `--color-data-8`, one scale shared by charts, legends, list
 * dots and `@invana/canvas`. Tokens, so light and dark are each selected rather
 * than one flipped into the other, and so no hex lives in Studio. Read off the
 * live DOM the way `canvasTheme.ts` reads the rest of the theme — the canvas
 * paints to a PixiJS surface and needs concrete values, not classes.
 *
 * Assignment is stable per type name, so a type keeps its colour across canvases
 * and reloads. A graph can hold more types than the palette has slots; past the
 * eighth, slots repeat. That is a considered exception to the palette's
 * never-cycle rule, which exists so a *chart*'s series stay distinguishable: on
 * a graph every node must be painted something, and identity here is carried by
 * the label beside it — the legend row's type name, the node's own label — never
 * by colour alone.
 */

import { cssColorToNumber } from "@invana/graph";

/** How many slots the data palette defines. */
const SLOTS = 8;

/**
 * Neutral stand-in for a slot that will not resolve — an older `@invana/styling`
 * without the palette, or a probe taken before the theme class is applied. A
 * token, so it still follows the theme.
 */
const FALLBACK_VAR = "--color-muted-foreground";

/** The palette slot a type name lands in. Same name, same slot, always. */
export function slotForType(type: string | undefined): number {
	if (!type) return 1;
	let h = 0;
	for (let i = 0; i < type.length; i++) h = (h * 31 + type.charCodeAt(i)) >>> 0;
	return (h % SLOTS) + 1;
}

/** Resolve a CSS custom property to a concrete `rgb(...)` the browser computed. */
function resolveVar(varName: string, fallbackVar?: string): string | undefined {
	if (typeof document === "undefined") return undefined;
	const probe = document.createElement("span");
	probe.style.color = fallbackVar
		? `var(${varName}, var(${fallbackVar}))`
		: `var(${varName})`;
	probe.style.display = "none";
	document.documentElement.appendChild(probe);
	const rgb = getComputedStyle(probe).color;
	probe.remove();
	return rgb || undefined;
}

/** The CSS colour for a type's dot: explicit style first, palette slot after. */
export function typeDotColor(type: string, explicit?: string): string {
	if (explicit) return explicit;
	return (
		resolveVar(`--color-data-${slotForType(type)}`, FALLBACK_VAR) ??
		`var(${FALLBACK_VAR})`
	);
}

/** The same colour as a PixiJS number, for the canvas. */
export function typeColorNumber(type: string, explicit?: string): number {
	const resolved = cssColorToNumber(typeDotColor(type, explicit));
	// `cssColorToNumber` parses hex + rgb; anything else (or no DOM) lands here.
	return resolved ?? 0x9ca3af;
}
