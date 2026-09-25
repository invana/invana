import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

// `&step=` — the task open inside the focused run page (SR72). It rides beside
// `?page=run:<id>` rather than inside it: the page is the run, and a step is a
// reading of it, so a reload lands on the step and the tab strip keeps one tab.
const STEP_PARAM = "step";

/**
 * URL-backed state for the step open inside a run page.
 *
 * - `stepId` — the step, or null for the run itself.
 * - `openStep(id)` — open a step; `null` returns to the run.
 */
export function useRunStep() {
	const [params, setParams] = useSearchParams();
	const stepId = params.get(STEP_PARAM);

	// The functional form, so the writer is stable across renders.
	const openStep = useCallback(
		(id: string | null) => {
			setParams((prev) => {
				const next = new URLSearchParams(prev);
				if (id) next.set(STEP_PARAM, id);
				else next.delete(STEP_PARAM);
				return next;
			});
		},
		[setParams],
	);

	return useMemo(() => ({ stepId, openStep }), [stepId, openStep]);
}
