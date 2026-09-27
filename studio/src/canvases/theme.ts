// Live theme → canvas colours (docs/for-developers/modules/platform/features/theming.md).
//
// Studio's canvases can't use Tailwind classes (they paint to a
// PixiJS surface), so their background / node / edge / minimap colours have to
// be pushed to the engine as concrete values. Rather than hardcode one palette,
// we read the *active* theme's CSS tokens at runtime — so switching theme (or
// mode) retints the canvas to match, instead of every dark theme sharing one
// grey. Every studio theme (`default` / `tailwind` / `vite` and the presets)
// defines this standard token set, so the mapping works uniformly.
//
// `<ThemeBridge>` in ExplorerCanvas calls `readCanvasThemeConfig()`
// whenever the theme variant changes and feeds the result to `update()`. The
// model and task-flow canvases paint their own nodes and edges, so they take
// Studio's whole palette, through `useStudioCanvasTheme`.

import type { CanvasProps } from "@invana/canvas-react";
import { type GraphCanvas, cssColorToNumber } from "@invana/graph";
import { useTheme } from "@invana/themes";
import { useEffect } from "react";

// `CanvasConfig` isn't re-exported by canvas-react — derive it from `<Board config>`.
type CanvasConfig = NonNullable<CanvasProps["config"]>;

// Fallbacks (the `default-dark` grey/green tokens) used only if a var can't be
// resolved — e.g. during SSR or before the theme class is applied.
const FALLBACK = {
	background: 0x181a1b,
	grid: 0x35383b,
	foreground: 0xd9d9d9,
	edge: 0x646b73,
	card: 0x222425,
	border: 0x35383b,
	primary: 0x52e086,
} as const;

// Resolve a `var(--token)` to a concrete `rgb(...)` string by letting the
// browser compute it against `document.documentElement` (where the theme class
// lives). This normalises hsl / hex / oklch / named colours in one shot —
// `cssColorToNumber` only parses hex + rgb, and the tokens are authored as hsl.
function resolveVar(varName: string): string | undefined {
	if (typeof document === "undefined") return undefined;
	const probe = document.createElement("span");
	probe.style.color = `var(${varName})`;
	probe.style.display = "none";
	document.documentElement.appendChild(probe);
	const rgb = getComputedStyle(probe).color;
	probe.remove();
	return rgb || undefined;
}

function num(varName: string, fallback: number): number {
	return cssColorToNumber(resolveVar(varName)) ?? fallback;
}

/**
 * Build a canvas colour patch from the currently-applied theme's CSS tokens.
 * Call it after the theme class is on `document.documentElement` (see the
 * `requestAnimationFrame` in the canvases' `<ThemeBridge>`).
 *
 * `edgeColor: false` leaves edge colour out, for a canvas that colours each
 * relationship by its type — a flat theme colour pushed here would paint over it.
 */
export function readCanvasThemeConfig({
	edgeColor = true,
}: { edgeColor?: boolean } = {}): CanvasConfig {
	// Background is a CSS string on the layer; the rest are PixiJS numbers.
	const background = resolveVar("--color-background") ?? "#181a1b";
	const grid = resolveVar("--color-border") ?? "#35383b";
	const foreground = num("--color-foreground", FALLBACK.foreground);
	const bg = num("--color-background", FALLBACK.background);
	const edge = num("--color-muted-foreground", FALLBACK.edge);
	const primary = num("--color-primary", FALLBACK.primary);
	return {
		layers: {
			background: { backgroundColor: background, color: grid },
			graph: {
				node: { style: { labelColor: foreground, bgStrokeColor: bg } },
				...(edgeColor
					? { edge: { style: { strokeColor: edge, arrowTargetColor: edge } } }
					: {}),
			},
			minimap: {
				backgroundColor: num("--color-card", FALLBACK.card),
				borderColor: num("--color-border", FALLBACK.border),
				// The active theme's accent for the viewport indicator (fill is drawn
				// translucent by `viewportFillAlpha`; stroke shares the same hue).
				viewportFill: primary,
				viewportStroke: primary,
			},
		},
	};
}

/**
 * Studio's theme as a canvas palette: every role the canvas paints with —
 * backdrop, card, text, hairline, ring and the categorical ramp — read from the
 * live tokens, so nothing on the canvas keeps its own library's colours.
 */
function readStudioPalette() {
	const data = [1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
		num(`--color-data-${n}`, FALLBACK.primary),
	);
	return {
		surface: num("--color-background", FALLBACK.background),
		cardBg: num("--color-card", FALLBACK.card),
		foreground: num("--color-foreground", FALLBACK.foreground),
		heading: num("--color-card-foreground", FALLBACK.foreground),
		muted: num("--color-muted-foreground", FALLBACK.edge),
		accent: num("--color-primary", FALLBACK.primary),
		divider: num("--color-border", FALLBACK.border),
		stroke: num("--color-input", FALLBACK.border),
		selectionRing: num("--color-ring", FALLBACK.primary),
		hoverRing: num("--color-primary", FALLBACK.primary),
		categorical: data,
	};
}

/**
 * Keeps a canvas on Studio's theme: its `ThemeBehaviour` (id `theme`) is handed
 * one theme, `studio`, whose palette is the live tokens, and the resolved kind.
 * It stands in for `CanvasThemeSync`, which would pick the canvas library's
 * palette for the family instead. `variantId` changes on any theme/mode switch
 * and `isDark` catches an OS flip under a `*-system` variant; the read waits a
 * frame for the theme class to land on `<html>`.
 */
export function useStudioCanvasTheme(canvas: GraphCanvas | null) {
	const { variantId, isDark } = useTheme();
	// biome-ignore lint/correctness/useExhaustiveDependencies: variantId is trigger-only — the read is of the live DOM tokens
	useEffect(() => {
		if (!canvas) return;
		const id = requestAnimationFrame(() => {
			const palette = readStudioPalette();
			canvas.update({
				behaviours: {
					theme: {
						themes: {
							studio: { name: "studio", light: palette, dark: palette },
						},
						active: "studio",
						mode: isDark ? "dark" : "light",
					},
				},
			});
		});
		return () => cancelAnimationFrame(id);
	}, [canvas, variantId, isDark]);
}
