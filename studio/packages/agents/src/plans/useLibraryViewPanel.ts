import { useStackSections } from "@invana-studio/shell";
import { useCallback } from "react";

// The **Library** panel is a stack of two sections, not a tabbed panel. Both
// are on screen at once; `?section=` names the one holding the column's
// height, and `&plan=` / `&template=` name the thing drilled into *inside* its
// own section — the other keeps its place, which is the whole reason the two
// are stacked rather than tabbed. A template renders what a plan produced.
//
// **Runs is not here.** The journal is its own panel and holds execution alone;
// this one holds the definitions a run is built from. Nothing here reads
// or writes `?panel=tasks` — it named a surface that no longer exists and is
// deleted, not redirected.
export type LibrarySectionKey = "plans" | "templates";

const LIBRARY_SECTION_KEYS: readonly LibrarySectionKey[] = [
	"plans",
	"templates",
];

const LIBRARY_DETAIL_PARAM: Record<LibrarySectionKey, string> = {
	plans: "plan",
	templates: "template",
};

/**
 * URL-backed state for the Library panel's two sections.
 *
 * - `sectionKey` — which section holds the height. Defaults to `plans`.
 * - `planKey` · `templateId` — what is drilled into, per section.
 * - `focus(d)` — give a section the height.
 * - `openPlan` / `openTemplate` — drill in; `null` goes back to
 *   the list.
 */
export function useLibraryViewPanel() {
	const stack = useStackSections<LibrarySectionKey>({
		sectionKeys: LIBRARY_SECTION_KEYS,
		detailParam: LIBRARY_DETAIL_PARAM,
	});

	const openPlan = useCallback(
		(key: string | null) => stack.open("plans", key),
		[stack.open],
	);
	const openTemplate = useCallback(
		(id: string | null) => stack.open("templates", id),
		[stack.open],
	);

	return {
		sectionKey: stack.sectionKey,
		focus: stack.focus,
		planKey: stack.detail.plans,
		templateId: stack.detail.templates,
		openPlan,
		openTemplate,
	};
}
