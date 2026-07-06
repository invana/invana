/**
 * Client-side appearance tweaks layered on top of the RFC-044 theme selection.
 *
 * Currently just a single **saturation** multiplier applied to the active theme's
 * primary + accent colours (see `SaturationBridge`). Unlike the theme selection —
 * which `ThemeSyncBridge` persists to the user's profile — this is stored locally
 * only; it's a per-device visual preference and needs no engine round-trip. If it
 * ever needs to follow the user across devices, fold `saturation` into the
 * `/auth/me` `preferences.theme` bag alongside `{theme, mode, accent}`.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

// Saturation is a percentage multiplier on the theme's own saturation: 100 = the
// theme exactly as authored, 0 = fully greyed, 200 = twice as saturated (clamped
// at the HSL ceiling of 100%). Kept as a plain number so the slider binds directly.
export const SATURATION_DEFAULT = 100;
export const SATURATION_MIN = 0;
export const SATURATION_MAX = 200;

interface AppearanceState {
	saturation: number;
	setSaturation: (value: number) => void;
	reset: () => void;
}

const STORAGE_KEY = "invana.appearance";

export const useAppearanceStore = create<AppearanceState>()(
	persist(
		(set) => ({
			saturation: SATURATION_DEFAULT,
			setSaturation: (value) =>
				set({
					saturation: Math.min(
						SATURATION_MAX,
						Math.max(SATURATION_MIN, Math.round(value)),
					),
				}),
			reset: () => set({ saturation: SATURATION_DEFAULT }),
		}),
		{ name: STORAGE_KEY },
	),
);
