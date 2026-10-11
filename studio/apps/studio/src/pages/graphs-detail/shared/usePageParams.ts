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
 * The setter is stable, and a functional update reads the params the previous
 * write produced, so two writes in one handler compose.
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
	const latest = useRef(params);
	latest.current = params;
	const rootRef = useRef(root);
	rootRef.current = root;

	const setParams = useCallback(
		(next: ParamsUpdate, options?: NavigateOptions) => {
			const value = typeof next === "function" ? next(latest.current) : next;
			latest.current = value;
			navigate(joinPageUrl(rootRef.current, pageUrlOf(value)), options);
		},
		[navigate],
	);

	return [params, setParams];
}
