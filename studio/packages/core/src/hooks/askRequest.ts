/**
 * "Ask the assistant this" — asked from ⌘K, answered by the composer.
 *
 * The palette sits in the shell and the composer deep in whichever page is
 * open, so the question travels as a request rather than a callback. The
 * composer that mounts (or is already mounted) takes it: the text goes into
 * its input and the input is focused. It is never sent from here — the person
 * still picks the agent and the world before anything runs.
 *
 * It lives in core because the shell asks and the assistant answers, and
 * neither imports the other.
 *
 * In memory on purpose, like `useOpenSessionRequest` in the shell: a request
 * that survived a reload would put back a question the person had moved on
 * from. One module-level value and a set of listeners, read through
 * `useSyncExternalStore`.
 */

import { useCallback, useSyncExternalStore } from "react";

interface AskRequest {
	text: string;
	/** Bumped per ask, so asking the same thing twice is two events. */
	nonce: number;
}

let current: AskRequest | null = null;
let nonce = 0;
const listeners = new Set<() => void>();

function emit() {
	for (const l of listeners) l();
}

function subscribe(cb: () => void) {
	listeners.add(cb);
	return () => listeners.delete(cb);
}

/** Hand the composer a question to put in its input. Callable outside React. */
export function requestAsk(text: string) {
	nonce += 1;
	current = { text, nonce };
	emit();
}

/**
 * The composer's half: the latest request, or null once it has been taken.
 * The caller fills its input and calls `clear()`, so it happens once per ask.
 */
export function useAskRequest() {
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
