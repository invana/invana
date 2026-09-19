/**
 * "Open this session" — asked from a panel, answered by the page.
 *
 * A session row in the graph info panel has to do exactly what the same row in
 * the assistant's own list does: make that session active and give the right
 * side to the assistant (graph-detail-page.md G22). The panel cannot call
 * `handleOpenSession` — `SettingsPanel` is rendered by the *shell*, which knows
 * nothing of the page's session state — so the request travels instead of the
 * callback.
 *
 * It is a request, not state: nothing reads "which session was last asked for",
 * and a second ask for the same id is a second open. That is why this is a
 * counter and a payload rather than a store — and why it is deliberately
 * in-memory, unlike the region params. Asking again after a reload would reopen
 * a session the user had closed.
 *
 * Same shape `useSettingsPanel` uses for `expanded`: one module-level value and
 * a set of listeners, read through `useSyncExternalStore`.
 */

import { useCallback, useSyncExternalStore } from "react";

interface Request {
	sessionId: string;
	/** Bumped per ask, so two asks for one session are two events. */
	nonce: number;
}

let current: Request | null = null;
let nonce = 0;
const listeners = new Set<() => void>();

function emit() {
	for (const l of listeners) l();
}

function subscribe(cb: () => void) {
	listeners.add(cb);
	return () => listeners.delete(cb);
}

/** Ask the page to open a session. Callable outside React. */
export function requestOpenSession(sessionId: string) {
	nonce += 1;
	current = { sessionId, nonce };
	emit();
}

/**
 * The page's half: the latest request, or null once it has been taken.
 *
 * The caller acts on it and calls `clear()`, so an open happens once per ask
 * rather than on every render that follows it.
 */
export function useOpenSessionRequest() {
	const request = useSyncExternalStore(
		subscribe,
		() => current,
		() => null,
	);
	const clear = useCallback(() => {
		if (current === null) return;
		current = null;
		emit();
	}, []);
	return { request, clear };
}
