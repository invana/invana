/**
 * Applies the appearance-store saturation multiplier to the active theme's
 * primary + accent colours (RFC-044 follow-up). Renders nothing; mount once
 * inside `<ThemeProvider>` (main.tsx), like `<ThemeSyncBridge>`.
 *
 * How it works — the theme system (`@invana/styling` `applyTheme`) sets a
 * `data-theme` attribute on `<html>`, and the `[data-theme="…"]` CSS rules supply
 * the colour custom properties. Each theme defines both a raw HSL triplet
 * (`--primary: 142 70% 43%`, for `hsl(var(--primary) / …)` opacity modifiers) and
 * an `hsl()`-wrapped mirror (`--color-primary: hsl(142 70% 43%)`, for `bg-primary`
 * tokens), so we override BOTH. We scale only the S channel of the HSL triplet.
 *
 * Inline custom properties on `<html>` beat the stylesheet's `[data-theme]` rules,
 * so we write the scaled values inline. To read the theme's *base* values (not our
 * own override) we clear the inline props first, then `getComputedStyle` — which
 * forces a synchronous recalc back to the `[data-theme]` rule.
 *
 * A `MutationObserver` on `data-theme` re-applies whenever the theme changes. This
 * is deliberately DOM-driven rather than React-effect-driven: `applyTheme` mutates
 * `data-theme` from a parent effect (which runs *after* this child's effect) and
 * also from an outside-React `matchMedia` listener on OS light/dark flips — the
 * observer catches all of those and always re-reads the now-current base.
 */

import { useEffect } from "react";
import { useAppearanceStore } from "../stores/appearance.store";

// Colours re-saturated: primary, its focus-ring mirror, and accent. Foregrounds
// (near-white/near-black text-on-colour) are intentionally left alone.
const TARGET_VARS = ["primary", "ring", "accent"] as const;

// Parse a CSS HSL triplet as authored in the theme vars: "H S% L%".
function parseHslTriplet(raw: string): [number, number, number] | null {
	const m = raw.trim().match(/^(-?[\d.]+)\s+(-?[\d.]+)%\s+(-?[\d.]+)%$/);
	if (!m) return null;
	return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function applySaturation(percent: number): void {
	const root = document.documentElement;
	// Clear any previous override so the reads below see the theme's base values.
	for (const name of TARGET_VARS) {
		root.style.removeProperty(`--${name}`);
		root.style.removeProperty(`--color-${name}`);
	}
	// 100% = the theme exactly as authored — leave it pristine (no inline props).
	if (percent === 100) return;

	const factor = percent / 100;
	const cs = getComputedStyle(root);
	for (const name of TARGET_VARS) {
		const parsed = parseHslTriplet(cs.getPropertyValue(`--${name}`));
		if (!parsed) continue;
		const [h, s, l] = parsed;
		const scaledS = Math.min(100, Math.max(0, s * factor));
		const triplet = `${h} ${Math.round(scaledS * 10) / 10}% ${l}%`;
		root.style.setProperty(`--${name}`, triplet);
		root.style.setProperty(`--color-${name}`, `hsl(${triplet})`);
	}
}

export function SaturationBridge() {
	const saturation = useAppearanceStore((s) => s.saturation);

	useEffect(() => {
		applySaturation(saturation);
		// Re-apply on every theme/mode change (React-driven or an OS light/dark flip
		// that mutates `data-theme` outside React). Our own writes touch the inline
		// `style` attribute, not `data-theme`, so they never retrigger this.
		const observer = new MutationObserver(() => applySaturation(saturation));
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["data-theme"],
		});
		return () => observer.disconnect();
	}, [saturation]);

	return null;
}
