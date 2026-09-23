/**
 * A clock, for the surfaces that draw a duration that is still running.
 *
 * A live elapsed has to move on its own — the run does not emit a tick and the
 * list does not refetch every second — so anything drawing one holds this and
 * re-renders once a second. It is `active`-gated on purpose: a list with
 * nothing running must not keep a timer alive.
 */

import { useEffect, useState } from "react";

/** Ticks once a second while `active`, so live durations move. */
export function useTicker(active: boolean): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!active) return;
		setNow(Date.now());
		const id = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(id);
	}, [active]);
	return now;
}
