import { SETUP_STEPS } from "@/pages/graphs-detail/features/setup/setupSteps";
import {
	type Graph,
	SETUP_REQUIRED,
	SETUP_SKIPPABLE,
	type SetupSection,
	setupSectionStatus,
} from "@/types/graphs";
import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

// Which step the onboarding wizard is showing, carried in the URL so a step can
// be handed to a teammate (setup.md SU16). One param per axis of the page
// (graph-detail-page.md G16); this is the wizard's.
const STEP_PARAM = "step";

/** *What next* is the last thing in the rail, and it is not a step — it is the
 *  offers (SU4). It selects like one so the rail keeps one meaning: clicking a
 *  row changes what the pane beside it shows, and never does anything. */
export const WHAT_NEXT_KEY = "what-next" as const;

export type SetupStepKey = SetupSection | typeof WHAT_NEXT_KEY;

const ORDER: readonly SetupStepKey[] = [
	...SETUP_STEPS.map((m) => m.key),
	WHAT_NEXT_KEY,
];

/** The first step still to do: required before optional, in sequence order.
 *  Blocked steps are skipped over — landing on one would open a lesson whose
 *  action cannot run (SU12). */
function firstOutstanding(graph: Graph | undefined): SetupStepKey {
	const outstanding = (section: SetupSection) => {
		const state = graph?.setup_state?.[section];
		return setupSectionStatus(state) === "todo" && !state?.blocked_by;
	};
	return (
		SETUP_REQUIRED.find(outstanding) ??
		SETUP_SKIPPABLE.find(outstanding) ??
		ORDER[0]
	);
}

/**
 * URL-backed selection for the onboarding wizard.
 *
 * - `step`       — the selected step. `?step=` when it names a real one, and
 *                  the first outstanding step otherwise, so a fresh arrival
 *                  lands on the thing to do rather than on step one.
 * - `select(k)`  — writes `?step=k`.
 * - `next` · `previous` — move along the sequence. **Navigation, not a gate**
 *                  (SU16): every step stays selectable in any order, which is
 *                  what keeps this a page and not the modal wizard SU7 refuses.
 *
 * Selecting a step never *does* it. The lesson's primary action opens the panel
 * that owns the field, exactly as the rows always did (SU2).
 */
export function useSetupStep(graph: Graph | undefined) {
	const [params, setParams] = useSearchParams();

	const raw = params.get(STEP_PARAM) as SetupStepKey | null;
	const step = raw && ORDER.includes(raw) ? raw : firstOutstanding(graph);
	const index = ORDER.indexOf(step);

	const select = useCallback(
		(key: SetupStepKey) => {
			const next = new URLSearchParams(params);
			next.set(STEP_PARAM, key);
			setParams(next, { replace: true });
		},
		[params, setParams],
	);

	const go = useCallback(
		(delta: number) => {
			const target = ORDER[index + delta];
			if (target) select(target);
		},
		[index, select],
	);

	return {
		step,
		select,
		next: useCallback(() => go(1), [go]),
		previous: useCallback(() => go(-1), [go]),
		isFirst: index === 0,
		isLast: index === ORDER.length - 1,
	};
}
