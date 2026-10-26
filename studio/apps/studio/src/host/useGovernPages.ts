import type { DeclaredKind, useLeftSection } from "@invana-studio/shell";
import { SECTION_PARAM, usePageParams } from "@invana-studio/shell";
import { useEffect, useRef } from "react";
import type { useOpenBoards } from "@/host/useOpenBoards";

/**
 * The Worlds, Guardrails, Requests and Rules pages — each opened when the `leftNav`
 * moves onto its item. It fires on the transition into the item and nothing
 * else, so closing the page with its X while the item is open leaves it
 * closed. A world's board, opened from the Worlds page, is a page of its own
 * and is not replaced by the Worlds page while it is focused.
 */
export function useGovernPages(
	graphSlug: string | undefined,
	settingsSection: ReturnType<typeof useLeftSection>["section"],
	openBoards: ReturnType<typeof useOpenBoards>,
) {
	const { openBoard } = openBoards;
	const [params] = usePageParams();
	const kind: DeclaredKind | null =
		settingsSection === "requests"
			? "requests"
			: settingsSection === "rules"
				? "rules"
				: settingsSection === "govern"
					? params.get(SECTION_PARAM) === "guardrails"
						? "guardrails"
						: "worlds"
					: null;
	// A link that lands on a world's board opens that board, not the page.
	const landsOnWorldBoard = (params.get("page") ?? "").startsWith("world:");
	const was = useRef<DeclaredKind | null>(null);
	useEffect(() => {
		if (
			graphSlug &&
			kind &&
			kind !== was.current &&
			!(was.current === null && landsOnWorldBoard)
		)
			openBoard({ kind, subjectId: graphSlug });
		was.current = kind;
	}, [kind, graphSlug, openBoard, landsOnWorldBoard]);
}
