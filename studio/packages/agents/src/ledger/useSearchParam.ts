/**
 * One URL search param as state — By actor's `?actor=` and `?since=`, By
 * record's `?address=`. A change replaces the history entry, so a reload lands
 * on the same read and Back leaves the tab.
 */

import { useSearchParams } from "react-router-dom";

export function useSearchParam(key: string): [string, (value: string) => void] {
	const [search, setSearch] = useSearchParams();
	const set = (value: string) =>
		setSearch(
			(prev) => {
				const next = new URLSearchParams(prev);
				if (value) next.set(key, value);
				else next.delete(key);
				return next;
			},
			{ replace: true },
		);
	return [search.get(key) ?? "", set];
}
