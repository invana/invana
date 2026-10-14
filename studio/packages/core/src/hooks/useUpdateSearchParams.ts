/**
 * Query-string writes that compose — two regions writing their own param in
 * quick succession both land.
 *
 * `useSearchParams`' functional setter hands back the params of the hook's
 * last *render*, not of the last write. The router commits a navigation as a
 * transition, so a second write that lands before that render — opening the
 * console on Log a beat after the assistant docked on the right — builds on
 * the old query string and drops the first write's param.
 *
 * This writer builds on the newest query string instead: the one the previous
 * write produced while its navigation is still settling, else the browser's
 * own. Every page param that sits in the query string (`?right=`,
 * `?console=`) writes through it, so each region keeps the others' params.
 */

import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

// The query string the last write asked for, until its navigation settles.
let pending: string | null = null;

function latestSearch(): URLSearchParams {
	if (pending !== null && window.location.search === pending) pending = null;
	return new URLSearchParams(pending ?? window.location.search);
}

/** Update the query string from its newest value; the path is untouched. */
export function useUpdateSearchParams() {
	const navigate = useNavigate();
	return useCallback(
		(update: (prev: URLSearchParams) => URLSearchParams) => {
			const next = update(latestSearch()).toString();
			const search = next ? `?${next}` : "";
			pending = search;
			navigate(search || "?", { replace: true });
			// A navigation that never settles (superseded, redirected) stops
			// shadowing the browser's query string after one task.
			setTimeout(() => {
				if (pending === search) pending = null;
			}, 0);
		},
		[navigate],
	);
}
