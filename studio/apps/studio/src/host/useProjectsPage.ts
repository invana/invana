import { useProjectsViewPanel, useProjectTrail } from "@invana-studio/projects";
import type { useLeftSection } from "@invana-studio/shell";
import { boardPageId } from "@invana-studio/shell";
import { useCallback, useEffect, useRef } from "react";
import type { useOpenBoards } from "@/host/useOpenBoards";

/** The project page's own keys — its tab and what it is drilled into. */
const PROJECT_VIEW = {
	view: null,
	branch: null,
	finding: null,
	decision: null,
} as const;

/** `project:` — a project page's id, before its key. */
const PROJECT_PAGE = boardPageId("project", "");

/**
 * A project's page and the Decisions page — the two Projects pages
 * `mainSection` draws (projects.md).
 *
 * - **A project** opens as `project:<key>` when the Projects stack drills into
 *   it, a cold landing on `/projects/<key>` included. Moving to another project
 *   starts the page on its Overview: the tab and the drill-in belong to the
 *   project they were opened on.
 * - **Decisions** opens as `decisions:<graph>` on the transition into the
 *   rail's Decisions, like the Models page, so closing it while the rail stays
 *   there leaves it closed.
 *
 * Returns `openProjectPage`, which a decision row calls to open its project on
 * the branch it decided, and `pageTrail`, the header's levels while a
 * project's page is focused.
 */
export function useProjectsPage(
	username: string | undefined,
	graphSlug: string | undefined,
	settingsSection: ReturnType<typeof useLeftSection>["section"],
	openBoards: ReturnType<typeof useOpenBoards>,
) {
	const { openBoard, setBoards, setActiveBoardId, boardPage } = openBoards;
	const { setPageId, pageId } = boardPage;

	const openProjectPage = useCallback(
		(key: string, branch: number | null = null) => {
			const id = boardPageId("project", key);
			setBoards((open) =>
				open.some((b) => b.kind === "project" && b.subjectId === key)
					? open
					: [...open, { kind: "project", subjectId: key }],
			);
			setActiveBoardId(id);
			setPageId(id, {
				step: null,
				...PROJECT_VIEW,
				branch: branch ? String(branch) : null,
			});
		},
		[setActiveBoardId, setBoards, setPageId],
	);

	// The stack's drill-in. A link that already names this project's page keeps
	// its tab: the restore in `useOpenBoards` has put the page back.
	const { projectKey } = useProjectsViewPanel();
	const drilled = settingsSection === "projects" ? projectKey : null;
	const wasDrilled = useRef<string | null>(null);
	useEffect(() => {
		if (drilled && drilled !== wasDrilled.current) {
			if (pageId !== boardPageId("project", drilled)) openProjectPage(drilled);
		}
		wasDrilled.current = drilled;
	}, [drilled, pageId, openProjectPage]);

	const onDecisions = settingsSection === "decisions";
	const wasOnDecisions = useRef(false);
	useEffect(() => {
		if (onDecisions && !wasOnDecisions.current && graphSlug)
			openBoard({ kind: "decisions", subjectId: graphSlug });
		wasOnDecisions.current = onDecisions;
	}, [onDecisions, graphSlug, openBoard]);

	const focusedKey = pageId?.startsWith(PROJECT_PAGE)
		? pageId.slice(PROJECT_PAGE.length)
		: null;
	const pageTrail = useProjectTrail(username, graphSlug, focusedKey);

	return { openProjectPage, pageTrail };
}
