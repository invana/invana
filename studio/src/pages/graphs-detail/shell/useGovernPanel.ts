import { useDrawerStack } from "@/pages/graphs-detail/shell/useDrawerStack";
import {
	LEGACY_PANEL_PARAM,
	PANEL_PARAM,
	STACK_PARAMS,
	TAB_PARAM,
} from "@/pages/graphs-detail/shell/useSettingsPanel";
import type { LensKind } from "@/types/govern";
import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

// **Govern** is one rail icon over a stack of two drawers
// (govern/spec.md GV17, graph-detail-page.md G32 · G33). A guardrail belongs
// beside the worlds it bounds, and the two are one record separated by `kind`
// (GV1) — so they are two drawers of one panel rather than two panels, and
// neither is a tab of Graph settings.
//
// **Worlds leads**, as the stack's rule says: the top drawer is the question a
// person arrives with, and they arrive at Govern to see which world a question
// can go under. The ceiling still reads first — it is the locked strip at the
// top of the Worlds drawer (W1 · W4), which states what the guardrails narrow
// without spending a drawer's height on one or two rows. The Guardrails drawer
// below it is where those rules are read in full (G1).
export type GovernDrawer = "worlds" | "guardrails";

export const GOVERN_DRAWERS: readonly GovernDrawer[] = ["worlds", "guardrails"];

// One key per drawer, named for the record rather than for the drawer, so a
// link says what it opens. Both name a `Lens` id — they are one table — but a
// guardrail and a world are never drilled into at the same time in the same
// key, because reading one is not reading the other.
const GOVERN_DETAIL_PARAM: Record<GovernDrawer, string> = {
	worlds: "world",
	guardrails: "guardrail",
};

/**
 * URL-backed state for the Govern panel's two drawers.
 *
 * - `drawer` — which drawer holds the height. Defaults to `worlds`.
 * - `guardrailId` · `worldId` — what is drilled into, per drawer.
 * - `focus(d)` — give a drawer the height.
 * - `openGuardrail` / `openWorld` — drill in; `null` goes back to the list.
 * - `reveal(kind, id)` — open the panel *on* this lens from anywhere.
 */
export function useGovernPanel() {
	const stack = useDrawerStack<GovernDrawer>({
		drawers: GOVERN_DRAWERS,
		detailParam: GOVERN_DETAIL_PARAM,
	});
	const [, setParams] = useSearchParams();

	// **`Edit` on a lens board, in one write** (WO16). The panel, the drawer and
	// the drill-in are three keys and one act, and writing them as two calls
	// would have the second read the URL as it was before the first — the panel
	// would open on the list rather than on the record `Edit` was pressed on.
	//
	// Every other stack's keys are dropped, exactly as a section change drops
	// them: a `&run=` left under the Govern icon names a drawer that is not on
	// screen. So is the sibling drill-in — a world and a guardrail are never
	// read at the same time.
	const reveal = useCallback(
		(kind: LensKind, id: string) => {
			const drawer: GovernDrawer =
				kind === "guardrail" ? "guardrails" : "worlds";
			const other: GovernDrawer = drawer === "worlds" ? "guardrails" : "worlds";
			setParams(
				(prev) => {
					const next = new URLSearchParams(prev);
					next.set(PANEL_PARAM, "govern");
					next.delete(LEGACY_PANEL_PARAM);
					next.delete(TAB_PARAM);
					for (const key of STACK_PARAMS) {
						if (key !== "drawer" && key !== "world" && key !== "guardrail") {
							next.delete(key);
						}
					}
					next.set("drawer", drawer);
					next.set(GOVERN_DETAIL_PARAM[drawer], id);
					next.delete(GOVERN_DETAIL_PARAM[other]);
					return next;
				},
				{ replace: true },
			);
		},
		[setParams],
	);

	const openGuardrail = useCallback(
		(id: string | null) => stack.open("guardrails", id),
		[stack.open],
	);
	const openWorld = useCallback(
		(id: string | null) => stack.open("worlds", id),
		[stack.open],
	);

	return {
		drawer: stack.drawer,
		focus: stack.focus,
		guardrailId: stack.detail.guardrails,
		worldId: stack.detail.worlds,
		openGuardrail,
		openWorld,
		reveal,
	};
}
