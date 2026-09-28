import {
	DECLARED_KINDS,
	type DeclaredKind,
	type OpenBoard,
	type RecordBoardKind,
	boardPageId,
	parseBoardPageId,
} from "@/pages/graphs-detail/features/boards";
import type { LensKind } from "@/pages/graphs-detail/features/lenses/types";
import { runsApi } from "@/pages/graphs-detail/features/runs/api";
import { useBoardPage } from "@/pages/graphs-detail/shell/useBoardPage";
import { useLibraryViewPanel } from "@/pages/graphs-detail/shell/useLibraryViewPanel";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The declared boards open in `mainSection`, and which one is in front.
 *
 * A board is a page like any other, keyed `<kind>:<subject_id>`, and `?page=`
 * names the focused one — so a cold link or a reload reopens it here, once, on
 * the way in. `openBoard` is the one writer: it adds or replaces the board,
 * focuses it and writes the URL. `newestPlanIdByKey` lets the plan page follow
 * the Library's `&plan=`, which names a plan by key.
 */
export function useOpenBoards(
	username: string | undefined,
	graphSlug: string | undefined,
	newestPlanIdByKey: Map<string, { id: string; version: number }>,
) {
	const libraryPlanKey = useLibraryViewPanel().planKey;
	// The **declared** boards that are open — a run dashboard, and a step's
	// (see-what-ran.md SR36). They are pages like any other, keyed
	// `<kind>:<subject_id>`, so the tab strip carries them beside the canvases
	// and `More` opens one rather than growing the section (SR13 · CV14).
	const [boards, setBoards] = useState<OpenBoard[]>([]);
	const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
	// `?page=` — the focused declared board, so a link and a reload both land on
	// it (B12). Without it a saved report is unreachable the moment the tab
	// closes, and B6's criterion is *reopening it an hour later*.
	const boardPage = useBoardPage();
	const { setPageId } = boardPage;

	// Reopen what the URL names, once, on the way in. `openBoard` below is what
	// writes the key, so this only ever runs for a page nothing has opened yet —
	// a cold link, or a reload.
	//
	// `runId` is not in a page id, and the two trace-reading kinds need one. A
	// run is the subject of itself. A **step** is not: it names the run it is
	// in on its own row, so a cold open reads it rather than carrying it in the
	// id, which would put a fetched fact inside an identity (SR44). A **frozen**
	// page needs none at all, because the blob is the document.
	const restored = useRef(false);
	useEffect(() => {
		if (restored.current) return;
		const id = boardPage.pageId;
		if (!id) return;
		const page = parseBoardPageId(id);
		if (!page || !(page.kind in DECLARED_KINDS)) return;
		restored.current = true;
		// A live step board is the one page that cannot be drawn from its id
		// alone. The tab opens now and says it is loading; the read below fills
		// in the run, or leaves it absent for B17 to refuse honestly.
		const coldStep = page.kind === "task_run" && !page.versionId;
		setBoards((open) =>
			open.some((b) => b.kind === page.kind && b.subjectId === page.id)
				? open
				: [
						...open,
						{
							kind: page.kind as DeclaredKind,
							subjectId: page.id,
							versionId: page.versionId,
							runId: page.kind === "run" ? page.id : undefined,
							resolvingRun: coldStep,
						},
					],
		);
		setActiveBoardId(id);
		if (!coldStep) return;
		// `task_runs` is one table, so the step's own row answers this (SR44).
		// A step is not a page any more (SR72): once its run is known, the tab
		// becomes the run's and the step opens inside it, in one URL write.
		void runsApi
			.get(username as string, graphSlug as string, page.id)
			.then((step) => {
				const runId = step.parentRunId;
				if (!runId) throw new Error("no run");
				const runPage = boardPageId("run", runId);
				setBoards((open) => [
					...open.filter(
						(b) =>
							!(b.kind === "task_run" && b.subjectId === page.id) &&
							!(b.kind === "run" && b.subjectId === runId),
					),
					{ kind: "run", subjectId: runId, runId },
				]);
				setActiveBoardId(runPage);
				setPageId(runPage, { step: page.id });
			})
			.catch(() =>
				// The step is gone, or its run is. Clearing the flag hands the page
				// back to B17's refusal, which is what "no run to read" looks like.
				setBoards((open) =>
					open.map((b) =>
						b.kind === "task_run" && b.subjectId === page.id
							? { ...b, resolvingRun: false }
							: b,
					),
				),
			);
	}, [boardPage.pageId, username, graphSlug, setPageId]);

	// Opening a board focuses it, the way opening a canvas focuses that tab.
	//
	// **Identity is the pair, not the subject.** `skill:abc` and
	// `skill_usage:abc` name one skill and are two pages (SD2), so a board is
	// already open only when its *kind* and its subject both match — keying on
	// the subject alone made opening the second one a silent no-op.
	const openBoard = useCallback(
		(board: OpenBoard) => {
			const id = boardPageId(board.kind, board.subjectId, board.versionId);
			// Saving a report replaces the live page with the frozen one rather than
			// opening a second tab of the same board: it is the same reading, kept.
			setBoards((open) =>
				open.some(
					(b) => b.kind === board.kind && b.subjectId === board.subjectId,
				)
					? open.map((b) =>
							b.kind === board.kind && b.subjectId === board.subjectId
								? board
								: b,
						)
					: [...open, board],
			);
			setActiveBoardId(id);
			// The focused page is what the URL names, so a report saved now is a
			// link that still opens it later (B12). A step rides with its run
			// page, and opening any other page closes it (SR72).
			setPageId(id, { step: board.stepId ?? null });
		},
		[setPageId],
	);
	// What `OpenBoardContext` publishes — a record's board, opened from wherever
	// a link to one is drawn (RU13). Narrower than `openBoard` on purpose: these
	// three kinds bind to a record and read no trace, so there is no `runId` to
	// forget (SD3).
	// **Picking a plan opens its page** (G42 · LB24). The Plans section names
	// what it drilled into in the URL, so the page follows `&plan=`. Only ever
	// *opens*: going back to the list clears `&plan=` and leaves the page where
	// it is — a panel opens a page and never closes one.
	const libraryPlanId = libraryPlanKey
		? newestPlanIdByKey.get(libraryPlanKey)?.id
		: undefined;
	// Once per pick, not per render: `openBoard` is new on every URL write, so
	// keyed on it alone this would pull the plan page back to the front each
	// time a page it opened — a run — took focus.
	const openedPlanId = useRef<string | undefined>(undefined);
	useEffect(() => {
		if (openedPlanId.current === libraryPlanId) return;
		openedPlanId.current = libraryPlanId;
		if (libraryPlanId)
			openBoard({ kind: "plan_runs", subjectId: libraryPlanId });
	}, [libraryPlanId, openBoard]);

	const openRecordBoard = useCallback(
		(kind: RecordBoardKind, subjectId: string) =>
			openBoard({ kind, subjectId }),
		[openBoard],
	);

	// Govern's drill-in opens the lens as a page (WO15 · GR14). **Stable**, and
	// it has to be: the panel opens the board from an effect — the drill-in and
	// the page id are two keys of one URL, and the second write has to be
	// composed against the first — so a new identity each render would reopen
	// the board on every render.
	const openLensBoard = useCallback(
		(kind: LensKind, lensId: string) => openBoard({ kind, subjectId: lensId }),
		[openBoard],
	);

	return {
		boards,
		setBoards,
		activeBoardId,
		setActiveBoardId,
		boardPage,
		setPageId,
		openBoard,
		openRecordBoard,
		openLensBoard,
	};
}
