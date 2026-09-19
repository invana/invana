import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

// The wizard is the graph page's content while anything is outstanding (G26),
// so it needs no param to be *shown*. This one exists for the other half of
// SU19: re-opening it once the Graph is ready, from the graduation cap in
// `header.right`. It is the cap's only state.
const ONBOARDING_PARAM = "onboarding";

/**
 * Whether the onboarding wizard has been asked for, and how to ask.
 *
 * `open()` puts the wizard on the graph page and leaves it there until it is
 * closed — a reload keeps it, because it is in the URL, and a teammate sent the
 * link lands on the same thing. There is no per-user flag and no first-run
 * cookie: setup belongs to the Graph, not the person (SU14).
 */
export function useOnboarding() {
	const [params, setParams] = useSearchParams();
	const isOpen = params.get(ONBOARDING_PARAM) === "1";

	const open = useCallback(() => {
		const next = new URLSearchParams(params);
		next.set(ONBOARDING_PARAM, "1");
		setParams(next);
	}, [params, setParams]);

	const close = useCallback(() => {
		const next = new URLSearchParams(params);
		next.delete(ONBOARDING_PARAM);
		setParams(next);
	}, [params, setParams]);

	return { isOpen, open, close };
}
