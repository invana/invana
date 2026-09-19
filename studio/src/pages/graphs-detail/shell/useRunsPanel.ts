import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

// **Runs takes no `?drawer=`** — it is a list, not a stack (graph-detail-page.md
// G31 · G33). One journal of every TaskRun in the Graph, and the definitions a
// run is built from live in **Library** (G41), so there is no second list here
// for `?drawer=` to choose between.
//
// `&run=` is the one key it carries: the run whose detail replaces the panel
// body, turning the header into `‹ RUNS / orders.csv`. It is dropped whenever
// `?panel=` moves to a section that does not own it, in `useSettingsPanel` — a
// run left in the URL under a different rail icon names a body that is not on
// screen (G35).

const RUN_PARAM = "run";

/**
 * URL-backed state for the Runs panel.
 *
 * - `runId` — the run whose detail replaces the list, or null.
 * - `openRun(id)` — drill in; `null` goes back to the journal.
 */
export function useRunsPanel() {
	const [params, setParams] = useSearchParams();
	const runId = params.get(RUN_PARAM);

	// The functional form of `setParams`, so the writer is **stable across
	// renders**: it is handed to the journal body as a callback, and a writer
	// that changed identity every render would re-fire every effect depending on
	// it on every keystroke.
	const openRun = useCallback(
		(id: string | null) => {
			setParams(
				(prev) => {
					const next = new URLSearchParams(prev);
					if (id) next.set(RUN_PARAM, id);
					else next.delete(RUN_PARAM);
					return next;
				},
				{ replace: true },
			);
		},
		[setParams],
	);

	return useMemo(() => ({ runId, openRun }), [runId, openRun]);
}
