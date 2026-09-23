import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * The world the next question is asked under — `?lens=<id>`.
 *
 * **It is the run's circumstances, not part of the question**
 * ([WO5](../../../../docs/for-developers/modules/govern/features/worlds.md)),
 * which is why it lives here and not in `QueryRunPayload`: the composer
 * collects a question, and a world is true of the whole surface whether or not
 * anybody is typing. It also has to be visible where there *is* no composer —
 * a run opened from a schedule has none.
 *
 * **`?lens=`, not `?world=`.** `world` is already the Govern drawer's drill-in
 * key and is dropped whenever `?panel=` moves (`useSettingsPanel`'s
 * `STACK_PARAMS`), which is right for *what am I reading* and exactly wrong for
 * *what am I asking under*. This one survives every panel change and every
 * reload, so a shared link reproduces the bound as well as the question.
 *
 * **Absent is a real value** and the default one: *Everything, inside the
 * guardrails* ([GV7](../../../../docs/for-developers/modules/govern/spec.md)).
 * Nothing here has a required field and no Graph is asked to pick.
 */
const LENS_PARAM = "lens";

export function useActiveWorld() {
	const [params, setParams] = useSearchParams();
	const lensId = params.get(LENS_PARAM);

	const setWorld = useCallback(
		(id: string | null) => {
			setParams(
				(prev) => {
					const next = new URLSearchParams(prev);
					if (id) next.set(LENS_PARAM, id);
					else next.delete(LENS_PARAM);
					return next;
				},
				{ replace: true },
			);
		},
		[setParams],
	);

	return { lensId, setWorld };
}
