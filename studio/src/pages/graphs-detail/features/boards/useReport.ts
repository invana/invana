/**
 * The two acts a declared board carries — `Save report` and `Reports`
 * ([B6 · B21](../../../../../docs/for-developers/building-engine/boards-migration.md)).
 *
 * A live dashboard reads its subject on every open, so a finished run's numbers
 * are only *probably* stable and a running one's are not stable at all. Keeping
 * a reading writes the **resolved document** — the spec with the numbers
 * already in it — as a `board_versions` row, and the page becomes
 * `kind:{subjectId}@{versionId}` ([B13](../../../../../docs/for-developers/building-engine/boards-migration.md)).
 *
 * **The host owns which board this is, not the page.** Every declared page is
 * mounted by `declaredBoardContent` inside `<DeclaredBoard>`, so a composer
 * stays a pure function of one read and a page gains the act by calling
 * `useReport(spec)` — no `kind`, no `subjectId` and no `onSaved` threaded
 * through six components that have no use for them.
 *
 * What is saved is the composed document, **without** the buttons this hook
 * adds: a report that offered to save a report of itself would be a reading
 * that is not a reading of its subject.
 *
 * `Reports` is the other half of the same pair — *keep this reading*, and
 * *find a kept one* — and it sits beside `Save report` on the dashboard's own
 * header rather than on the strip, which stays as narrow as it was (B21). The
 * card it opens is drawn by `DeclaredBoard`, because a hook cannot draw.
 */

import { boardReportsKey } from "@/hooks/queries/useBoardVersions";
import { boardReportsApi } from "@/services/api/boardReports";
import type { DashboardSpec, ExtraPanels } from "@invana/dashboard";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext } from "react";
import { toast } from "sonner";

/** The two action ids a declared board's header carries. */
export const SAVE_REPORT_ACTION = "save-report";
export const OPEN_REPORTS_ACTION = "open-reports";

export interface DeclaredBoardValue {
	username: string;
	graphSlug: string;
	kind: string;
	subjectId: string;
	/** The page became `kind:id@version` — the host swaps the open board. */
	onSaved: (versionId: string) => void;
	/** Show every reading kept of this board — the card `DeclaredBoard` draws. */
	openReports: () => void;
}

export const DeclaredBoardContext = createContext<DeclaredBoardValue | null>(
	null,
);

export interface Report<X extends ExtraPanels = Record<never, never>> {
	/** The composed spec with `Save report` on its header. */
	spec: DashboardSpec<X>;
	/**
	 * Answers the action if it is one of these two, and says so.
	 *
	 * A page's own `switch` calls it first and returns on `true`, which keeps
	 * the act out of every page's action table.
	 */
	handle: (actionId: string) => boolean;
}

/**
 * Generic over the page's own panels, because a board that registers one —
 * the skill board's `skillFlow` — must keep it through here. Widening to the
 * built-ins would make `Save report` the thing that erased a page's own panel.
 */
export function useReport<X extends ExtraPanels>(
	spec: DashboardSpec<X> | null,
): Report<X> | null {
	const board = useContext(DeclaredBoardContext);
	const qc = useQueryClient();
	const save = useMutation({
		mutationFn: (document: DashboardSpec<X>) => {
			if (!board) throw new Error("No board to report on.");
			return boardReportsApi.create(
				board.username,
				board.graphSlug,
				board.kind,
				board.subjectId,
				{
					label: document.header?.crumbs.at(-1) ?? document.title ?? "Report",
					snapshot: document as unknown as Record<string, unknown>,
				},
			);
		},
		onSuccess: (version) => {
			// The list this reading now belongs to — so `Reports` opened straight
			// after a save shows the row that was just written.
			if (board)
				qc.invalidateQueries({
					queryKey: boardReportsKey(
						board.username,
						board.graphSlug,
						board.kind,
						board.subjectId,
					),
				});
			board?.onSaved(version.id);
			toast.success(
				"Report saved — this page now shows the numbers as they were.",
			);
		},
		onError: (e) =>
			toast.error(e instanceof Error ? e.message : "Couldn't save the report."),
	});

	const handle = useCallback(
		(actionId: string) => {
			if (actionId === OPEN_REPORTS_ACTION) {
				board?.openReports();
				return true;
			}
			if (actionId !== SAVE_REPORT_ACTION) return false;
			if (spec) save.mutate(spec);
			return true;
		},
		[spec, save.mutate, board],
	);

	if (!spec) return null;
	// A board the host did not mount — a page rendered outside `<DeclaredBoard>`
	// — has nowhere to write, so it draws no act rather than a button that fails.
	if (!board) return { spec, handle };

	return {
		spec: {
			...spec,
			header: spec.header
				? {
						...spec.header,
						actions: [
							...(spec.header.actions ?? []),
							{
								id: SAVE_REPORT_ACTION,
								label: save.isPending ? "Saving…" : "Save report",
								variant: "outline" as const,
								disabled: save.isPending,
							},
							// The other half of the pair — a kept reading is only kept
							// if there is a way back to it (B21).
							{
								id: OPEN_REPORTS_ACTION,
								label: "Reports",
								variant: "ghost" as const,
							},
						],
					}
				: spec.header,
		},
		handle,
	};
}
