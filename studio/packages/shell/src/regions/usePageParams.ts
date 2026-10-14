import { useCallback, useMemo, useRef } from "react";
import {
	type NavigateOptions,
	useLocation,
	useNavigate,
} from "react-router-dom";
import {
	joinPageUrl,
	pageParamsOf,
	pageUrlOf,
	splitGraphPath,
} from "./panelPaths";

type ParamsUpdate =
	| URLSearchParams
	| ((prev: URLSearchParams) => URLSearchParams);

// The URL the last write asked for, until its navigation settles.
let pending: string | null = null;

/** The page params of the newest URL: the pending write's, else the browser's. */
function latestParams(): URLSearchParams {
	const here = window.location.pathname + window.location.search;
	if (pending !== null && here === pending) pending = null;
	const url = new URL(pending ?? here, window.location.origin);
	return pageParamsOf(splitGraphPath(url.pathname)?.tail ?? "", url.search);
}

/**
 * `useSearchParams` for the graph page's panel state, which lives in the path.
 *
 * Reads the location as the params it stands for — `/agents/llms/<id>` reads
 * as `panel=agents&section=llms&provider=<id>` over the real query string —
 * and writes params back as a path plus the rest of the query string
 * (`panelPaths`). The hooks that own the panel, its stack sections and its
 * drill-ins use this; every other page param (`?page=`, `?right=`, `?tab=`)
 * keeps `useSearchParams`, whose writes leave the path alone.
 *
 * The setter is stable, and a functional update reads the newest URL — the one
 * the previous write produced while its navigation is still settling, else the
 * browser's own — never the params of this hook's last render. The router
 * commits a navigation as a transition, so an urgent render can run on the
 * old location: building on it would drop a param another region just wrote
 * (`?right=assistant`, docked as an ask opens its session). Two writes in one
 * handler compose the same way.
 */
export function usePageParams(): [
	URLSearchParams,
	(next: ParamsUpdate, options?: NavigateOptions) => void,
] {
	const { pathname, search } = useLocation();
	const navigate = useNavigate();
	const split = splitGraphPath(pathname);
	const root = split?.root ?? pathname;
	const tail = split?.tail ?? "";

	const params = useMemo(() => pageParamsOf(tail, search), [tail, search]);
	const rootRef = useRef(root);
	rootRef.current = root;

	const setParams = useCallback(
		(next: ParamsUpdate, options?: NavigateOptions) => {
			const value = typeof next === "function" ? next(latestParams()) : next;
			const url = joinPageUrl(rootRef.current, pageUrlOf(value));
			pending = url;
			navigate(url, options);
			// A navigation that never settles (superseded, redirected) stops
			// shadowing the browser's URL after one task.
			setTimeout(() => {
				if (pending === url) pending = null;
			}, 0);
		},
		[navigate],
	);

	return [params, setParams];
}
