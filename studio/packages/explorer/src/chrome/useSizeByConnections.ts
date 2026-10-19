/**
 * Whether the Explorer draws each node sized by its connection count: the
 * board toolbar's *Size by connections* toggle and the canvas's
 * `NodeCentralityBehaviour` read the same value.
 *
 * On by default, per visit, not in the URL — the flip holds until the page
 * reloads, the same lifetime as the *Tools* switch.
 */
import { useSyncExternalStore } from "react";

let on = true;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function useSizeByConnections(): [boolean, (next: boolean) => void] {
	const value = useSyncExternalStore(
		subscribe,
		() => on,
		() => true,
	);
	const set = (next: boolean) => {
		on = next;
		for (const l of listeners) l();
	};
	return [value, set];
}
