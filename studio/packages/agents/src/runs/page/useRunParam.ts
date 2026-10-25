/**
 * One URL param of the run page — `tab`, `view`, `lane`, `rerun` — read from
 * the URL while this run is the page in front (`?page=run:<id>`), and kept in
 * the page's own state otherwise, so a run open in a background tab never
 * writes over the one in front. A reload lands where the reader was.
 */

import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";

export function useRunParam(
	runId: string,
	name: string,
): [string | null, (value: string | null) => void] {
	const [params, setParams] = useSearchParams();
	const [local, setLocal] = useState<string | null>(null);
	const inFront = params.get("page") === `run:${runId}`;
	const value = inFront ? params.get(name) : local;
	const set = useCallback(
		(next: string | null) => {
			setLocal(next);
			if (!inFront) return;
			setParams(
				(prev) => {
					const out = new URLSearchParams(prev);
					if (next) out.set(name, next);
					else out.delete(name);
					return out;
				},
				{ replace: true },
			);
		},
		[inFront, name, setParams],
	);
	return [value, set];
}
