/**
 * *Tools always shown* — the user menu's switch that keeps the Explorer's
 * manual tools on from the first paint, rather than off until *Tools* is
 * pressed.
 *
 * A per-browser convenience: it lives in `localStorage`, and when storage is
 * blocked the tools start off. Every read and write is guarded, because a
 * private window may throw on either. One small store, so the user menu and
 * the Explorer read the same value without a reload.
 */
import { useSyncExternalStore } from "react";

const KEY = "invana.studio.toolsAlwaysShown";
const listeners = new Set<() => void>();

function read(): boolean {
	try {
		return localStorage.getItem(KEY) === "1";
	} catch {
		return false;
	}
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

/** Whether the tools start on, and the setter the user menu calls. */
export function useToolsAlwaysShown(): [boolean, (on: boolean) => void] {
	const on = useSyncExternalStore(subscribe, read, () => false);
	const set = (next: boolean) => {
		try {
			localStorage.setItem(KEY, next ? "1" : "0");
		} catch {
			// Storage blocked — the switch holds for this render only.
		}
		for (const l of listeners) l();
	};
	return [on, set];
}
