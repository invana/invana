import { useCallback, useEffect, useRef } from "react";
import { boardPageId } from "@/pages/graphs-detail/features/boards";
import { useModelsView } from "@/pages/graphs-detail/features/models";
import type { useLeftSection } from "@/pages/graphs-detail/shell/useLeftSection";
import type { useOpenBoards } from "@/pages/graphs-detail/shell/useOpenBoards";

/**
 * The Models page — opened when the `leftNav` switches to Models, and brought
 * forward by the Models panel. Returns the panel's view, which names the page's
 * tab, and `showModelsPage`, which the panel calls.
 */
export function useModelsPage(
	graphSlug: string | undefined,
	settingsSection: ReturnType<typeof useLeftSection>["section"],
	openBoards: ReturnType<typeof useOpenBoards>,
) {
	const { openBoard, setBoards, setActiveBoardId } = openBoards;

	/**
	 * **Models is one page** (the-model-page.md MP1 · MP18): switching the
	 * `leftNav` to Models opens the `models` board, whatever the scope. It fires
	 * on the transition into the panel and nothing else, so closing the page with
	 * its X while the panel is open leaves it closed — a page that reopened
	 * itself would be a page you cannot close.
	 */
	const modelsView = useModelsView().view;
	const openModelsPage = useCallback(() => {
		if (graphSlug) openBoard({ kind: "models", subjectId: graphSlug });
	}, [openBoard, graphSlug]);
	// The panel brings the board forward and names it in the URL in the same
	// write as the scope it picked, so this only touches the strip.
	const showModelsPage = useCallback((): Record<string, string | null> => {
		const id = graphSlug ? boardPageId("models", graphSlug) : null;
		if (!id || !graphSlug) return {};
		setBoards((open) =>
			open.some((b) => b.kind === "models" && b.subjectId === graphSlug)
				? open
				: [...open, { kind: "models", subjectId: graphSlug }],
		);
		setActiveBoardId(id);
		return { page: id, step: null };
	}, [graphSlug, setActiveBoardId, setBoards]);
	const wasModels = useRef(false);
	useEffect(() => {
		const isModels = settingsSection === "model";
		if (isModels && !wasModels.current) openModelsPage();
		wasModels.current = isModels;
	}, [settingsSection, openModelsPage]);

	return { modelsView, showModelsPage };
}
