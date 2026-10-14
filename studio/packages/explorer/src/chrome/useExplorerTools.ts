/**
 * Whether the Explorer's manual tools are on: the header's *Tools* switch
 * and the floating toolbar over the board read the same value.
 *
 * Per visit, not in the URL — a link never opens with tools on. Until the
 * switch is flipped it follows the user menu's *Tools always shown*; once it
 * is flipped, the flip holds until the page reloads.
 */
import { useToolsAlwaysShown } from "@invana-studio/shell";
import { useSyncExternalStore } from "react";

let flipped: boolean | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function useExplorerTools(): [boolean, (on: boolean) => void] {
	const [alwaysShown] = useToolsAlwaysShown();
	const override = useSyncExternalStore(
		subscribe,
		() => flipped,
		() => null,
	);
	const set = (on: boolean) => {
		flipped = on;
		for (const l of listeners) l();
	};
	return [override ?? alwaysShown, set];
}
