import { useCallback } from "react";
import { useStackSections } from "@/pages/graphs-detail/shell/useStackSections";

// The **Library** panel is a stack of three sections, not a tabbed panel
// (graph-detail-page.md G33 · G41). All three are on screen at once; `?section=`
// names the one holding the column's height, and `&plan=` / `&entry=` /
// `&template=` name the thing drilled into *inside* its own section — the other
// two keep their place, which is the whole reason the three are stacked rather
// than tabbed.
//
// Read it as one sentence going down the column: a plan is a composition of
// catalogue entries, and a template renders what the plan produced. Each section
// is the definition of the one above it (§3a).
//
// **Runs is not here.** The journal is its own panel and holds execution alone
// (G41); this one holds the definitions a run is built from. Nothing here reads
// or writes `?panel=tasks` — it named a surface that no longer exists and is
// deleted, not redirected (G31).
export type LibrarySectionKey = "plans" | "catalogue" | "templates";

export const LIBRARY_SECTION_KEYS: readonly LibrarySectionKey[] = [
	"plans",
	"catalogue",
	"templates",
];

const LIBRARY_DETAIL_PARAM: Record<LibrarySectionKey, string> = {
	plans: "plan",
	catalogue: "entry",
	templates: "template",
};

/**
 * URL-backed state for the Library panel's three sections.
 *
 * - `sectionKey` — which section holds the height. Defaults to `plans`.
 * - `planKey` · `entryKey` · `templateId` — what is drilled into, per section.
 * - `focus(d)` — give a section the height.
 * - `openPlan` / `openEntry` / `openTemplate` — drill in; `null` goes back to
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
	const openEntry = useCallback(
		(key: string | null) => stack.open("catalogue", key),
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
		entryKey: stack.detail.catalogue,
		templateId: stack.detail.templates,
		openPlan,
		openEntry,
		openTemplate,
	};
}
