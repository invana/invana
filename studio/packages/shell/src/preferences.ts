/**
 * The person's own switches from the user menu — per browser, not per
 * account:
 *
 * | Switch | Default | Means |
 * |---|---|---|
 * | *Assistant* | on | Off hides the assistant in every product: the header's button, the docked chat, its reopen pill, ⌘K's *Ask the assistant* and the Explorer's question box |
 * | *Tools always shown* | off | On starts the Explorer's manual tools on, rather than off until *Tools* is pressed |
 *
 * They live in `localStorage`; when storage is blocked each falls back to its
 * default. Every read and write is guarded, because a private window may
 * throw on either. One small store per switch, so the user menu and the
 * surfaces that read it agree without a reload.
 */
import { useSyncExternalStore } from "react";

function preference(key: string, fallback: boolean) {
	const listeners = new Set<() => void>();
	const read = (): boolean => {
		try {
			const raw = localStorage.getItem(key);
			return raw === null ? fallback : raw === "1";
		} catch {
			return fallback;
		}
	};
	const subscribe = (listener: () => void) => {
		listeners.add(listener);
		return () => listeners.delete(listener);
	};
	const set = (next: boolean) => {
		try {
			localStorage.setItem(key, next ? "1" : "0");
		} catch {
			// Storage blocked — the switch holds for this render only.
		}
		for (const l of listeners) l();
	};
	return (): [boolean, (on: boolean) => void] => [
		useSyncExternalStore(subscribe, read, () => fallback),
		set,
	];
}

/** Whether the assistant is shown anywhere, and the user menu's setter. */
export const useAssistantShown = preference(
	"invana.studio.assistantShown",
	true,
);

/** Whether the Explorer's tools start on, and the user menu's setter. */
export const useToolsAlwaysShown = preference(
	"invana.studio.toolsAlwaysShown",
	false,
);
